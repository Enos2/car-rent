// Project: Via Nostra
// File: backend/src/bookings/schemas.ts
// Purpose: Describes and validates what the API accepts for bookings: a new booking,
//          cancellation reasons, the hub hand-over and return records, and list filters.

import { z } from 'zod';
import { paginationSchema } from '../http.js';
import { BOOKING_STATUSES } from './rules.js';

export const createBookingSchema = z.strictObject({
  carId: z.uuid(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
});

export const cancelSchema = z.strictObject({
  reason: z.string().trim().min(5).max(500),
});

export const handoverSchema = z.strictObject({
  odometerKm: z.number().int().min(0).max(2_000_000),
  fuelLevelPercent: z.number().int().min(0).max(100),
  notes: z.string().trim().min(5).max(2000),
});

export const returnSchema = z
  .strictObject({
    odometerKm: z.number().int().min(0).max(2_000_000),
    fuelLevelPercent: z.number().int().min(0).max(100),
    notes: z.string().trim().min(5).max(2000),
    deductionMinor: z.number().int().min(0).max(2_000_000_000).default(0),
    deductionReason: z.string().trim().min(5).max(500).optional(),
  })
  .refine((data) => data.deductionMinor === 0 || Boolean(data.deductionReason), {
    path: ['deductionReason'],
    message: 'is required when a deduction is made',
  });

export const bookingListSchema = paginationSchema.extend({
  status: z.enum(BOOKING_STATUSES).optional(),
});

export const adminBookingListSchema = bookingListSchema.extend({
  hubId: z.uuid().optional(),
});

// File: backend/src/bookings/schemas.ts
// END OF FILE