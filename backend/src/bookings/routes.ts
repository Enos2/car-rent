// Project: Via Nostra
// File: backend/src/bookings/routes.ts
// Purpose: The web addresses renters and owners use for bookings: see a car's blocked
//          dates, book a car, pay, confirm that the car was received, cancel, and
//          list or open their bookings. Renters never see the commission amounts.

import type { FastifyInstance, FastifyReply } from 'fastify';
import { currentAccount, requireUser } from '../auth/guards.js';
import { config } from '../config.js';
import { getHub } from '../hubs/repository.js';
import { idParamSchema, sendError, sendValidationError } from '../http.js';
import { getPaymentProvider } from '../payments/provider.js';
import {
  cancelBooking,
  confirmReceipt,
  createBooking,
  getBookingItem,
  listBlockedRanges,
  listBookings,
  payBooking,
} from './repository.js';
import type { BookingListItem, CreateOutcome } from './repository.js';
import { MAX_ADVANCE_DAYS, addDaysIso, todayIso } from './rules.js';
import { bookingListSchema, cancelSchema, createBookingSchema } from './schemas.js';

function createFailure(
  reply: FastifyReply,
  outcome: Extract<CreateOutcome, { ok: false }>,
): FastifyReply {
  switch (outcome.reason) {
    case 'not_bookable':
      return sendError(reply, 404, 'Not Found', 'This car is not available for booking');
    case 'own_car':
      return sendError(reply, 403, 'Forbidden', 'You cannot book your own car');
    case 'days_out_of_range':
      return sendError(
        reply,
        400,
        'Bad Request',
        `This car can be rented for ${outcome.minDays} to ${outcome.maxDays} days`,
      );
    case 'dates_taken':
      return sendError(reply, 409, 'Conflict', 'The car is not available on those dates');
    case 'too_large':
      return sendError(reply, 400, 'Bad Request', 'The total amount is too large');
  }
}

// What a renter may see: everything except Via Nostra's commission.
function renterView<
  T extends { commissionBps: number; commissionMinor: number; ownerShareMinor: number },
>(booking: T) {
  const { commissionBps, commissionMinor, ownerShareMinor, ...rest } = booking;
  return rest;
}

// What an owner may see: the renter's first name only, no email.
function ownerView(item: BookingListItem) {
  const { renterName, renterEmail, ...rest } = item;
  return { ...rest, renterFirstName: renterName.split(' ')[0] ?? '' };
}

export async function bookingRoutes(app: FastifyInstance): Promise<void> {
  // Public: the dates when a car is already taken.
  app.get('/cars/:id/availability', async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    return { blocked: await listBlockedRanges(params.data.id) };
  });

  app.post(
    '/bookings',
    { preHandler: requireUser, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const account = currentAccount(request);
      if (!account.roles.includes('renter')) {
        return sendError(reply, 403, 'Forbidden', 'Only renter accounts can book cars');
      }
      if (account.verificationStatus !== 'verified') {
        return sendError(reply, 403, 'Forbidden', 'Your account must be verified before you can book a car');
      }
      const body = createBookingSchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }

      const today = todayIso();
      if (body.data.startDate < today) {
        return sendError(reply, 400, 'Bad Request', 'The start date cannot be in the past');
      }
      if (body.data.startDate > addDaysIso(today, MAX_ADVANCE_DAYS)) {
        return sendError(reply, 400, 'Bad Request', `Bookings open at most ${MAX_ADVANCE_DAYS} days ahead`);
      }
      if (body.data.endDate <= body.data.startDate) {
        return sendError(reply, 400, 'Bad Request', 'The end date must be after the start date');
      }

      const outcome = await createBooking({
        carId: body.data.carId,
        renterId: account.id,
        startDate: body.data.startDate,
        endDate: body.data.endDate,
        holdMinutes: config.bookingHoldMinutes,
        commissionBps: (accountType) =>
          accountType === 'company' ? config.commissionBpsCompany : config.commissionBpsIndividual,
      });
      if (!outcome.ok) {
        return createFailure(reply, outcome);
      }
      return reply.code(201).send({
        booking: renterView(outcome.booking),
        payment: {
          provider: getPaymentProvider().name,
          amountDueMinor: outcome.booking.subtotalMinor + outcome.booking.depositMinor,
          currency: outcome.booking.currency,
          payBefore: outcome.booking.expiresAt,
        },
      });
    },
  );

  app.get('/bookings/mine', { preHandler: requireUser }, async (request, reply) => {
    const query = bookingListSchema.safeParse(request.query);
    if (!query.success) {
      return sendValidationError(reply, query.error);
    }
    const { items, total } = await listBookings({
      renterId: currentAccount(request).id,
      ...query.data,
    });
    return {
      items: items.map(renterView),
      total,
      limit: query.data.limit,
      offset: query.data.offset,
    };
  });

  app.get('/bookings/owner', { preHandler: requireUser }, async (request, reply) => {
    const query = bookingListSchema.safeParse(request.query);
    if (!query.success) {
      return sendValidationError(reply, query.error);
    }
    const { items, total } = await listBookings({
      ownerId: currentAccount(request).id,
      ...query.data,
    });
    return { items: items.map(ownerView), total, limit: query.data.limit, offset: query.data.offset };
  });

  app.get('/bookings/:id', { preHandler: requireUser }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const account = currentAccount(request);
    const item = await getBookingItem(params.data.id);
    if (!item || (item.renterId !== account.id && item.ownerId !== account.id)) {
      return sendError(reply, 404, 'Not Found', 'Booking not found');
    }
    const hub = await getHub(item.hubId);
    return {
      booking: item.renterId === account.id ? renterView(item) : ownerView(item),
      hub: hub && {
        id: hub.id,
        name: hub.name,
        city: hub.city,
        address: hub.address,
        openingHours: hub.openingHours,
        contactPhone: hub.contactPhone,
      },
    };
  });

  app.post(
    '/bookings/:id/pay',
    { preHandler: requireUser, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const outcome = await payBooking({
        bookingId: params.data.id,
        renterId: currentAccount(request).id,
        provider: getPaymentProvider(),
      });
      if (!outcome) {
        return sendError(reply, 404, 'Not Found', 'Booking not found');
      }
      if (!outcome.ok) {
        return outcome.reason === 'expired'
          ? sendError(reply, 409, 'Conflict', 'The payment window has expired. Please book again')
          : sendError(reply, 409, 'Conflict', 'This booking cannot be paid');
      }
      return { booking: renterView(outcome.booking) };
    },
  );

  app.post('/bookings/:id/confirm-receipt', { preHandler: requireUser }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const outcome = await confirmReceipt({
      bookingId: params.data.id,
      renterId: currentAccount(request).id,
    });
    if (!outcome) {
      return sendError(reply, 404, 'Not Found', 'Booking not found');
    }
    if (!outcome.ok) {
      return sendError(reply, 409, 'Conflict', 'The car has not been handed over to you yet');
    }
    return { booking: renterView(outcome.booking) };
  });

  app.post('/bookings/:id/cancel', { preHandler: requireUser }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const body = cancelSchema.safeParse(request.body);
    if (!body.success) {
      return sendValidationError(reply, body.error);
    }
    const account = currentAccount(request);
    const item = await getBookingItem(params.data.id);
    if (!item || (item.renterId !== account.id && item.ownerId !== account.id)) {
      return sendError(reply, 404, 'Not Found', 'Booking not found');
    }

    const isRenter = item.renterId === account.id;
    const outcome = await cancelBooking({
      bookingId: item.id,
      by: isRenter ? 'renter' : 'owner',
      actorId: account.id,
      reason: body.data.reason,
      provider: getPaymentProvider(),
    });
    if (!outcome) {
      return sendError(reply, 404, 'Not Found', 'Booking not found');
    }
    if (!outcome.ok) {
      return sendError(
        reply,
        409,
        'Conflict',
        'This booking can no longer be cancelled here. Contact support',
      );
    }
    return {
      booking: isRenter ? renterView(outcome.booking) : outcome.booking,
      refundMinor: outcome.refundMinor ?? 0,
    };
  });
}

// File: backend/src/bookings/routes.ts
// END OF FILE