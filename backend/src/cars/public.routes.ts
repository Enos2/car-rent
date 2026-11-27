// Project: Via Nostra
// File: backend/src/cars/public.routes.ts
// Purpose: The public web addresses for cars: search the live cars (this is also the
//          home-page feed, newest first), view one live car, and fetch its photos.
//          Only cars from verified owners that passed the hub inspection appear.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { currentAccount, requireUser } from '../auth/guards.js';
import { hasPermission } from '../auth/permissions.js';
import { idParamSchema, sendError, sendValidationError } from '../http.js';
import { fileExists, openFile } from '../storage/files.js';
import { getCar, getLiveCar, getPhotoFile, listPhotos, searchLiveCars } from './repository.js';
import { searchSchema } from './schemas.js';

const photoParams = z.object({ id: z.uuid(), photoId: z.uuid() });

export async function publicCarRoutes(app: FastifyInstance): Promise<void> {
  app.get('/cars', async (request, reply) => {
    const parsed = searchSchema.safeParse(request.query);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error);
    }
    const { items, total } = await searchLiveCars(parsed.data);
    return { items, total, limit: parsed.data.limit, offset: parsed.data.offset };
  });

  app.get('/cars/:id', async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const car = await getLiveCar(params.data.id);
    if (!car) {
      return sendError(reply, 404, 'Not Found', 'Car not found');
    }
    const photos = await listPhotos(car.id, 'listing');
    return { car, photos: photos.map((photo) => ({ id: photo.id, position: photo.position })) };
  });

  // Listing photos of live cars are public. Everything else (photos of cars that are
  // not live, and inspection photos) is private to the owner and permitted staff.
  app.get('/cars/:id/photos/:photoId', async (request, reply) => {
    const params = photoParams.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const car = await getCar(params.data.id);
    const photo = await getPhotoFile(params.data.photoId);
    if (!car || !photo || photo.carId !== car.id) {
      return sendError(reply, 404, 'Not Found', 'Photo not found');
    }

    const isPublic = car.status === 'live' && photo.kind === 'listing';
    if (!isPublic) {
      const denied = await requireUser(request, reply);
      if (denied) {
        return denied;
      }
      const account = currentAccount(request);
      const allowed =
        car.ownerId === account.id ||
        hasPermission(account.roles, 'cars.review') ||
        hasPermission(account.roles, 'cars.inspect');
      if (!allowed) {
        return sendError(reply, 404, 'Not Found', 'Photo not found');
      }
    }

    if (!(await fileExists(photo.storageKey))) {
      return sendError(reply, 404, 'Not Found', 'Photo not found');
    }
    return reply
      .header('Content-Type', photo.mimeType)
      .header('Cache-Control', isPublic ? 'public, max-age=3600' : 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .send(openFile(photo.storageKey));
  });
}

// File: backend/src/cars/public.routes.ts
// END OF FILE