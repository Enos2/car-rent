// Project: Via Nostra
// File: backend/src/verification/repository.ts
// Purpose: All database queries for identity verification: requests, uploaded
//          document records, the staff review queue and the approve or reject step.

import { pool } from '../db.js';
import { isUniqueViolation } from '../http.js';
import type { DocType, Kind } from './requirements.js';

export type RequestStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export type VerificationRequest = {
  id: string;
  userId: string;
  kind: Kind;
  status: RequestStatus;
  submittedAt: Date | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
};

export type VerificationDocument = {
  id: string;
  requestId: string;
  userId: string;
  docType: DocType;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
};

export type QueueItem = {
  id: string;
  userId: string;
  kind: Kind;
  status: RequestStatus;
  submittedAt: Date | null;
  email: string;
  fullName: string;
  companyName: string | null;
};

const REQUEST_COLUMNS = `
  id,
  user_id AS "userId",
  kind,
  status,
  submitted_at AS "submittedAt",
  reviewed_by AS "reviewedBy",
  reviewed_at AS "reviewedAt",
  rejection_reason AS "rejectionReason",
  created_at AS "createdAt"
`;

const DOC_COLUMNS = `
  id,
  request_id AS "requestId",
  user_id AS "userId",
  doc_type AS "docType",
  original_name AS "originalName",
  mime_type AS "mimeType",
  size_bytes AS "sizeBytes",
  created_at AS "createdAt"
`;

export async function getLatestRequest(userId: string): Promise<VerificationRequest | null> {
  const result = await pool.query<VerificationRequest>(
    `SELECT ${REQUEST_COLUMNS} FROM verification_requests
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

async function getOpenRequest(userId: string): Promise<VerificationRequest | null> {
  const result = await pool.query<VerificationRequest>(
    `SELECT ${REQUEST_COLUMNS} FROM verification_requests
     WHERE user_id = $1 AND status IN ('draft', 'pending')`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function getOrCreateOpenRequest(
  userId: string,
  kind: Kind,
): Promise<VerificationRequest> {
  const existing = await getOpenRequest(userId);
  if (existing) {
    return existing;
  }
  try {
    const result = await pool.query<VerificationRequest>(
      `INSERT INTO verification_requests (user_id, kind) VALUES ($1, $2)
       RETURNING ${REQUEST_COLUMNS}`,
      [userId, kind],
    );
    const created = result.rows[0];
    if (!created) {
      throw new Error('The verification request was not created');
    }
    return created;
  } catch (error) {
    // Two uploads at the same moment: the database allows only one open request.
    if (isUniqueViolation(error)) {
      const again = await getOpenRequest(userId);
      if (again) {
        return again;
      }
    }
    throw error;
  }
}

export async function getRequest(id: string): Promise<VerificationRequest | null> {
  const result = await pool.query<VerificationRequest>(
    `SELECT ${REQUEST_COLUMNS} FROM verification_requests WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function listDocuments(requestId: string): Promise<VerificationDocument[]> {
  const result = await pool.query<VerificationDocument>(
    `SELECT ${DOC_COLUMNS} FROM verification_documents
     WHERE request_id = $1 ORDER BY created_at`,
    [requestId],
  );
  return result.rows;
}

export async function upsertDocument(input: {
  requestId: string;
  userId: string;
  docType: DocType;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{ document: VerificationDocument; replacedKey: string | null }> {
  const previous = await pool.query<{ storageKey: string }>(
    `SELECT storage_key AS "storageKey" FROM verification_documents
     WHERE request_id = $1 AND doc_type = $2`,
    [input.requestId, input.docType],
  );

  const result = await pool.query<VerificationDocument>(
    `INSERT INTO verification_documents
       (request_id, user_id, doc_type, storage_key, original_name, mime_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (request_id, doc_type) DO UPDATE SET
       storage_key = EXCLUDED.storage_key,
       original_name = EXCLUDED.original_name,
       mime_type = EXCLUDED.mime_type,
       size_bytes = EXCLUDED.size_bytes,
       created_at = now()
     RETURNING ${DOC_COLUMNS}`,
    [
      input.requestId,
      input.userId,
      input.docType,
      input.storageKey,
      input.originalName,
      input.mimeType,
      input.sizeBytes,
    ],
  );
  const document = result.rows[0];
  if (!document) {
    throw new Error('The document was not saved');
  }
  return { document, replacedKey: previous.rows[0]?.storageKey ?? null };
}

export async function getDocumentFile(
  id: string,
): Promise<{ storageKey: string; mimeType: string; userId: string } | null> {
  const result = await pool.query<{ storageKey: string; mimeType: string; userId: string }>(
    `SELECT storage_key AS "storageKey", mime_type AS "mimeType", user_id AS "userId"
     FROM verification_documents WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function submitRequest(
  requestId: string,
  userId: string,
): Promise<VerificationRequest | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query<VerificationRequest>(
      `UPDATE verification_requests
       SET status = 'pending', submitted_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'draft'
       RETURNING ${REQUEST_COLUMNS}`,
      [requestId],
    );
    const row = updated.rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query(
      `UPDATE users SET verification_status = 'pending', updated_at = now() WHERE id = $1`,
      [userId],
    );
    await client.query('COMMIT');
    return row;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function decideRequest(args: {
  id: string;
  reviewerId: string;
  decision: 'approved' | 'rejected';
  reason?: string;
}): Promise<VerificationRequest | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query<VerificationRequest>(
      `UPDATE verification_requests
       SET status = $2, reviewed_by = $3, reviewed_at = now(),
           rejection_reason = $4, updated_at = now()
       WHERE id = $1 AND status = 'pending'
       RETURNING ${REQUEST_COLUMNS}`,
      [args.id, args.decision, args.reviewerId, args.reason ?? null],
    );
    const row = updated.rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query(
      `UPDATE users SET verification_status = $2, updated_at = now() WHERE id = $1`,
      [row.userId, args.decision === 'approved' ? 'verified' : 'rejected'],
    );
    await client.query('COMMIT');
    return row;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listRequests(filters: {
  status: RequestStatus;
  limit: number;
  offset: number;
}): Promise<{ items: QueueItem[]; total: number }> {
  const total = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM verification_requests WHERE status = $1`,
    [filters.status],
  );
  const items = await pool.query<QueueItem>(
    `SELECT r.id, r.user_id AS "userId", r.kind, r.status,
            r.submitted_at AS "submittedAt",
            u.email, u.full_name AS "fullName", u.company_name AS "companyName"
     FROM verification_requests r JOIN users u ON u.id = r.user_id
     WHERE r.status = $1
     ORDER BY r.submitted_at ASC NULLS LAST, r.created_at ASC
     LIMIT $2 OFFSET $3`,
    [filters.status, filters.limit, filters.offset],
  );
  return { items: items.rows, total: total.rows[0]?.count ?? 0 };
}

// File: backend/src/verification/repository.ts
// END OF FILE
