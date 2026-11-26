// File: backend/src/auth/schemas.ts
// Purpose: Describes and validates what a person must send to sign up or log in.
//          Staff roles can never be requested at sign-up.

import { z } from 'zod';

const email = z.string().trim().toLowerCase().max(255).pipe(z.email());

export const registerSchema = z
  .strictObject({
    email,
    password: z
      .string()
      .min(8)
      .max(64)
      .regex(/[A-Za-z]/, 'must contain at least one letter')
      .regex(/\d/, 'must contain at least one number'),
    fullName: z.string().trim().min(1).max(255),
    accountType: z.enum(['individual', 'company']),
    companyName: z.string().trim().min(1).max(255).optional(),
    // A person may be a renter, an owner, or both.
    roles: z.array(z.enum(['renter', 'owner'])).min(1).max(2),
  })
  .refine((data) => data.accountType !== 'company' || Boolean(data.companyName), {
    path: ['companyName'],
    message: 'is required for company accounts',
  });

export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1).max(64),
});

// File: backend/src/auth/schemas.ts
// END OF FILE
