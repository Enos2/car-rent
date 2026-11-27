// Project: Via Nostra
// File: backend/src/server.ts
// Purpose: Starts the Via Nostra API: applies database migrations, then listens for
//          requests. Every minute it cancels unpaid bookings whose payment window
//          has passed. Shuts down cleanly when stopped.

import { buildApp } from './app.js';
import { expireStaleBookings } from './bookings/repository.js';
import { config } from './config.js';
import { pool, runMigrations } from './db.js';

const app = await buildApp();
let sweeper: NodeJS.Timeout | undefined;

async function shutdown(signal: string): Promise<void> {
  app.log.info(`${signal} received, shutting down`);
  if (sweeper) {
    clearInterval(sweeper);
  }
  await app.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await runMigrations(app.log);
  await app.listen({
    port: config.port,
    host: config.isProduction ? '0.0.0.0' : '127.0.0.1',
  });
  sweeper = setInterval(() => {
    expireStaleBookings().catch((error: unknown) => app.log.error(error));
  }, 60_000);
  sweeper.unref();
  app.log.info(`Via Nostra API running on http://localhost:${config.port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

// File: backend/src/server.ts
// END OF FILE