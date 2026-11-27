// Project: Via Nostra
// File: frontend/lib/format.ts
// Purpose: Small helpers that turn data into text for people: money, dates, the
//          number of days between two dates and the labels of booking statuses.

import type { BookingStatus } from './types';

// Amounts are stored in the smallest unit (cents), so 4500 USD cents is $45.00.
export function formatMoney(amountMinor: number, currency: string): string {
  try {
    const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency });
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(amountMinor / 10 ** digits);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

export function formatDate(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(startIso: string, endIso: string): number {
  const milliseconds = Date.parse(`${endIso}T00:00:00Z`) - Date.parse(`${startIso}T00:00:00Z`);
  return Math.round(milliseconds / 86_400_000);
}

export const BOOKING_STATUS: Record<BookingStatus, { label: string; badge: string }> = {
  pending_payment: { label: 'Waiting for payment', badge: 'badge badge-warn' },
  confirmed: { label: 'Confirmed', badge: 'badge badge-ok' },
  handed_over: { label: 'Car handed over', badge: 'badge' },
  in_progress: { label: 'Rental in progress', badge: 'badge' },
  completed: { label: 'Completed', badge: 'badge badge-ok' },
  cancelled: { label: 'Cancelled', badge: 'badge badge-bad' },
  expired: { label: 'Expired', badge: 'badge badge-bad' },
};

// File: frontend/lib/format.ts
// END OF FILE