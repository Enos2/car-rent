// File: backend/src/db.ts
// Purpose: Connects to the PostgreSQL database and applies the table definitions
//          in the migrations folder (in order, once each) when the API starts.

import { readdir, readFile } from 'node:fs/promises';
import type { FastifyBaseLogger } from 'fastify';
import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl,
  max: 10,
});

// An idle connection can be closed by the database host; do not crash because of it.
pool.on('error', (error) => {
  console.error('Database connection error:', error.message);
});

export async function runMigrations(log: FastifyBaseLogger): Promise<void> {
  const directory = new URL('../migrations/', import.meta.url);
  const client = await pool.connect();
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const done = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const applied = new Set(done.rows.map((row) => row.name));

    const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }
      // Windows PowerShell adds an invisible marker at the start of files; remove it.
      const sql = (await readFile(new URL(file, directory), 'utf8')).replace(/^\uFEFF/, '');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        log.info(`Applied database migration ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
  }
}

// File: backend/src/db.ts
// END OF FILE
