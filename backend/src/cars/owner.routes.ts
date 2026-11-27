// Project: Via Nostra
// File: backend/src/cars/owner.routes.ts
// Purpose: The web addresses a car owner uses: create a listing, edit it, upload
//          documents and photos, choose a hub and submit for review, pause or
//          resume a live car, and remove a car.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { currentAccount, requireUser } from '../auth/guards.js';
import { getHub } from '../hubs/repository.js';
import {
  idParamSchema,
  isUniqueViolation,
  sendError,
  sendValidationError,
} from '../http.js';
import { deleteFile, saveFile } from '../storage/files.js';
import {
  addPhoto,
  countPhotos,
  createCar,
  deleteListingPhoto,
  getCar,
  listCarDocuments,
  listInspections,
  listOwnerCars,
  listPhotos,
  pauseCar,
  resumeCar,
  retireCar,
  submitCar,
  updateCar,
  upsertCarDocument,
} from './repository.js';
import {
  CAR_DOC_TYPES,
  DETAILS_EDITABLE,
  DOCUMENTS_EDITABLE,
  IDENTITY_EDITABLE,
  MAX_LISTING_PHOTOS,
  PHOTOS_EDITABLE,
  RETIRABLE,
  checkReadiness,
  todayIso,
} from './rules.js';
import { createCarSchema, submitCarSchema, updateCarSchema } from './schemas.js';
import { readUpload } from './uploads.js';

const docParams = z.object({ id: z.uuid(), docType: z.enum(CAR_DOC_TYPES) });
const photoParams = z.object({ id: z.uuid(), photoId: z.uuid() });
const docQuery = z.object({ expiresOn: z.iso.date().optional() });

const IDENTITY_FIELDS = [
  'make',
  'model',
  'year',
  'plateNumber',
  'vin',
  'seats',
  'transmission',
  'fuelType',
  'currency',
] as const;

const DUPLICATE_MESSAGE = 'A car with this plate number or VIN is already listed';

export async function ownerCarRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/cars',
    { preHandler: requireUser, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const account = currentAccount(request);
      if (!account.roles.includes('owner')) {
        return sendError(reply, 403, 'Forbidden', 'Only owner accounts can list cars');
      }
      if (account.verificationStatus !== 'verified') {
        return sendError(reply, 403, 'Forbidden', 'Your account must be verified before you can list a car');
      }
      const body = createCarSchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }
      try {
        const car = await createCar(account.id, body.data);
        return reply.code(201).send({ car });
      } catch (error) {
        if (isUniqueViolation(error)) {
          return sendError(reply, 409, 'Conflict', DUPLICATE_MESSAGE);
        }
        throw error;
      }
    },
  );

  app.get('/cars/mine', { preHandler: requireUser }, async (request) => ({
    items: await listOwnerCars(currentAccount(request).id),
  }));

  app.get('/cars/mine/:id', { preHandler: requireUser }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const car = await getCar(params.data.id);
    if (!car || car.ownerId !== currentAccount(request).id) {
      return sendError(reply, 404, 'Not Found', 'Car not found');
    }
    const [documents, photos, inspections] = await Promise.all([
      listCarDocuments(car.id),
      listPhotos(car.id),
      listInspections(car.id),
    ]);
    const listingPhotoCount = photos.filter((photo) => photo.kind === 'listing').length;
    return {
      car,
      documents,
      photos,
      inspections,
      readiness: checkReadiness(documents, listingPhotoCount),
    };
  });

  app.patch('/cars/:id', { preHandler: requireUser }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const body = updateCarSchema.safeParse(request.body);
    if (!body.success) {
      return sendValidationError(reply, body.error);
    }
    const car = await getCar(params.data.id);
    if (!car || car.ownerId !== currentAccount(request).id) {
      return sendError(reply, 404, 'Not Found', 'Car not found');
    }
    if (!DETAILS_EDITABLE.includes(car.status)) {
      return sendError(reply, 409, 'Conflict', `A car that is ${car.status} cannot be edited`);
    }
    const touchesIdentity = IDENTITY_FIELDS.some((field) => body.data[field] !== undefined);
    if (touchesIdentity && !IDENTITY_EDITABLE.includes(car.status)) {
      return sendError(
        reply,
        409,
        'Conflict',
        'Make, model, year, plate, VIN, seats, gearbox, fuel and currency cannot change after approval',
      );
    }
    const minDays = body.data.minRentalDays ?? car.minRentalDays;
    const maxDays = body.data.maxRentalDays ?? car.maxRentalDays;
    if (maxDays < minDays) {
      return sendError(reply, 400, 'Bad Request', 'maxRentalDays must not be smaller than minRentalDays');
    }
    try {
      return { car: await updateCar(car.id, body.data) };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return sendError(reply, 409, 'Conflict', DUPLICATE_MESSAGE);
      }
      throw error;
    }
  });

  app.post(
    '/cars/:id/documents/:docType',
    {
      preHandler: requireUser,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const params = docParams.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const query = docQuery.safeParse(request.query);
      if (!query.success) {
        return sendValidationError(reply, query.error);
      }
      const car = await getCar(params.data.id);
      if (!car || car.ownerId !== currentAccount(request).id) {
        return sendError(reply, 404, 'Not Found', 'Car not found');
      }
      if (!DOCUMENTS_EDITABLE.includes(car.status)) {
        return sendError(reply, 409, 'Conflict', 'Documents can only be changed before submission');
      }

      const expiresOn = query.data.expiresOn ?? null;
      if (params.data.docType === 'insurance' && !expiresOn) {
        return sendError(reply, 400, 'Bad Request', 'expiresOn (YYYY-MM-DD) is required for insurance');
      }
      if (expiresOn && expiresOn <= todayIso()) {
        return sendError(reply, 400, 'Bad Request', 'The expiry date must be in the future');
      }

      const upload = await readUpload(request, reply, { allowPdf: true });
      if (!('buffer' in upload)) {
        return upload;
      }

      const storageKey = await saveFile('car-documents', upload.buffer);
      try {
        const { document, replacedKey } = await upsertCarDocument({
          carId: car.id,
          docType: params.data.docType,
          storageKey,
          originalName: upload.originalName,
          mimeType: upload.mime,
          sizeBytes: upload.buffer.length,
          expiresOn,
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

  app.post(
    '/cars/:id/photos',
    {
      preHandler: requireUser,
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const account = currentAccount(request);
      const car = await getCar(params.data.id);
      if (!car || car.ownerId !== account.id) {
        return sendError(reply, 404, 'Not Found', 'Car not found');
      }
      if (!PHOTOS_EDITABLE.includes(car.status)) {
        return sendError(reply, 409, 'Conflict', 'Photos cannot be changed in the car\'s current status');
      }
      if ((await countPhotos(car.id, 'listing')) >= MAX_LISTING_PHOTOS) {
        return sendError(reply, 409, 'Conflict', `A car can have at most ${MAX_LISTING_PHOTOS} photos`);
      }

      const upload = await readUpload(request, reply, { allowPdf: false });
      if (!('buffer' in upload)) {
        return upload;
      }

      const storageKey = await saveFile('car-photos', upload.buffer);
      try {
        const photo = await addPhoto({
          carId: car.id,
          kind: 'listing',
          storageKey,
          mimeType: upload.mime,
          sizeBytes: upload.buffer.length,
          createdBy: account.id,
        });
        return reply.code(201).send({ photo });
      } catch (error) {
        await deleteFile(storageKey).catch(() => undefined);
        throw error;
      }
    },
  );

  app.delete('/cars/:id/photos/:photoId', { preHandler: requireUser }, async (request, reply) => {
    const params = photoParams.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const car = await getCar(params.data.id);
    if (!car || car.ownerId !== currentAccount(request).id) {
      return sendError(reply, 404, 'Not Found', 'Car not found');
    }
    if (!PHOTOS_EDITABLE.includes(car.status)) {
      return sendError(reply, 409, 'Conflict', 'Photos cannot be changed in the car\'s current status');
    }
    const storageKey = await deleteListingPhoto(car.id, params.data.photoId);
    if (!storageKey) {
      return sendError(reply, 404, 'Not Found', 'Photo not found');
    }
    await deleteFile(storageKey).catch(() => undefined);
    return reply.code(204).send();
  });

  app.post('/cars/:id/submit', { preHandler: requireUser }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const body = submitCarSchema.safeParse(request.body);
    if (!body.success) {
      return sendValidationError(reply, body.error);
    }
    const account = currentAccount(request);
    const car = await getCar(params.data.id);
    if (!car || car.ownerId !== account.id) {
      return sendError(reply, 404, 'Not Found', 'Car not found');
    }
    if (account.verificationStatus !== 'verified') {
      return sendError(reply, 403, 'Forbidden', 'Your account must be verified to submit a car');
    }
    if (!DOCUMENTS_EDITABLE.includes(car.status)) {
      return sendError(reply, 409, 'Conflict', 'This car was already submitted');
    }

    const hub = await getHub(body.data.hubId);
    if (!hub || !hub.isActive) {
      return sendError(reply, 400, 'Bad Request', 'Choose an active hub for the drop-off');
    }

    const documents = await listCarDocuments(car.id);
    const readiness = checkReadiness(documents, await countPhotos(car.id, 'listing'));
    if (!readiness.ready) {
      return reply.code(400).send({
        error: 'Not ready',
        message: 'The car is not ready to be submitted',
        problems: readiness.problems,
      });
    }

    const submitted = await submitCar(car.id, hub.id);
    if (!submitted) {
      return sendError(reply, 409, 'Conflict', 'This car was already submitted');
    }
    return { car: submitted };
  });

  app.post('/cars/:id/pause', { preHandler: requireUser }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const car = await getCar(params.data.id);
    if (!car || car.ownerId !== currentAccount(request).id) {
      return sendError(reply, 404, 'Not Found', 'Car not found');
    }
    const paused = await pauseCar(car.id);
    if (!paused) {
      return sendError(reply, 409, 'Conflict', 'Only a live car can be paused');
    }
    return { car: paused };
  });

  app.post('/cars/:id/resume', { preHandler: requireUser }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const car = await getCar(params.data.id);
    if (!car || car.ownerId !== currentAccount(request).id) {
      return sendError(reply, 404, 'Not Found', 'Car not found');
    }
    const resumed = await resumeCar(car.id);
    if (!resumed) {
      return sendError(reply, 409, 'Conflict', 'Only a paused car can be resumed');
    }
    return { car: resumed };
  });

  app.post('/cars/:id/retire', { preHandler: requireUser }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const car = await getCar(params.data.id);
    if (!car || car.ownerId !== currentAccount(request).id) {
      return sendError(reply, 404, 'Not Found', 'Car not found');
    }
    const retired = await retireCar(car.id, RETIRABLE);
    if (!retired) {
      return sendError(reply, 409, 'Conflict', 'A live car must be paused before it can be removed');
    }
    return { car: retired };
  });
}

// File: backend/src/cars/owner.routes.ts
// END OF FILE