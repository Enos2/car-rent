// Project: Via Nostra
// File: backend/src/verification/requirements.ts
// Purpose: Defines which documents each kind of person must upload to be verified
//          (renter, owner or company) and checks which ones are still missing.

import type { User } from '../users/repository.js';

export const DOC_TYPES = [
  'national_id',
  'passport',
  'driving_licence',
  'selfie',
  'business_registration',
  'tax_certificate',
  'proof_of_address',
] as const;

export type DocType = (typeof DOC_TYPES)[number];
export type Kind = 'renter' | 'owner' | 'company';

export type Requirement = {
  key: string;
  label: string;
  anyOf: DocType[];
};

export function kindFor(user: User): Kind {
  if (user.accountType === 'company') {
    return 'company';
  }
  return user.roles.includes('owner') ? 'owner' : 'renter';
}

export function requirementsFor(user: User): Requirement[] {
  const requirements: Requirement[] = [
    {
      key: 'identity',
      label: user.accountType === 'company' ? 'ID of the company director' : 'Identity document',
      anyOf: ['national_id', 'passport'],
    },
    { key: 'selfie', label: 'Selfie holding your ID', anyOf: ['selfie'] },
  ];

  if (user.roles.includes('renter')) {
    requirements.push({
      key: 'licence',
      label: 'Driving licence',
      anyOf: ['driving_licence'],
    });
  }

  if (user.accountType === 'company') {
    requirements.push(
      {
        key: 'registration',
        label: 'Business registration certificate',
        anyOf: ['business_registration'],
      },
      { key: 'tax', label: 'Tax certificate', anyOf: ['tax_certificate'] },
    );
  }

  return requirements;
}

export function missingRequirements(user: User, uploaded: readonly DocType[]): Requirement[] {
  const have = new Set(uploaded);
  return requirementsFor(user).filter((requirement) => !requirement.anyOf.some((type) => have.has(type)));
}

// File: backend/src/verification/requirements.ts
// END OF FILE
