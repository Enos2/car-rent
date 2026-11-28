// Project: Via Nostra
// File: backend/src/reports/routes.ts
// Purpose: The web addresses for reports. Any logged-in person can report a car, a
//          person, a review or a post. Support staff and moderators work through the
//          queue and close each report, optionally hiding a review or post, or (for
//          staff who may review cars) suspending a car. Everything is audited.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordAudit } from '../audit/audit.js';
import { currentAccount, requirePermission, requireUser } from '../auth/guards.js';
import { hasPermission } from '../auth/permissions.js';
import { suspendCar } from '../cars/repository.js';
import {
  idParamSchema,
  isUniqueViolation,
  paginationSchema,
  sendError,
  sendValidationError,
} from '../http.js';
import { setPostStatus } from '../posts/repository.js';
import { setReviewHidden } from '../reviews/repository.js';
import {
  createReport,
  findTargetOwner,
  getReport,
  listReports,
  resolveReport,
} from './repository.js';

const createSchema = z.strictObject({
  targetType: z.enum(['car', 'user', 'review', 'post']),
  targetId: z.uuid(),
  reason: z.enum([
    'scam_or_fake',
    'unsafe_or_damaged',
    'misleading_listing',
    'abusive_behaviour',
    'inappropriate_content',
    'other',
  ]),
  details: z.string().trim().min(10).max(1000),
});

const listSchema = paginationSchema.extend({
  status: z.enum(['open', 'resolved', 'dismissed']).default('open'),
});

const resolveSchema = z.strictObject({
  outcome: z.enum(['resolved', 'dismissed']),
  note: z.string().trim().min(5).max(500),
  action: z.enum(['none', 'hide_review', 'suspend_car', 'hide_post']).default('none'),
});

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/reports',
    { preHandler: requireUser, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = createSchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }
      const account = currentAccount(request);

      const target = await findTargetOwner(body.data.targetType, body.data.targetId);
      if (!target.exists) {
        return sendError(reply, 404, 'Not Found', 'What you are reporting could not be found');
      }
      if (target.ownerId === account.id) {
        return sendError(reply, 400, 'Bad Request', 'You cannot report your own content');
      }

      try {
        const report = await createReport({ reporterId: account.id, ...body.data });
        return reply.code(201).send({ report });
      } catch (error) {
        if (isUniqueViolation(error)) {
          return sendError(reply, 409, 'Conflict', 'You already have an open report about this');
        }
        throw error;
      }
    },
  );

  app.get('/admin/reports', { preHandler: requirePermission('reports.review') }, async (request, reply) => {
    const query = listSchema.safeParse(request.query);
    if (!query.success) {
      return sendValidationError(reply, query.error);
    }
    const { items, total } = await listReports(query.data);
    return { items, total, limit: query.data.limit, offset: query.data.offset };
  });

  app.post(
    '/admin/reports/:id/resolve',
    { preHandler: requirePermission('reports.review') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const body = resolveSchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }
      const actor = currentAccount(request);
      const report = await getReport(params.data.id);
      if (!report) {
        return sendError(reply, 404, 'Not Found', 'Report not found');
      }
      if (report.status !== 'open') {
        return sendError(reply, 409, 'Conflict', 'This report was already closed');
      }
      if (report.reporterId === actor.id) {
        return sendError(reply, 403, 'Forbidden', 'You cannot close your own report');
      }

      // Take the chosen action first, so a failed action does not close the report.
      const { action } = body.data;
      if (action !== 'none') {
        if (body.data.outcome !== 'resolved') {
          return sendError(reply, 400, 'Bad Request', 'An action can only be taken when resolving a report');
        }
        if (action === 'hide_review') {
          if (report.targetType !== 'review') {
            return sendError(reply, 400, 'Bad Request', 'This report is not about a review');
          }
          await setReviewHidden(report.targetId, true);
        } else if (action === 'hide_post') {
          if (report.targetType !== 'post' || !hasPermission(actor.roles, 'content.manage')) {
            return sendError(reply, 403, 'Forbidden', 'You cannot hide this post');
          }
          await setPostStatus(report.targetId, 'hidden');
        } else {
          if (report.targetType !== 'car' || !hasPermission(actor.roles, 'cars.review')) {
            return sendError(reply, 403, 'Forbidden', 'You cannot suspend this car');
          }
          const suspended = await suspendCar(report.targetId, body.data.note);
          if (!suspended) {
            return sendError(reply, 409, 'Conflict', 'Only a live or paused car can be suspended');
          }
        }
      }

      const closed = await resolveReport({
        id: report.id,
        resolverId: actor.id,
        outcome: body.data.outcome,
        note: body.data.note,
      });
      if (!closed) {
        return sendError(reply, 409, 'Conflict', 'This report was already closed');
      }
      await recordAudit({
        actorId: actor.id,
        action: `report.${body.data.outcome}`,
        entityType: 'report',
        entityId: report.id,
        metadata: {
          targetType: report.targetType,
          targetId: report.targetId,
          action,
          note: body.data.note,
        },
        ip: request.ip,
      });
      return { report: closed };
    },
  );
}

// File: backend/src/reports/routes.ts
// END OF FILE