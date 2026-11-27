// Project: Via Nostra
// File: backend/src/app.ts
// Purpose: Builds the API: security headers, CORS, request-rate limits, file
//          uploads, login tokens, error handling and all routes under /api/v1.

import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import type { FastifyError, FastifyInstance } from 'fastify';
import { adminUserRoutes } from './admin/users.routes.js';
import { authRoutes } from './auth/routes.js';
import { adminBookingRoutes } from './bookings/admin.routes.js';
import { bookingRoutes } from './bookings/routes.js';
import { adminCarRoutes } from './cars/admin.routes.js';
import { ownerCarRoutes } from './cars/owner.routes.js';
import { publicCarRoutes } from './cars/public.routes.js';
import { config } from './config.js';
import { healthRoutes } from './health/routes.js';
import { hubRoutes } from './hubs/routes.js';
import { payoutRoutes } from './payouts/routes.js';
import { verificationRoutes } from './verification/routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: config.isProduction
      ? true
      : {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname' },
          },
        },
    trustProxy: config.isProduction,
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });
  await app.register(jwt, { secret: config.jwtSecret });
  await app.register(multipart, {
    limits: { fileSize: config.maxUploadBytes, files: 1, fields: 5 },
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      request.log.error(error);
      return reply
        .code(500)
        .send({ error: 'Internal Server Error', message: 'Something went wrong' });
    }
    return reply.code(statusCode).send({ error: error.name, message: error.message });
  });

  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(hubRoutes, { prefix: '/api/v1' });
  await app.register(verificationRoutes, { prefix: '/api/v1' });
  await app.register(adminUserRoutes, { prefix: '/api/v1' });
  await app.register(ownerCarRoutes, { prefix: '/api/v1' });
  await app.register(publicCarRoutes, { prefix: '/api/v1' });
  await app.register(adminCarRoutes, { prefix: '/api/v1' });
  await app.register(bookingRoutes, { prefix: '/api/v1' });
  await app.register(adminBookingRoutes, { prefix: '/api/v1' });
  await app.register(payoutRoutes, { prefix: '/api/v1' });

  return app;
}

// File: backend/src/app.ts
// END OF FILE