// Project: Via Nostra
// File: frontend/lib/format.ts
// Purpose: Small helpers that turn data into text for people: money, dates, sizes,
//          and the labels and colours of every status, document type, role and rule
//          the pages share.

import type { BookingStatus, CarStatus, VerificationStatus } from './types';

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

// Turns an amount in the smallest unit into the text shown in a form field.
export function fromMinor(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(startIso: string, endIso: string): number {
  const milliseconds = Date.parse(`${endIso}T00:00:00Z`) - Date.parse(`${startIso}T00:00:00Z`);
  return Math.round(milliseconds / 86_400_000);
}

// A page's search parameters, and the first value of one of them.
export type SearchParams = Record<string, string | string[] | undefined>;

export function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

type Label = { label: string; badge: string };

export const BOOKING_STATUS: Record<BookingStatus, Label> = {
  pending_payment: { label: 'Waiting for payment', badge: 'badge badge-warn' },
  confirmed: { label: 'Confirmed', badge: 'badge badge-ok' },
  handed_over: { label: 'Car handed over', badge: 'badge' },
  in_progress: { label: 'Rental in progress', badge: 'badge' },
  completed: { label: 'Completed', badge: 'badge badge-ok' },
  cancelled: { label: 'Cancelled', badge: 'badge badge-bad' },
  expired: { label: 'Expired', badge: 'badge badge-bad' },
};

export const CAR_STATUS: Record<CarStatus, Label> = {
  draft: { label: 'Draft', badge: 'badge' },
  submitted: { label: 'In review', badge: 'badge badge-warn' },
  rejected: { label: 'Needs changes', badge: 'badge badge-bad' },
  awaiting_dropoff: { label: 'Waiting for drop-off', badge: 'badge badge-warn' },
  live: { label: 'Live', badge: 'badge badge-ok' },
  paused: { label: 'Paused', badge: 'badge' },
  suspended: { label: 'Suspended', badge: 'badge badge-bad' },
  retired: { label: 'Removed', badge: 'badge' },
};

export const VERIFICATION_STATUS: Record<VerificationStatus, Label> = {
  unverified: { label: 'Not verified yet', badge: 'badge badge-warn' },
  pending: { label: 'Verification in review', badge: 'badge' },
  verified: { label: 'Verified', badge: 'badge badge-ok' },
  rejected: { label: 'Verification rejected', badge: 'badge badge-bad' },
};

export const PAYOUT_STATUS: Record<string, Label> = {
  requested: { label: 'Requested', badge: 'badge badge-warn' },
  paid: { label: 'Paid', badge: 'badge badge-ok' },
  rejected: { label: 'Rejected', badge: 'badge badge-bad' },
};

export const DOC_LABELS: Record<string, string> = {
  national_id: 'National ID',
  passport: 'Passport',
  driving_licence: 'Driving licence',
  selfie: 'Selfie holding your ID',
  business_registration: 'Business registration certificate',
  tax_certificate: 'Tax certificate',
  proof_of_address: 'Proof of address',
  logbook: 'Logbook',
  registration: 'Vehicle registration',
  insurance: 'Insurance certificate',
};

export const ROLE_LABELS: Record<string, string> = {
  renter: 'Renter',
  owner: 'Owner',
  support_agent: 'Support agent',
  verification_officer: 'Verification officer',
  hub_manager: 'Hub manager',
  finance_admin: 'Finance admin',
  content_moderator: 'Content moderator',
  super_admin: 'Super admin',
};

export const STAFF_ROLE_VALUES = [
  'support_agent',
  'verification_officer',
  'hub_manager',
  'finance_admin',
  'content_moderator',
  'super_admin',
] as const;

// These mirror the rules in the backend, so the pages only offer actions that work.
export const CAR_DETAILS_EDITABLE: readonly CarStatus[] = [
  'draft',
  'rejected',
  'awaiting_dropoff',
  'live',
  'paused',
];
export const CAR_IDENTITY_EDITABLE: readonly CarStatus[] = ['draft', 'rejected'];
export const CAR_DOCUMENTS_EDITABLE: readonly CarStatus[] = ['draft', 'rejected'];
export const CAR_PHOTOS_EDITABLE: readonly CarStatus[] = ['draft', 'rejected', 'paused'];
export const CAR_RETIRABLE: readonly CarStatus[] = [
  'draft',
  'rejected',
  'paused',
  'awaiting_dropoff',
];

// File: frontend/lib/format.ts
// END OF FILE