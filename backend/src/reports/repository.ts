// Project: Via Nostra
// File: backend/src/reports/repository.ts
// Purpose: Database work for reports: finding what a report is about, creating a
//          report, listing the moderation queue with readable names of what was
//          reported, and closing a report.

import { pool } from '../db.js';

export type ReportTarget = 'car' | 'user' | 'review' | 'post';
export type ReportReason =
  | 'scam_or_fake'
  | 'unsafe_or_damaged'
  | 'misleading_listing'
  | 'abusive_behaviour'
  | 'inappropriate_content'
  | 'other';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';

export type Report = {
  id: string;
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
};

export type ReportItem = Report & { reporterEmail: string; targetLabel: string | null };

const REPORT_COLUMNS = `
  r.id, r.reporter_id AS "reporterId", r.target_type AS "targetType", r.target_id AS "targetId",
  r.reason, r.details, r.status, r.resolution_note AS "resolutionNote",
  r.resolved_by AS "resolvedBy", r.resolved_at AS "resolvedAt", r.created_at AS "createdAt"
`;

// Who "owns" the thing being reported, so people cannot report themselves.
export async function findTargetOwner(
  type: ReportTarget,
  id: string,
): Promise<{ exists: boolean; ownerId: string | null }> {
  const queries: Record<ReportTarget, string> = {
    car: `SELECT owner_id AS owner FROM cars WHERE id = $1 AND status <> 'retired'`,
    user: `SELECT id AS owner FROM users WHERE id = $1`,
    review: `SELECT author_id AS owner FROM reviews WHERE id = $1`,
    post: `SELECT author_id AS owner FROM posts WHERE id = $1 AND status = 'published'`,
  };
  const result = await pool.query<{ owner: string }>(queries[type], [id]);
  const row = result.rows[0];
  return { exists: Boolean(row), ownerId: row?.owner ?? null };
}

export async function createReport(input: {
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details: string;
}): Promise<{ id: string }> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO reports (reporter_id, target_type, target_id, reason, details)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [input.reporterId, input.targetType, input.targetId, input.reason, input.details],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('The report was not saved');
  }
  return row;
}

export async function getReport(id: string): Promise<Report | null> {
  const result = await pool.query<Report>(
    `SELECT ${REPORT_COLUMNS} FROM reports r WHERE r.id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function listReports(filters: {
  status: ReportStatus;
  limit: number;
  offset: number;
}): Promise<{ items: ReportItem[]; total: number }> {
  const total = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM reports WHERE status = $1`,
    [filters.status],
  );
  const items = await pool.query<ReportItem>(
    `SELECT ${REPORT_COLUMNS},
            u.email AS "reporterEmail",
            CASE r.target_type
              WHEN 'car' THEN (SELECT c.year || ' ' || c.make || ' ' || c.model || ' (' || c.plate_number || ')'
                               FROM cars c WHERE c.id = r.target_id)
              WHEN 'user' THEN (SELECT t.full_name || ' <' || t.email || '>'
                                FROM users t WHERE t.id = r.target_id)
              WHEN 'review' THEN (SELECT left(COALESCE(v.comment, 'Rating ' || v.rating::text), 120)
                                  FROM reviews v WHERE v.id = r.target_id)
              WHEN 'post' THEN (SELECT p.title FROM posts p WHERE p.id = r.target_id)
            END AS "targetLabel"
     FROM reports r JOIN users u ON u.id = r.reporter_id
     WHERE r.status = $1
     ORDER BY r.created_at ASC
     LIMIT $2 OFFSET $3`,
    [filters.status, filters.limit, filters.offset],
  );
  return { items: items.rows, total: total.rows[0]?.count ?? 0 };
}

export async function resolveReport(input: {
  id: string;
  resolverId: string;
  outcome: 'resolved' | 'dismissed';
  note: string;
}): Promise<Report | null> {
  const result = await pool.query<{ id: string }>(
    `UPDATE reports
     SET status = $2::report_status, resolution_note = $3, resolved_by = $4, resolved_at = now()
     WHERE id = $1 AND status = 'open' RETURNING id`,
    [input.id, input.outcome, input.note, input.resolverId],
  );
  return result.rows[0] ? getReport(input.id) : null;
}

// File: backend/src/reports/repository.ts
// END OF FILE