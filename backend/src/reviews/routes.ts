// Project: Via Nostra
// File: backend/src/reviews/routes.ts
// Purpose: The web addresses for ratings: write a review of a finished rental, see
//          which reviews you can still write, read the public reviews of a car, and
//          (for staff) hide or show a review.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordAudit } from '../audit/audit.js';
import { currentAccount, requirePermission, requireUser } from '../auth/guards.js';
import { idParamSchema, paginationSchema, sendError, sendValidationError } from '../http.js';
import { createReview, getCarReviews, listPendingReviews, setReviewHidden } from './repository.js';

const createSchema = z.strictObject({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

const visibilitySchema = z.strictObject({
  hidden: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

export async function reviewRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/bookings/:id/review',
    { preHandler: requireUser, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const body = createSchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }

      const outcome = await createReview({
        bookingId: params.data.id,
        authorId: currentAccount(request).id,
        rating: body.data.rating,
        comment: body.data.comment ? body.data.comment : null,
      });
      if (!outcome.ok) {
        switch (outcome.reason) {
          case 'not_found':
            return sendError(reply, 404, 'Not Found', 'Booking not found');
          case 'not_completed':
            return sendError(reply, 409, 'Conflict', 'You can review a rental after the car is returned');
          case 'window_closed':
            return sendError(reply, 409, 'Conflict', 'The 30-day review period has ended');
          case 'duplicate':
            return sendError(reply, 409, 'Conflict', 'You already reviewed this rental');
        }
      }
      return reply.code(201).send({ review: outcome.review });
    },
  );

  app.get('/reviews/pending', { preHandler: requireUser }, async (request) => ({
    items: await listPendingReviews(currentAccount(request).id),
  }));

  // Public: the reviews and the average rating of a car.
  app.get('/cars/:id/reviews', async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const query = paginationSchema.safeParse(request.query);
    if (!query.success) {
      return sendValidationError(reply, query.error);
    }
    const { summary, items } = await getCarReviews(params.data.id, query.data.limit, query.data.offset);
    return { summary, items, limit: query.data.limit, offset: query.data.offset };
  });

  app.post(
    '/admin/reviews/:id/visibility',
    { preHandler: requirePermission('reports.review') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const body = visibilitySchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }
      const review = await setReviewHidden(params.data.id, body.data.hidden);
      if (!review) {
        return sendError(reply, 404, 'Not Found', 'Review not found');
      }
      await recordAudit({
        actorId: currentAccount(request).id,
        action: body.data.hidden ? 'review.hidden' : 'review.shown',
        entityType: 'review',
        entityId: review.id,
        metadata: { reason: body.data.reason },
        ip: request.ip,
      });
      return { review };
    },
  );
}

// File: backend/src/reviews/routes.ts
// END OF FILE