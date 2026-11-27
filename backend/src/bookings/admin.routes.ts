// Project: Via Nostra
// File: backend/src/bookings/admin.routes.ts
// Purpose: The staff tools for bookings: list and open bookings, the hub hand-over
//          of a car to a renter, the return of a car (with the deposit settlement),
//          and cancelling a booking. Every action is audited.

import type { FastifyInstance } from 'fastify';
import { recordAudit } from '../audit/audit.js';
import { currentAccount, requirePermission } from '../auth/guards.js';
import { mayWorkAtHub } from '../hubs/access.js';
import { idParamSchema, sendError, sendValidationError } from '../http.js';
import { getPaymentProvider } from '../payments/provider.js';
import {
  cancelBooking,
  getBooking,
  getBookingItem,
  handoverBooking,
  listBookings,
  listPayments,
  returnBooking,
} from './repository.js';
import {
  adminBookingListSchema,
  cancelSchema,
  handoverSchema,
  returnSchema,
} from './schemas.js';

export async function adminBookingRoutes(app: FastifyInstance): Promise<void> {
  app.get('/admin/bookings', { preHandler: requirePermission('bookings.read') }, async (request, reply) => {
    const query = adminBookingListSchema.safeParse(request.query);
    if (!query.success) {
      return sendValidationError(reply, query.error);
    }
    const { items, total } = await listBookings(query.data);
    return { items, total, limit: query.data.limit, offset: query.data.offset };
  });

  app.get('/admin/bookings/:id', { preHandler: requirePermission('bookings.read') }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const booking = await getBookingItem(params.data.id);
    if (!booking) {
      return sendError(reply, 404, 'Not Found', 'Booking not found');
    }
    return { booking, payments: await listPayments(booking.id) };
  });

  app.post(
    '/admin/bookings/:id/handover',
    { preHandler: requirePermission('cars.inspect') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const body = handoverSchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }
      const actor = currentAccount(request);
      const booking = await getBooking(params.data.id);
      if (!booking) {
        return sendError(reply, 404, 'Not Found', 'Booking not found');
      }
      if (booking.renterId === actor.id || booking.ownerId === actor.id) {
        return sendError(reply, 403, 'Forbidden', 'You cannot handle your own booking');
      }
      if (!(await mayWorkAtHub(actor, booking.hubId))) {
        return sendError(reply, 403, 'Forbidden', 'You are not assigned to this booking\'s hub');
      }

      const outcome = await handoverBooking({
        bookingId: booking.id,
        staffId: actor.id,
        ...body.data,
      });
      if (!outcome) {
        return sendError(reply, 404, 'Not Found', 'Booking not found');
      }
      if (!outcome.ok) {
        switch (outcome.reason) {
          case 'too_early':
            return sendError(reply, 409, 'Conflict', 'The rental has not started yet');
          case 'renter_not_verified':
            return sendError(reply, 403, 'Forbidden', 'The renter is not verified');
          default:
            return sendError(reply, 409, 'Conflict', 'This booking is not ready for hand-over');
        }
      }
      await recordAudit({
        actorId: actor.id,
        action: 'booking.handed_over',
        entityType: 'booking',
        entityId: booking.id,
        metadata: { odometerKm: body.data.odometerKm, hubId: booking.hubId },
        ip: request.ip,
      });
      return { booking: outcome.booking };
    },
  );

  app.post(
    '/admin/bookings/:id/return',
    { preHandler: requirePermission('cars.inspect') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const body = returnSchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }
      const actor = currentAccount(request);
      const booking = await getBooking(params.data.id);
      if (!booking) {
        return sendError(reply, 404, 'Not Found', 'Booking not found');
      }
      if (booking.renterId === actor.id || booking.ownerId === actor.id) {
        return sendError(reply, 403, 'Forbidden', 'You cannot handle your own booking');
      }
      if (!(await mayWorkAtHub(actor, booking.hubId))) {
        return sendError(reply, 403, 'Forbidden', 'You are not assigned to this booking\'s hub');
      }

      const outcome = await returnBooking({
        bookingId: booking.id,
        staffId: actor.id,
        provider: getPaymentProvider(),
        ...body.data,
      });
      if (!outcome) {
        return sendError(reply, 404, 'Not Found', 'Booking not found');
      }
      if (!outcome.ok) {
        return outcome.reason === 'deduction_too_large'
          ? sendError(reply, 400, 'Bad Request', 'The deduction cannot be larger than the deposit')
          : sendError(reply, 409, 'Conflict', 'This booking is not waiting for its return');
      }
      await recordAudit({
        actorId: actor.id,
        action: 'booking.returned',
        entityType: 'booking',
        entityId: booking.id,
        metadata: {
          odometerKm: body.data.odometerKm,
          deductionMinor: body.data.deductionMinor,
          deductionReason: body.data.deductionReason ?? null,
        },
        ip: request.ip,
      });
      return { booking: outcome.booking, depositRefundedMinor: outcome.refundMinor ?? 0 };
    },
  );

  app.post(
    '/admin/bookings/:id/cancel',
    { preHandler: requirePermission('bookings.manage') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const body = cancelSchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }
      const actor = currentAccount(request);
      const outcome = await cancelBooking({
        bookingId: params.data.id,
        by: 'staff',
        actorId: actor.id,
        reason: body.data.reason,
        provider: getPaymentProvider(),
      });
      if (!outcome) {
        return sendError(reply, 404, 'Not Found', 'Booking not found');
      }
      if (!outcome.ok) {
        return sendError(reply, 409, 'Conflict', 'Only unpaid or paid bookings that have not been handed over can be cancelled');
      }
      await recordAudit({
        actorId: actor.id,
        action: 'booking.cancelled_by_staff',
        entityType: 'booking',
        entityId: params.data.id,
        metadata: { reason: body.data.reason, refundMinor: outcome.refundMinor ?? 0 },
        ip: request.ip,
      });
      return { booking: outcome.booking, refundMinor: outcome.refundMinor ?? 0 };
    },
  );
}

// File: backend/src/bookings/admin.routes.ts
// END OF FILE