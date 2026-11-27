// Project: Via Nostra
// File: backend/src/payouts/repository.ts
// Purpose: Database work for owner payouts: requesting a payout (the money is set
//          aside at once so it cannot be spent twice), marking it paid, rejecting it
//          and returning the money, and listing payouts. Every step writes the ledger.

import type pg from 'pg';
import { pool } from '../db.js';
import { postLedgerTransaction } from '../payments/ledger.js';
import type { PaymentProvider } from '../payments/provider.js';

export type Payout = {
  id: string;
  ownerId: string;
  amountMinor: number;
  currency: string;
  status: 'requested' | 'paid' | 'rejected';
  destination: string;
  providerReference: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
};

const PAYOUT_COLUMNS = `
  id, owner_id AS "ownerId", amount_minor AS "amountMinor", currency, status, destination,
  provider_reference AS "providerReference", reviewed_by AS "reviewedBy",
  reviewed_at AS "reviewedAt", rejection_reason AS "rejectionReason", created_at AS "createdAt"
`;

export async function listPayouts(filters: {
  ownerId?: string;
  status?: Payout['status'];
  limit: number;
  offset: number;
}): Promise<{ items: Payout[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.ownerId) {
    params.push(filters.ownerId);
    conditions.push(`owner_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM payouts ${where}`,
    params,
  );
  params.push(filters.limit, filters.offset);
  const items = await pool.query<Payout>(
    `SELECT ${PAYOUT_COLUMNS} FROM payouts ${where}
     ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { items: items.rows, total: total.rows[0]?.count ?? 0 };
}

export type RequestOutcome =
  | { ok: true; payout: Payout }
  | { ok: false; reason: 'insufficient'; availableMinor: number };

export async function requestPayout(input: {
  ownerId: string;
  amountMinor: number;
  currency: string;
  destination: string;
}): Promise<RequestOutcome> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the owner so two requests at the same moment cannot spend the same money.
    await client.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [input.ownerId]);

    const balance = await client.query<{ available: number }>(
      `SELECT COALESCE(-SUM(amount_minor), 0)::int AS available
       FROM ledger_entries
       WHERE user_id = $1 AND account = 'owner_payable' AND currency = $2`,
      [input.ownerId, input.currency],
    );
    const available = balance.rows[0]?.available ?? 0;
    if (input.amountMinor > available) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'insufficient', availableMinor: available };
    }

    const inserted = await client.query<Payout>(
      `INSERT INTO payouts (owner_id, amount_minor, currency, destination)
       VALUES ($1, $2, $3, $4) RETURNING ${PAYOUT_COLUMNS}`,
      [input.ownerId, input.amountMinor, input.currency, input.destination],
    );
    const payout = inserted.rows[0];
    if (!payout) {
      throw new Error('The payout was not created');
    }
    await postLedgerTransaction(client, {
      kind: 'payout_requested',
      currency: input.currency,
      payoutId: payout.id,
      createdBy: input.ownerId,
      lines: [
        { account: 'owner_payable', amountMinor: input.amountMinor, userId: input.ownerId },
        { account: 'payout_pending', amountMinor: -input.amountMinor, userId: input.ownerId },
      ],
    });
    await client.query('COMMIT');
    return { ok: true, payout };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export type DecisionOutcome =
  | { ok: true; payout: Payout }
  | { ok: false; reason: 'not_found' | 'state' | 'own_payout' };

async function decide(
  payoutId: string,
  reviewerId: string,
  work: (client: pg.PoolClient, payout: Payout) => Promise<Payout>,
): Promise<DecisionOutcome> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query<Payout>(
      `SELECT ${PAYOUT_COLUMNS} FROM payouts WHERE id = $1 FOR UPDATE`,
      [payoutId],
    );
    const payout = found.rows[0];
    if (!payout) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'not_found' };
    }
    if (payout.ownerId === reviewerId) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'own_payout' };
    }
    if (payout.status !== 'requested') {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'state' };
    }
    const updated = await work(client, payout);
    await client.query('COMMIT');
    return { ok: true, payout: updated };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export function markPayoutPaid(
  payoutId: string,
  reviewerId: string,
  provider: PaymentProvider,
): Promise<DecisionOutcome> {
  return decide(payoutId, reviewerId, async (client, payout) => {
    const sent = await provider.payout({
      payoutId: payout.id,
      amountMinor: payout.amountMinor,
      currency: payout.currency,
      destination: payout.destination,
    });
    await postLedgerTransaction(client, {
      kind: 'payout_paid',
      currency: payout.currency,
      payoutId: payout.id,
      createdBy: reviewerId,
      lines: [
        { account: 'payout_pending', amountMinor: payout.amountMinor, userId: payout.ownerId },
        { account: 'platform_cash', amountMinor: -payout.amountMinor },
      ],
    });
    const updated = await client.query<Payout>(
      `UPDATE payouts SET status = 'paid', provider_reference = $2, reviewed_by = $3,
                          reviewed_at = now(), updated_at = now()
       WHERE id = $1 RETURNING ${PAYOUT_COLUMNS}`,
      [payout.id, sent.reference, reviewerId],
    );
    const row = updated.rows[0];
    if (!row) {
      throw new Error('The payout was not updated');
    }
    return row;
  });
}

export function rejectPayout(
  payoutId: string,
  reviewerId: string,
  reason: string,
): Promise<DecisionOutcome> {
  return decide(payoutId, reviewerId, async (client, payout) => {
    await postLedgerTransaction(client, {
      kind: 'payout_rejected',
      currency: payout.currency,
      payoutId: payout.id,
      createdBy: reviewerId,
      note: reason,
      lines: [
        { account: 'payout_pending', amountMinor: payout.amountMinor, userId: payout.ownerId },
        { account: 'owner_payable', amountMinor: -payout.amountMinor, userId: payout.ownerId },
      ],
    });
    const updated = await client.query<Payout>(
      `UPDATE payouts SET status = 'rejected', rejection_reason = $2, reviewed_by = $3,
                          reviewed_at = now(), updated_at = now()
       WHERE id = $1 RETURNING ${PAYOUT_COLUMNS}`,
      [payout.id, reason, reviewerId],
    );
    const row = updated.rows[0];
    if (!row) {
      throw new Error('The payout was not updated');
    }
    return row;
  });
}

// File: backend/src/payouts/repository.ts
// END OF FILE