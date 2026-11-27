// Project: Via Nostra
// File: backend/src/config.ts
// Purpose: Reads the settings from the .env file, checks that they are valid and
//          shares them with the rest of the API. A wrong or missing setting stops
//          the server at startup with a clear message.

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'is required'),
  DATABASE_SSL: z.enum(['true', 'false']).default('true'),
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().min(60).default(3600),
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(20).default(5),
  PAYMENT_PROVIDER: z.enum(['test']).default('test'),
  COMMISSION_BPS_INDIVIDUAL: z.coerce.number().int().min(0).max(5000).default(2000),
  COMMISSION_BPS_COMPANY: z.coerce.number().int().min(0).max(5000).default(1500),
  BOOKING_HOLD_MINUTES: z.coerce.number().int().min(5).max(240).default(30),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid or missing settings in backend/.env:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

// The test payment provider pretends every payment works. It must never run in production.
if (env.NODE_ENV === 'production' && env.PAYMENT_PROVIDER === 'test') {
  console.error('PAYMENT_PROVIDER=test is not allowed when NODE_ENV=production.');
  process.exit(1);
}

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  corsOrigins: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
  databaseUrl: env.DATABASE_URL,
  databaseSsl: env.DATABASE_SSL === 'true',
  jwtSecret: env.JWT_SECRET,
  jwtExpiresInSeconds: env.JWT_EXPIRES_IN_SECONDS,
  uploadDir: env.UPLOAD_DIR,
  maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
  paymentProvider: env.PAYMENT_PROVIDER,
  commissionBpsIndividual: env.COMMISSION_BPS_INDIVIDUAL,
  commissionBpsCompany: env.COMMISSION_BPS_COMPANY,
  bookingHoldMinutes: env.BOOKING_HOLD_MINUTES,
};

// File: backend/src/config.ts
// END OF FILE