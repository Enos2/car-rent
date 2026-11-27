// Project: Via Nostra
// File: backend/src/verification/routes.ts
// Purpose: The web addresses for identity verification. People upload documents and
//          submit them for review; verification officers see the queue, open the
//          documents and approve or reject. Everything staff do is audited.

import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordAudit } from '../audit/audit.js';
import { currentAccount, requirePermission, requireUser } from '../auth/guards.js';
import {
  idParamSchema,
  paginationSchema,
  sendError,
  sendValidationError,
} from '../http.js';
import { deleteFile, detectMime, fileExists, openFile, saveFile } from '../storage/files.js';
import { findUserById } from '../users/repository.js';
import {
  decideRequest,
  getDocumentFile,
  getLatestRequest,
  getOrCreateOpenRequest,
  getRequest,
  listDocuments,
  listRequests,
  submitRequest,
  upsertDocument,
} from './repository.js';
import { DOC_TYPES, kindFor, missingRequirements, requirementsFor } from './requirements.js';
import type { User } from '../users/repository.js';

const docTypeParams = z.object({ docType: z.enum(DOC_TYPES) });

const queueQuery = paginationSchema.extend({
  status: z.enum(['draft', 'pending', 'approved', 'rejected']).default('pending'),
});

const rejectBody = z.strictObject({ reason: z.string().trim().min(5).max(500) });

function withSatisfied(user: User, uploaded: Set<string>) {
  return requirementsFor(user).map((requirement) => ({
    ...requirement,
    satisfied: requirement.anyOf.some((type) => uploaded.has(type)),
  }));
}

export async function verificationRoutes(app: FastifyInstance): Promise<void> {
  // ----- For the person being verified -----

  app.get('/verification/me', { preHandler: requireUser }, async (request) => {
    const account = currentAccount(request);
    const latest = await getLatestRequest(account.id);
    const documents = latest ? await listDocuments(latest.id) : [];
    const uploaded = new Set<string>(documents.map((document) => document.docType));
    return {
      verificationStatus: account.verificationStatus,
      kind: kindFor(account),
      request: latest,
      requirements: withSatisfied(account, uploaded),
      documents,
    };
  });

  app.post(
    '/verification/documents/:docType',
    {
      preHandler: requireUser,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const params = docTypeParams.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const account = currentAccount(request);
      if (account.verificationStatus === 'verified') {
        return sendError(reply, 409, 'Conflict', 'Your account is already verified');
      }
      if (account.verificationStatus === 'pending') {
        return sendError(reply, 409, 'Conflict', 'Your documents are in review and cannot be changed');
      }

      const upload = await request.file();
      if (!upload) {
        return sendError(reply, 400, 'Bad Request', 'Please attach a file');
      }
      const buffer = await upload.toBuffer();
      if (upload.file.truncated) {
        return sendError(reply, 413, 'Payload Too Large', 'The file is too large');
      }
      const mime = detectMime(buffer);
      if (!mime) {
        return sendError(reply, 415, 'Unsupported Media Type', 'Only JPG, PNG or PDF files are allowed');
      }

      const draft = await getOrCreateOpenRequest(account.id, kindFor(account));
      if (draft.status !== 'draft') {
        return sendError(reply, 409, 'Conflict', 'Your documents are in review and cannot be changed');
      }

      const storageKey = await saveFile('verification', buffer);
      try {
        const { document, replacedKey } = await upsertDocument({
          requestId: draft.id,
          userId: account.id,
          docType: params.data.docType,
          storageKey,
          originalName: path.basename(upload.filename).slice(0, 120),
          mimeType: mime,
          sizeBytes: buffer.length,
        });
        if (replacedKey) {
          await deleteFile(replacedKey).catch(() => undefined);
        }
        return reply.code(201).send({ document });
      } catch (error) {
        await deleteFile(storageKey).catch(() => undefined);
        throw error;
      }
    },
  );

  app.post('/verification/submit', { preHandler: requireUser }, async (request, reply) => {
    const account = currentAccount(request);
    const latest = await getLatestRequest(account.id);
    if (!latest || latest.status !== 'draft') {
      return sendError(reply, 409, 'Conflict', 'There is nothing to submit. Upload your documents first');
    }

    const documents = await listDocuments(latest.id);
    const missing = missingRequirements(
      account,
      documents.map((document) => document.docType),
    );
    if (missing.length > 0) {
      return reply.code(400).send({
        error: 'Missing documents',
        message: 'Please upload all required documents before submitting',
        missing: missing.map((requirement) => requirement.label),
      });
    }

    const submitted = await submitRequest(latest.id, account.id);
    if (!submitted) {
      return sendError(reply, 409, 'Conflict', 'This request was already submitted');
    }
    return { request: submitted };
  });

  // ----- For verification officers -----

  app.get(
    '/admin/verifications',
    { preHandler: requirePermission('verification.review') },
    async (request, reply) => {
      const parsed = queueQuery.safeParse(request.query);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error);
      }
      const { items, total } = await listRequests(parsed.data);
      return { items, total, limit: parsed.data.limit, offset: parsed.data.offset };
    },
  );

  app.get(
    '/admin/verifications/:id',
    { preHandler: requirePermission('verification.review') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const found = await getRequest(params.data.id);
      if (!found) {
        return sendError(reply, 404, 'Not Found', 'Verification request not found');
      }
      const person = await findUserById(found.userId);
      const documents = await listDocuments(found.id);
      const uploaded = new Set<string>(documents.map((document) => document.docType));
      return {
        request: found,
        user: person,
        documents,
        requirements: person ? withSatisfied(person, uploaded) : [],
      };
    },
  );

  app.get(
    '/admin/verification-documents/:id/file',
    { preHandler: requirePermission('verification.review') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const document = await getDocumentFile(params.data.id);
      if (!document || !(await fileExists(document.storageKey))) {
        return sendError(reply, 404, 'Not Found', 'Document not found');
      }

      await recordAudit({
        actorId: currentAccount(request).id,
        action: 'verification.document.viewed',
        entityType: 'verification_document',
        entityId: params.data.id,
        metadata: { ownerId: document.userId },
        ip: request.ip,
      });

      return reply
        .header('Content-Type', document.mimeType)
        .header('Content-Disposition', 'inline')
        .header('Cache-Control', 'private, no-store')
        .header('X-Content-Type-Options', 'nosniff')
        .send(openFile(document.storageKey));
    },
  );

  app.post(
    '/admin/verifications/:id/approve',
    { preHandler: requirePermission('verification.review') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const actor = currentAccount(request);
      const found = await getRequest(params.data.id);
      if (!found) {
        return sendError(reply, 404, 'Not Found', 'Verification request not found');
      }
      if (found.userId === actor.id) {
        return sendError(reply, 403, 'Forbidden', 'You cannot review your own verification');
      }

      const decided = await decideRequest({
        id: found.id,
        reviewerId: actor.id,
        decision: 'approved',
      });
      if (!decided) {
        return sendError(reply, 409, 'Conflict', 'This request is not waiting for review');
      }
      await recordAudit({
        actorId: actor.id,
        action: 'verification.approved',
        entityType: 'verification_request',
        entityId: decided.id,
        metadata: { userId: decided.userId },
        ip: request.ip,
      });
      return { request: decided };
    },
  );

  app.post(
    '/admin/verifications/:id/reject',
    { preHandler: requirePermission('verification.review') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const body = rejectBody.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }
      const actor = currentAccount(request);
      const found = await getRequest(params.data.id);
      if (!found) {
        return sendError(reply, 404, 'Not Found', 'Verification request not found');
      }
      if (found.userId === actor.id) {
        return sendError(reply, 403, 'Forbidden', 'You cannot review your own verification');
      }

      const decided = await decideRequest({
        id: found.id,
        reviewerId: actor.id,
        decision: 'rejected',
        reason: body.data.reason,
      });
      if (!decided) {
        return sendError(reply, 409, 'Conflict', 'This request is not waiting for review');
      }
      await recordAudit({
        actorId: actor.id,
        action: 'verification.rejected',
        entityType: 'verification_request',
        entityId: decided.id,
        metadata: { userId: decided.userId, reason: body.data.reason },
        ip: request.ip,
      });
      return { request: decided };
    },
  );
}

// File: backend/src/verification/routes.ts
// END OF FILE
