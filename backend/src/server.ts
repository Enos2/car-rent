// File: backend/src/server.ts
// Purpose: Starts the Via Nostra API: applies database migrations, then listens
//          for requests. Shuts down cleanly when stopped.

import { buildApp } from './app.js';
import { config } from './config.js';
import { pool, runMigrations } from './db.js';

const app = await buildApp();

async function shutdown(signal: string): Promise<void> {
  app.log.info(`${signal} received, shutting down`);
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
  app.log.info(`Via Nostra API running on http://localhost:${config.port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

// File: backend/src/server.ts
// END OF FILE
