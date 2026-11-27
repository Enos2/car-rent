// Project: Via Nostra
// File: backend/src/audit/audit.ts
// Purpose: Writes entries to the audit log, the permanent record of who did what.
//          Every important staff action calls recordAudit.

import type pg from 'pg';
import { pool } from '../db.js';

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

export async function recordAudit(
  entry: AuditEntry,
  executor: pg.Pool | pg.PoolClient = pool,
): Promise<void> {
  await (executor as pg.Pool).query(
    `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, metadata, ip)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      entry.actorId,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      JSON.stringify(entry.metadata ?? {}),
      entry.ip ?? null,
    ],
  );
}

// File: backend/src/audit/audit.ts
// END OF FILE
