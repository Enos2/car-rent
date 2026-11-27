// Project: Via Nostra
// File: backend/src/cars/admin.routes.ts
// Purpose: The staff tools for cars: the review queue, opening owner documents,
//          approving or rejecting documents, the hub inspection (photos and the
//          pass or fail record), and suspending or reinstating a live car.
//          Every action is audited, and staff cannot act on their own cars.

import type { FastifyInstance } from 'fastify';
import { recordAudit } from '../audit/audit.js';
import { currentAccount, requirePermission } from '../auth/guards.js';
import { idParamSchema, sendError, sendValidationError } from '../http.js';
import { deleteFile, fileExists, openFile, saveFile } from '../storage/files.js';
import { findUserById } from '../users/repository.js';
import type { User } from '../users/repository.js';
import {
  addPhoto,
  approveCarDocuments,
  countPhotos,
  getCar,
  getCarDocumentFile,
  isHubStaff,
  listCarDocuments,
  listCarsForReview,
  listInspections,
  listPhotos,
  recordInspection,
  reinstateCar,
  rejectCar,
  suspendCar,
} from './repository.js';
import { MAX_INSPECTION_PHOTOS, MIN_INSPECTION_PHOTOS, checkReadiness } from './rules.js';
import { inspectionSchema, queueSchema, reasonSchema } from './schemas.js';
import { readUpload } from './uploads.js';

// Super admins may act at any hub; other staff only at hubs they are assigned to.
async function mayWorkAtHub(account: User, hubId: string | null): Promise<boolean> {
  if (account.roles.includes('super_admin')) {
    return true;
  }
  return hubId !== null && (await isHubStaff(hubId, account.id));
}

export async function adminCarRoutes(app: FastifyInstance): Promise<void> {
  app.get('/admin/cars', { preHandler: requirePermission('cars.review') }, async (request, reply) => {
    const parsed = queueSchema.safeParse(request.query);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error);
    }
    const { items, total } = await listCarsForReview(parsed.data);
    return { items, total, limit: parsed.data.limit, offset: parsed.data.offset };
  });

  app.get('/admin/cars/:id', { preHandler: requirePermission('cars.review') }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const car = await getCar(params.data.id);
    if (!car) {
      return sendError(reply, 404, 'Not Found', 'Car not found');
    }
    const [owner, documents, photos, inspections] = await Promise.all([
      findUserById(car.ownerId),
      listCarDocuments(car.id),
      listPhotos(car.id),
      listInspections(car.id),
    ]);
    const listingPhotoCount = photos.filter((photo) => photo.kind === 'listing').length;
    return {
      car,
      owner: owner && {
        id: owner.id,
        fullName: owner.fullName,
        email: owner.email,
        companyName: owner.companyName,
        verificationStatus: owner.verificationStatus,
      },
      documents,
      photos,
      inspections,
      readiness: checkReadiness(documents, listingPhotoCount),
    };
  });

  app.get(
    '/admin/car-documents/:id/file',
    { preHandler: requirePermission('cars.review') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const document = await getCarDocumentFile(params.data.id);
      if (!document || !(await fileExists(document.storageKey))) {
        return sendError(reply, 404, 'Not Found', 'Document not found');
      }
      await recordAudit({
        actorId: currentAccount(request).id,
        action: 'car.document.viewed',
        entityType: 'car_document',
        entityId: params.data.id,
        metadata: { carId: document.carId },
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
    '/admin/cars/:id/approve-documents',
    { preHandler: requirePermission('cars.review') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const actor = currentAccount(request);
      const car = await getCar(params.data.id);
      if (!car) {
        return sendError(reply, 404, 'Not Found', 'Car not found');
      }
      if (car.ownerId === actor.id) {
        return sendError(reply, 403, 'Forbidden', 'You cannot review your own car');
      }
      const approved = await approveCarDocuments(car.id);
      if (!approved) {
        return sendError(reply, 409, 'Conflict', 'This car is not waiting for document review');
      }
      await recordAudit({
        actorId: actor.id,
        action: 'car.documents.approved',
        entityType: 'car',
        entityId: car.id,
        metadata: { ownerId: car.ownerId, hubId: car.hubId },
        ip: request.ip,
      });
      return { car: approved };
    },
  );

  app.post(
    '/admin/cars/:id/reject',
    { preHandler: requirePermission('cars.review') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const body = reasonSchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }
      const actor = currentAccount(request);
      const car = await getCar(params.data.id);
      if (!car) {
        return sendError(reply, 404, 'Not Found', 'Car not found');
      }
      if (car.ownerId === actor.id) {
        return sendError(reply, 403, 'Forbidden', 'You cannot review your own car');
      }
      const rejected = await rejectCar(car.id, body.data.reason);
      if (!rejected) {
        return sendError(reply, 409, 'Conflict', 'This car is not waiting for document review');
      }
      await recordAudit({
        actorId: actor.id,
        action: 'car.documents.rejected',
        entityType: 'car',
        entityId: car.id,
        metadata: { ownerId: car.ownerId, reason: body.data.reason },
        ip: request.ip,
      });
      return { car: rejected };
    },
  );

  app.post(
    '/admin/cars/:id/inspection-photos',
    {
      preHandler: requirePermission('cars.inspect'),
      config: { rateLimit: { max: 40, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const actor = currentAccount(request);
      const car = await getCar(params.data.id);
      if (!car) {
        return sendError(reply, 404, 'Not Found', 'Car not found');
      }
      if (car.ownerId === actor.id) {
        return sendError(reply, 403, 'Forbidden', 'You cannot inspect your own car');
      }
      if (!(await mayWorkAtHub(actor, car.hubId))) {
        return sendError(reply, 403, 'Forbidden', 'You are not assigned to this car\'s hub');
      }
      if (car.status !== 'awaiting_dropoff') {
        return sendError(reply, 409, 'Conflict', 'This car is not waiting for its hub inspection');
      }
      if ((await countPhotos(car.id, 'inspection', true)) >= MAX_INSPECTION_PHOTOS) {
        return sendError(reply, 409, 'Conflict', `At most ${MAX_INSPECTION_PHOTOS} inspection photos`);
      }

      const upload = await readUpload(request, reply, { allowPdf: false });
      if (!('buffer' in upload)) {
        return upload;
      }

      const storageKey = await saveFile('inspection-photos', upload.buffer);
      try {
        const photo = await addPhoto({
          carId: car.id,
          kind: 'inspection',
          storageKey,
          mimeType: upload.mime,
          sizeBytes: upload.buffer.length,
          createdBy: actor.id,
        });
        return reply.code(201).send({ photo });
      } catch (error) {
        await deleteFile(storageKey).catch(() => undefined);
        throw error;
      }
    },
  );

  app.post(
    '/admin/cars/:id/inspection',
    { preHandler: requirePermission('cars.inspect') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const body = inspectionSchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }
      const actor = currentAccount(request);
      const car = await getCar(params.data.id);
      if (!car) {
        return sendError(reply, 404, 'Not Found', 'Car not found');
      }
      if (car.ownerId === actor.id) {
        return sendError(reply, 403, 'Forbidden', 'You cannot inspect your own car');
      }
      if (!(await mayWorkAtHub(actor, car.hubId))) {
        return sendError(reply, 403, 'Forbidden', 'You are not assigned to this car\'s hub');
      }

      const outcome = await recordInspection({
        carId: car.id,
        inspectorId: actor.id,
        minPhotosForPass: MIN_INSPECTION_PHOTOS,
        ...body.data,
      });
      if (!outcome.ok) {
        return outcome.reason === 'photos'
          ? sendError(
              reply,
              400,
              'Bad Request',
              `Upload at least ${MIN_INSPECTION_PHOTOS} inspection photos before passing a car`,
            )
          : sendError(reply, 409, 'Conflict', 'This car is not waiting for its hub inspection');
      }

      await recordAudit({
        actorId: actor.id,
        action: body.data.result === 'passed' ? 'car.inspection.passed' : 'car.inspection.failed',
        entityType: 'car',
        entityId: car.id,
        metadata: {
          inspectionId: outcome.inspection.id,
          hubId: car.hubId,
          odometerKm: body.data.odometerKm,
        },
        ip: request.ip,
      });
      return reply.code(201).send({ car: outcome.car, inspection: outcome.inspection });
    },
  );

  app.post(
    '/admin/cars/:id/suspend',
    { preHandler: requirePermission('cars.review') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const body = reasonSchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }
      const actor = currentAccount(request);
      const car = await getCar(params.data.id);
      if (!car) {
        return sendError(reply, 404, 'Not Found', 'Car not found');
      }
      if (car.ownerId === actor.id) {
        return sendError(reply, 403, 'Forbidden', 'You cannot suspend your own car');
      }
      const suspended = await suspendCar(car.id, body.data.reason);
      if (!suspended) {
        return sendError(reply, 409, 'Conflict', 'Only a live or paused car can be suspended');
      }
      await recordAudit({
        actorId: actor.id,
        action: 'car.suspended',
        entityType: 'car',
        entityId: car.id,
        metadata: { reason: body.data.reason },
        ip: request.ip,
      });
      return { car: suspended };
    },
  );

  app.post(
    '/admin/cars/:id/reinstate',
    { preHandler: requirePermission('cars.review') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const actor = currentAccount(request);
      const reinstated = await reinstateCar(params.data.id);
      if (!reinstated) {
        return sendError(reply, 409, 'Conflict', 'Only a suspended car can be reinstated');
      }
      await recordAudit({
        actorId: actor.id,
        action: 'car.reinstated',
        entityType: 'car',
        entityId: reinstated.id,
        ip: request.ip,
      });
      return { car: reinstated };
    },
  );
}

// File: backend/src/cars/admin.routes.ts
// END OF FILE