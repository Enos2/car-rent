// Project: Via Nostra
// File: backend/src/health/routes.ts
// Purpose: Provides GET /health so we (and later our hosting service) can confirm
//          that the API and its database are running.

import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_request, reply) => {
    let database = 'down';
    try {
      await pool.query('SELECT 1');
      database = 'up';
    } catch (error) {
      app.log.error(error);
    }

    const healthy = database === 'up';
    return reply.code(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      service: 'vianostra-api',
      database,
      time: new Date().toISOString(),
    });
  });
}

// File: backend/src/health/routes.ts
// END OF FILE
