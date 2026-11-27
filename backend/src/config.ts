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
};

// File: backend/src/config.ts
// END OF FILE
