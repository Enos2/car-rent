// Project: Via Nostra
// File: backend/src/cars/rules.ts
// Purpose: The fixed lists and business rules for cars: statuses, allowed values,
//          which documents and photos are needed before a car can be submitted,
//          and the date helpers used to check insurance.

export const CAR_STATUSES = [
  'draft',
  'submitted',
  'rejected',
  'awaiting_dropoff',
  'live',
  'paused',
  'suspended',
  'retired',
] as const;
export type CarStatus = (typeof CAR_STATUSES)[number];

export const TRANSMISSIONS = ['manual', 'automatic'] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];

export const FUEL_TYPES = ['petrol', 'diesel', 'hybrid', 'electric'] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export const CAR_DOC_TYPES = ['logbook', 'registration', 'insurance'] as const;
export type CarDocType = (typeof CAR_DOC_TYPES)[number];

export const MIN_LISTING_PHOTOS = 3;
export const MAX_LISTING_PHOTOS = 10;
export const MIN_INSPECTION_PHOTOS = 4;
export const MAX_INSPECTION_PHOTOS = 20;
export const MIN_INSURANCE_DAYS_AHEAD = 30;

// Owners can change the basic identity of a car only before it is approved.
export const IDENTITY_EDITABLE: readonly CarStatus[] = ['draft', 'rejected'];
// Description and prices can be changed in these statuses.
export const DETAILS_EDITABLE: readonly CarStatus[] = [
  'draft',
  'rejected',
  'awaiting_dropoff',
  'live',
  'paused',
];
// Documents can be changed only before submission.
export const DOCUMENTS_EDITABLE: readonly CarStatus[] = ['draft', 'rejected'];
// Listing photos can be changed in these statuses.
export const PHOTOS_EDITABLE: readonly CarStatus[] = ['draft', 'rejected', 'paused'];
// A car can be removed in these statuses (a live car must be paused first).
export const RETIRABLE: readonly CarStatus[] = ['draft', 'rejected', 'paused', 'awaiting_dropoff'];

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAheadIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

export type ReadinessDocument = { docType: string; expiresOn: string | null };

// Checks whether a car has everything needed to be submitted for review.
export function checkReadiness(
  documents: readonly ReadinessDocument[],
  listingPhotoCount: number,
): { ready: boolean; problems: string[] } {
  const problems: string[] = [];

  for (const type of CAR_DOC_TYPES) {
    if (!documents.some((document) => document.docType === type)) {
      problems.push(`Upload the ${type} document`);
    }
  }

  const insurance = documents.find((document) => document.docType === 'insurance');
  if (insurance && (!insurance.expiresOn || insurance.expiresOn < daysAheadIso(MIN_INSURANCE_DAYS_AHEAD))) {
    problems.push(`Insurance must be valid for at least ${MIN_INSURANCE_DAYS_AHEAD} more days`);
  }

  if (listingPhotoCount < MIN_LISTING_PHOTOS) {
    problems.push(`Add at least ${MIN_LISTING_PHOTOS} photos of the car`);
  }

  return { ready: problems.length === 0, problems };
}

// File: backend/src/cars/rules.ts
// END OF FILE