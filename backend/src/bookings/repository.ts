// Project: Via Nostra
// File: backend/src/bookings/repository.ts
// Purpose: All database work for bookings: creating a booking without double-booking
//          a car, listing, and every step of its life (pay, hand over, confirm
//          receipt, return, cancel). Each step that moves money also writes to the
//          ledger in the same database transaction, so the two never disagree.

import type pg from 'pg';
import { pool } from '../db.js';
import { postLedgerTransaction } from '../payments/ledger.js';
import type { PaymentProvider } from '../payments/provider.js';
import type { AccountType } from '../users/repository.js';
import {
  MAX_AMOUNT_MINOR,
  calculatePrice,
  cancellationBreakdown,
  daysBetween,
  todayIso,
} from './rules.js';
import type { BookingStatus } from './rules.js';

export type Booking = {
  id: string;
  carId: string;
  renterId: string;
  ownerId: string;
  hubId: string;
  status: BookingStatus;
  startDate: string;
  endDate: string;
  days: number;
  currency: string;
  dailyPriceMinor: number;
  subtotalMinor: number;
  depositMinor: number;
  commissionBps: number;
  commissionMinor: number;
  ownerShareMinor: number;
  expiresAt: Date | null;
  paidAt: Date | null;
  handedOverAt: Date | null;
  receiptConfirmedAt: Date | null;
  returnedAt: Date | null;
  cancelledAt: Date | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  refundMinor: number | null;
  depositDeductionMinor: number;
  deductionReason: string | null;
  handoverOdometerKm: number | null;
  handoverFuelPercent: number | null;
  handoverNotes: string | null;
  returnOdometerKm: number | null;
  returnFuelPercent: number | null;
  returnNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BookingListItem = Booking & {
  carMake: string;
  carModel: string;
  plateNumber: string;
  hubName: string;
  hubCity: string;
  renterName: string;
  renterEmail: string;
  ownerName: string;
};

export type PaymentRecord = {
  id: string;
  bookingId: string;
  kind: 'charge' | 'refund';
  provider: string;
  providerReference: string;
  amountMinor: number;
  currency: string;
  createdAt: Date;
};

const BOOKING_COLUMNS = `
  b.id, b.car_id AS "carId", b.renter_id AS "renterId", b.owner_id AS "ownerId",
  b.hub_id AS "hubId", b.status,
  to_char(b.start_date, 'YYYY-MM-DD') AS "startDate",
  to_char(b.end_date, 'YYYY-MM-DD') AS "endDate",
  b.days, b.currency, b.daily_price_minor AS "dailyPriceMinor",
  b.subtotal_minor AS "subtotalMinor", b.deposit_minor AS "depositMinor",
  b.commission_bps AS "commissionBps", b.commission_minor AS "commissionMinor",
  b.owner_share_minor AS "ownerShareMinor", b.expires_at AS "expiresAt",
  b.paid_at AS "paidAt", b.handed_over_at AS "handedOverAt",
  b.receipt_confirmed_at AS "receiptConfirmedAt", b.returned_at AS "returnedAt",
  b.cancelled_at AS "cancelledAt", b.cancelled_by AS "cancelledBy",
  b.cancellation_reason AS "cancellationReason", b.refund_minor AS "refundMinor",
  b.deposit_deduction_minor AS "depositDeductionMinor", b.deduction_reason AS "deductionReason",
  b.handover_odometer_km AS "handoverOdometerKm", b.handover_fuel_percent AS "handoverFuelPercent",
  b.handover_notes AS "handoverNotes", b.return_odometer_km AS "returnOdometerKm",
  b.return_fuel_percent AS "returnFuelPercent", b.return_notes AS "returnNotes",
  b.created_at AS "createdAt", b.updated_at AS "updatedAt"
`;

const LIST_SELECT = `
  SELECT ${BOOKING_COLUMNS},
         c.make AS "carMake", c.model AS "carModel", c.plate_number AS "plateNumber",
         h.name AS "hubName", h.city AS "hubCity",
         ru.full_name AS "renterName", ru.email AS "renterEmail",
         COALESCE(ou.company_name, ou.full_name) AS "ownerName"
  FROM bookings b
  JOIN cars c ON c.id = b.car_id
  JOIN hubs h ON h.id = b.hub_id
  JOIN users ru ON ru.id = b.renter_id
  JOIN users ou ON ou.id = b.owner_id
`;

// A booking blocks a car's dates once paid, or while its payment window is still open.
const BLOCKING_SQL = `(
  b.status IN ('confirmed', 'handed_over', 'in_progress')
  OR (b.status = 'pending_payment' AND b.expires_at > now())
)`;

// ----- Reading -----

export async function getBooking(id: string): Promise<Booking | null> {
  const result = await pool.query<Booking>(
    `SELECT ${BOOKING_COLUMNS} FROM bookings b WHERE b.id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getBookingItem(id: string): Promise<BookingListItem | null> {
  const result = await pool.query<BookingListItem>(`${LIST_SELECT} WHERE b.id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function listBookings(filters: {
  renterId?: string;
  ownerId?: string;
  status?: BookingStatus;
  hubId?: string;
  limit: number;
  offset: number;
}): Promise<{ items: BookingListItem[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.renterId) {
    params.push(filters.renterId);
    conditions.push(`b.renter_id = $${params.length}`);
  }
  if (filters.ownerId) {
    params.push(filters.ownerId);
    conditions.push(`b.owner_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`b.status = $${params.length}`);
  }
  if (filters.hubId) {
    params.push(filters.hubId);
    conditions.push(`b.hub_id = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM bookings b ${where}`,
    params,
  );
  params.push(filters.limit, filters.offset);
  const items = await pool.query<BookingListItem>(
    `${LIST_SELECT} ${where}
     ORDER BY b.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { items: items.rows, total: total.rows[0]?.count ?? 0 };
}

export async function listBlockedRanges(
  carId: string,
): Promise<Array<{ startDate: string; endDate: string }>> {
  const result = await pool.query<{ startDate: string; endDate: string }>(
    `SELECT to_char(b.start_date, 'YYYY-MM-DD') AS "startDate",
            to_char(b.end_date, 'YYYY-MM-DD') AS "endDate"
     FROM bookings b
     WHERE b.car_id = $1 AND b.end_date >= current_date AND ${BLOCKING_SQL}
     ORDER BY b.start_date`,
    [carId],
  );
  return result.rows;
}

export async function listPayments(bookingId: string): Promise<PaymentRecord[]> {
  const result = await pool.query<PaymentRecord>(
    `SELECT id, booking_id AS "bookingId", kind, provider,
            provider_reference AS "providerReference", amount_minor AS "amountMinor",
            currency, created_at AS "createdAt"
     FROM payments WHERE booking_id = $1 ORDER BY created_at`,
    [bookingId],
  );
  return result.rows;
}

export async function expireStaleBookings(): Promise<number> {
  const result = await pool.query(
    `UPDATE bookings SET status = 'expired', updated_at = now()
     WHERE status = 'pending_payment' AND expires_at <= now()`,
  );
  return result.rowCount ?? 0;
}

// ----- Creating a booking -----

export type CreateOutcome =
  | { ok: true; booking: Booking }
  | {
      ok: false;
      reason: 'not_bookable' | 'own_car' | 'days_out_of_range' | 'dates_taken' | 'too_large';
      minDays?: number;
      maxDays?: number;
    };

async function tryCreate(
  client: pg.PoolClient,
  input: {
    carId: string;
    renterId: string;
    startDate: string;
    endDate: string;
    holdMinutes: number;
    commissionBps: (accountType: AccountType) => number;
  },
  days: number,
): Promise<CreateOutcome> {
  // Lock the car's row so two people cannot book the same dates at the same moment.
  const carResult = await client.query<{
    ownerId: string;
    hubId: string;
    currency: string;
    dailyPriceMinor: number;
    depositMinor: number;
    minRentalDays: number;
    maxRentalDays: number;
    ownerAccountType: AccountType;
    available: boolean;
  }>(
    `SELECT c.owner_id AS "ownerId", c.hub_id AS "hubId", c.currency,
            c.daily_price_minor AS "dailyPriceMinor", c.deposit_minor AS "depositMinor",
            c.min_rental_days AS "minRentalDays", c.max_rental_days AS "maxRentalDays",
            u.account_type AS "ownerAccountType",
            (c.status = 'live' AND h.is_active AND u.is_active
             AND u.verification_status = 'verified') AS available
     FROM cars c
     JOIN users u ON u.id = c.owner_id
     JOIN hubs h ON h.id = c.hub_id
     WHERE c.id = $1
     FOR UPDATE OF c`,
    [input.carId],
  );
  const car = carResult.rows[0];
  if (!car || !car.available) {
    return { ok: false, reason: 'not_bookable' };
  }
  if (car.ownerId === input.renterId) {
    return { ok: false, reason: 'own_car' };
  }
  if (days < car.minRentalDays || days > car.maxRentalDays) {
    return {
      ok: false,
      reason: 'days_out_of_range',
      minDays: car.minRentalDays,
      maxDays: car.maxRentalDays,
    };
  }

  const commissionBps = input.commissionBps(car.ownerAccountType);
  const price = calculatePrice({
    dailyPriceMinor: car.dailyPriceMinor,
    days,
    depositMinor: car.depositMinor,
    commissionBps,
  });
  if (price.totalMinor > MAX_AMOUNT_MINOR) {
    return { ok: false, reason: 'too_large' };
  }

  const clash = await client.query(
    `SELECT 1 FROM bookings b
     WHERE b.car_id = $1 AND b.start_date < $3::date AND $2::date < b.end_date
       AND ${BLOCKING_SQL}
     LIMIT 1`,
    [input.carId, input.startDate, input.endDate],
  );
  if ((clash.rowCount ?? 0) > 0) {
    return { ok: false, reason: 'dates_taken' };
  }

  const inserted = await client.query<Booking>(
    `INSERT INTO bookings AS b
       (car_id, renter_id, owner_id, hub_id, start_date, end_date, days, currency,
        daily_price_minor, subtotal_minor, deposit_minor, commission_bps,
        commission_minor, owner_share_minor, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
             now() + make_interval(mins => $15::int))
     RETURNING ${BOOKING_COLUMNS}`,
    [
      input.carId,
      input.renterId,
      car.ownerId,
      car.hubId,
      input.startDate,
      input.endDate,
      days,
      car.currency,
      car.dailyPriceMinor,
      price.subtotalMinor,
      price.depositMinor,
      commissionBps,
      price.commissionMinor,
      price.ownerShareMinor,
      input.holdMinutes,
    ],
  );
  const booking = inserted.rows[0];
  if (!booking) {
    throw new Error('The booking was not created');
  }
  return { ok: true, booking };
}

export async function createBooking(input: {
  carId: string;
  renterId: string;
  startDate: string;
  endDate: string;
  holdMinutes: number;
  commissionBps: (accountType: AccountType) => number;
}): Promise<CreateOutcome> {
  const days = daysBetween(input.startDate, input.endDate);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const outcome = await tryCreate(client, input, days);
    await client.query(outcome.ok ? 'COMMIT' : 'ROLLBACK');
    return outcome;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ----- The steps of a booking's life -----

export type TransitionOutcome =
  | { ok: true; booking: Booking; refundMinor?: number }
  | {
      ok: false;
      reason: 'state' | 'expired' | 'too_early' | 'renter_not_verified' | 'deduction_too_large';
    };

// Locks the booking row, runs one step, and saves everything together. Returns null
// when the booking does not exist (or does not belong to the person asking).
async function withLockedBooking(
  bookingId: string,
  work: (client: pg.PoolClient, booking: Booking) => Promise<TransitionOutcome | null>,
): Promise<TransitionOutcome | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query<Booking>(
      `SELECT ${BOOKING_COLUMNS} FROM bookings b WHERE b.id = $1 FOR UPDATE`,
      [bookingId],
    );
    const booking = found.rows[0];
    const outcome = booking ? await work(client, booking) : null;
    await client.query('COMMIT');
    return outcome;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateBooking(
  client: pg.PoolClient,
  id: string,
  setSql: string,
  params: unknown[] = [],
): Promise<Booking> {
  const result = await client.query<Booking>(
    `UPDATE bookings b SET ${setSql}, updated_at = now()
     WHERE b.id = $1 RETURNING ${BOOKING_COLUMNS}`,
    [id, ...params],
  );
  const booking = result.rows[0];
  if (!booking) {
    throw new Error('The booking was not updated');
  }
  return booking;
}

async function recordPayment(
  client: pg.PoolClient,
  booking: Booking,
  kind: 'charge' | 'refund',
  provider: string,
  reference: string,
  amountMinor: number,
): Promise<void> {
  await client.query(
    `INSERT INTO payments (booking_id, kind, provider, provider_reference, amount_minor, currency)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [booking.id, kind, provider, reference, amountMinor, booking.currency],
  );
}

// The renter pays. The platform holds the money: the rental price waits in escrow
// and the deposit is held separately.
export function payBooking(args: {
  bookingId: string;
  renterId: string;
  provider: PaymentProvider;
}): Promise<TransitionOutcome | null> {
  return withLockedBooking(args.bookingId, async (client, booking) => {
    if (booking.renterId !== args.renterId) {
      return null;
    }
    if (booking.status !== 'pending_payment') {
      return { ok: false, reason: 'state' };
    }
    if (booking.expiresAt && booking.expiresAt.getTime() <= Date.now()) {
      await updateBooking(client, booking.id, `status = 'expired'`);
      return { ok: false, reason: 'expired' };
    }

    const total = booking.subtotalMinor + booking.depositMinor;
    const charge = await args.provider.charge({
      bookingId: booking.id,
      amountMinor: total,
      currency: booking.currency,
    });
    await recordPayment(client, booking, 'charge', args.provider.name, charge.reference, total);
    await postLedgerTransaction(client, {
      kind: 'payment_received',
      currency: booking.currency,
      bookingId: booking.id,
      createdBy: args.renterId,
      lines: [
        { account: 'platform_cash', amountMinor: total },
        { account: 'booking_escrow', amountMinor: -booking.subtotalMinor },
        { account: 'deposit_held', amountMinor: -booking.depositMinor },
      ],
    });

    const updated = await updateBooking(
      client,
      booking.id,
      `status = 'confirmed', paid_at = now(), expires_at = NULL`,
    );
    return { ok: true, booking: updated };
  });
}

// A hub manager hands the car to the renter and records its condition.
export function handoverBooking(args: {
  bookingId: string;
  staffId: string;
  odometerKm: number;
  fuelLevelPercent: number;
  notes: string;
}): Promise<TransitionOutcome | null> {
  return withLockedBooking(args.bookingId, async (client, booking) => {
    if (booking.status !== 'confirmed') {
      return { ok: false, reason: 'state' };
    }
    if (booking.startDate > todayIso()) {
      return { ok: false, reason: 'too_early' };
    }
    const renter = await client.query<{ ok: boolean }>(
      `SELECT (is_active AND verification_status = 'verified') AS ok FROM users WHERE id = $1`,
      [booking.renterId],
    );
    if (!renter.rows[0]?.ok) {
      return { ok: false, reason: 'renter_not_verified' };
    }

    const updated = await updateBooking(
      client,
      booking.id,
      `status = 'handed_over', handed_over_at = now(), handover_odometer_km = $2,
       handover_fuel_percent = $3, handover_notes = $4, handover_by = $5`,
      [args.odometerKm, args.fuelLevelPercent, args.notes, args.staffId],
    );
    return { ok: true, booking: updated };
  });
}

// The renter confirms they received the car. Only now is the owner's share released
// from escrow to the owner, and the commission is taken.
export function confirmReceipt(args: {
  bookingId: string;
  renterId: string;
}): Promise<TransitionOutcome | null> {
  return withLockedBooking(args.bookingId, async (client, booking) => {
    if (booking.renterId !== args.renterId) {
      return null;
    }
    if (booking.status !== 'handed_over') {
      return { ok: false, reason: 'state' };
    }

    await postLedgerTransaction(client, {
      kind: 'booking_released',
      currency: booking.currency,
      bookingId: booking.id,
      createdBy: args.renterId,
      lines: [
        { account: 'booking_escrow', amountMinor: booking.subtotalMinor },
        { account: 'owner_payable', amountMinor: -booking.ownerShareMinor, userId: booking.ownerId },
        { account: 'platform_revenue', amountMinor: -booking.commissionMinor },
      ],
    });
    const updated = await updateBooking(
      client,
      booking.id,
      `status = 'in_progress', receipt_confirmed_at = now()`,
    );
    return { ok: true, booking: updated };
  });
}

// A hub manager receives the car back. The deposit goes back to the renter, minus
// any damage deduction, which is paid to the owner.
export function returnBooking(args: {
  bookingId: string;
  staffId: string;
  provider: PaymentProvider;
  odometerKm: number;
  fuelLevelPercent: number;
  notes: string;
  deductionMinor: number;
  deductionReason?: string;
}): Promise<TransitionOutcome | null> {
  return withLockedBooking(args.bookingId, async (client, booking) => {
    if (booking.status !== 'in_progress') {
      return { ok: false, reason: 'state' };
    }
    if (args.deductionMinor > booking.depositMinor) {
      return { ok: false, reason: 'deduction_too_large' };
    }

    const refundMinor = booking.depositMinor - args.deductionMinor;
    if (refundMinor > 0) {
      const refund = await args.provider.refund({
        bookingId: booking.id,
        amountMinor: refundMinor,
        currency: booking.currency,
      });
      await recordPayment(client, booking, 'refund', args.provider.name, refund.reference, refundMinor);
    }
    await postLedgerTransaction(client, {
      kind: 'deposit_settled',
      currency: booking.currency,
      bookingId: booking.id,
      createdBy: args.staffId,
      note: args.deductionReason ?? null,
      lines: [
        { account: 'deposit_held', amountMinor: booking.depositMinor },
        { account: 'platform_cash', amountMinor: -refundMinor },
        { account: 'owner_payable', amountMinor: -args.deductionMinor, userId: booking.ownerId },
      ],
    });

    const updated = await updateBooking(
      client,
      booking.id,
      `status = 'completed', returned_at = now(), return_odometer_km = $2,
       return_fuel_percent = $3, return_notes = $4, return_by = $5,
       deposit_deduction_minor = $6, deduction_reason = $7`,
      [
        args.odometerKm,
        args.fuelLevelPercent,
        args.notes,
        args.staffId,
        args.deductionMinor,
        args.deductionReason ?? null,
      ],
    );
    return { ok: true, booking: updated, refundMinor };
  });
}

// Cancels a booking that has not been handed over yet and pays back what is due.
export function cancelBooking(args: {
  bookingId: string;
  by: 'renter' | 'owner' | 'staff';
  actorId: string;
  reason: string;
  provider: PaymentProvider;
}): Promise<TransitionOutcome | null> {
  return withLockedBooking(args.bookingId, async (client, booking) => {
    if (booking.status !== 'pending_payment' && booking.status !== 'confirmed') {
      return { ok: false, reason: 'state' };
    }

    const setSql = `status = 'cancelled', cancelled_at = now(), cancelled_by = $2,
                    cancellation_reason = $3, refund_minor = $4`;

    if (booking.status === 'pending_payment') {
      const updated = await updateBooking(client, booking.id, setSql, [
        args.actorId,
        args.reason,
        0,
      ]);
      return { ok: true, booking: updated, refundMinor: 0 };
    }

    const breakdown = cancellationBreakdown({
      by: args.by,
      subtotalMinor: booking.subtotalMinor,
      depositMinor: booking.depositMinor,
      commissionBps: booking.commissionBps,
      startDate: booking.startDate,
    });

    if (breakdown.refundMinor > 0) {
      const refund = await args.provider.refund({
        bookingId: booking.id,
        amountMinor: breakdown.refundMinor,
        currency: booking.currency,
      });
      await recordPayment(
        client,
        booking,
        'refund',
        args.provider.name,
        refund.reference,
        breakdown.refundMinor,
      );
    }
    await postLedgerTransaction(client, {
      kind: 'booking_cancelled',
      currency: booking.currency,
      bookingId: booking.id,
      createdBy: args.actorId,
      note: `${breakdown.policy}: ${args.reason}`,
      lines: [
        { account: 'booking_escrow', amountMinor: booking.subtotalMinor },
        { account: 'deposit_held', amountMinor: booking.depositMinor },
        { account: 'platform_cash', amountMinor: -breakdown.refundMinor },
        { account: 'owner_payable', amountMinor: -breakdown.ownerCompMinor, userId: booking.ownerId },
        { account: 'platform_revenue', amountMinor: -breakdown.commissionOnKeptMinor },
      ],
    });

    const updated = await updateBooking(client, booking.id, setSql, [
      args.actorId,
      args.reason,
      breakdown.refundMinor,
    ]);
    return { ok: true, booking: updated, refundMinor: breakdown.refundMinor };
  });
}

// File: backend/src/bookings/repository.ts
// END OF FILE