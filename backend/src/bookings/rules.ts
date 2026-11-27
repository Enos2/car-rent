// Project: Via Nostra
// File: backend/src/bookings/rules.ts
// Purpose: The business rules for bookings: statuses, date helpers, how a price and
//          the commission are calculated, and how much a renter gets back when a
//          booking is cancelled.

export const BOOKING_STATUSES = [
  'pending_payment',
  'confirmed',
  'handed_over',
  'in_progress',
  'completed',
  'cancelled',
  'expired',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const MAX_ADVANCE_DAYS = 180;
// The largest amount the database can store in one money column.
export const MAX_AMOUNT_MINOR = 2_000_000_000;
export const FULL_REFUND_HOURS = 48;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(startIso: string, endIso: string): number {
  const milliseconds = Date.parse(`${endIso}T00:00:00Z`) - Date.parse(`${startIso}T00:00:00Z`);
  return Math.round(milliseconds / 86_400_000);
}

export type Price = {
  subtotalMinor: number;
  depositMinor: number;
  commissionMinor: number;
  ownerShareMinor: number;
  totalMinor: number;
};

// The renter pays subtotal + deposit. Via Nostra keeps the commission from the
// subtotal; the owner receives the rest. The deposit is returned after the return.
export function calculatePrice(input: {
  dailyPriceMinor: number;
  days: number;
  depositMinor: number;
  commissionBps: number;
}): Price {
  const subtotalMinor = input.dailyPriceMinor * input.days;
  const commissionMinor = Math.floor((subtotalMinor * input.commissionBps) / 10_000);
  return {
    subtotalMinor,
    depositMinor: input.depositMinor,
    commissionMinor,
    ownerShareMinor: subtotalMinor - commissionMinor,
    totalMinor: subtotalMinor + input.depositMinor,
  };
}

export type CancellationBreakdown = {
  policy: 'full_refund' | 'half_refund' | 'no_refund';
  refundMinor: number;
  keptMinor: number;
  commissionOnKeptMinor: number;
  ownerCompMinor: number;
};

// Renters get a full refund more than 48 hours before the start, half of the rental
// plus the deposit closer to the start, and only the deposit once it has started.
// If the owner or staff cancel, the renter always gets everything back.
export function cancellationBreakdown(input: {
  by: 'renter' | 'owner' | 'staff';
  subtotalMinor: number;
  depositMinor: number;
  commissionBps: number;
  startDate: string;
  now?: Date;
}): CancellationBreakdown {
  let refundedSubtotal = input.subtotalMinor;
  let policy: CancellationBreakdown['policy'] = 'full_refund';

  if (input.by === 'renter') {
    const now = input.now ?? new Date();
    const hoursUntilStart = (Date.parse(`${input.startDate}T00:00:00Z`) - now.getTime()) / 3_600_000;
    if (hoursUntilStart >= FULL_REFUND_HOURS) {
      policy = 'full_refund';
    } else if (hoursUntilStart > 0) {
      refundedSubtotal = Math.floor(input.subtotalMinor / 2);
      policy = 'half_refund';
    } else {
      refundedSubtotal = 0;
      policy = 'no_refund';
    }
  }

  const keptMinor = input.subtotalMinor - refundedSubtotal;
  const commissionOnKeptMinor = Math.floor((keptMinor * input.commissionBps) / 10_000);
  return {
    policy,
    refundMinor: refundedSubtotal + input.depositMinor,
    keptMinor,
    commissionOnKeptMinor,
    ownerCompMinor: keptMinor - commissionOnKeptMinor,
  };
}

// File: backend/src/bookings/rules.ts
// END OF FILE