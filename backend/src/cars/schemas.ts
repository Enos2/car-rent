// Project: Via Nostra
// File: backend/src/cars/schemas.ts
// Purpose: Describes and validates what the API accepts for cars: new listings,
//          edits, public search filters, inspection records and reasons.

import { z } from 'zod';
import { paginationSchema } from '../http.js';
import { CAR_STATUSES, FUEL_TYPES, TRANSMISSIONS } from './rules.js';

const carFields = {
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  plateNumber: z.string().trim().min(2).max(15).toUpperCase(),
  vin: z.string().trim().length(17).toUpperCase().optional(),
  color: z.string().trim().min(2).max(30).optional(),
  seats: z.number().int().min(1).max(20),
  transmission: z.enum(TRANSMISSIONS),
  fuelType: z.enum(FUEL_TYPES),
  description: z.string().trim().max(2000).optional(),
  currency: z.string().trim().length(3).toUpperCase(),
  dailyPriceMinor: z.number().int().min(100).max(100_000_000),
  depositMinor: z.number().int().min(0).max(100_000_000).optional(),
  minRentalDays: z.number().int().min(1).max(365).optional(),
  maxRentalDays: z.number().int().min(1).max(365).optional(),
};

export const createCarSchema = z.strictObject(carFields).refine(
  (car) => (car.maxRentalDays ?? 30) >= (car.minRentalDays ?? 1),
  { path: ['maxRentalDays'], message: 'must not be smaller than minRentalDays' },
);

export const updateCarSchema = z
  .strictObject(carFields)
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: 'Send at least one field to change',
  });

export const submitCarSchema = z.strictObject({ hubId: z.uuid() });

export const reasonSchema = z.strictObject({ reason: z.string().trim().min(5).max(500) });

export const searchSchema = paginationSchema.extend({
  city: z.string().trim().min(1).max(100).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
  make: z.string().trim().min(1).max(60).optional(),
  minDailyPriceMinor: z.coerce.number().int().min(0).optional(),
  maxDailyPriceMinor: z.coerce.number().int().min(0).optional(),
  transmission: z.enum(TRANSMISSIONS).optional(),
  fuelType: z.enum(FUEL_TYPES).optional(),
  minSeats: z.coerce.number().int().min(1).max(20).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
});

export const queueSchema = paginationSchema.extend({
  status: z.enum(CAR_STATUSES).default('submitted'),
  hubId: z.uuid().optional(),
});

export const inspectionSchema = z.strictObject({
  result: z.enum(['passed', 'failed']),
  odometerKm: z.number().int().min(0).max(2_000_000),
  fuelLevelPercent: z.number().int().min(0).max(100),
  conditionNotes: z.string().trim().min(10).max(2000),
});

// File: backend/src/cars/schemas.ts
// END OF FILE