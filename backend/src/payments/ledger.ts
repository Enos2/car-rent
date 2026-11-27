// Project: Via Nostra
// File: backend/src/payments/ledger.ts
// Purpose: Writes to and reads from the ledger, the permanent record of every
//          movement of money. Each transaction must add up to zero, or it is refused.

import type pg from 'pg';
import { pool } from '../db.js';

export type LedgerAccount =
  | 'platform_cash'
  | 'booking_escrow'
  | 'deposit_held'
  | 'owner_payable'
  | 'payout_pending'
  | 'platform_revenue';

export type LedgerLine = {
  account: LedgerAccount;
  amountMinor: number;
  userId?: string | null;
};

// Saves one balanced transaction. Returns its id, or null when every amount was zero.
export async function postLedgerTransaction(
  client: pg.PoolClient,
  input: {
    kind: string;
    currency: string;
    bookingId?: string | null;
    payoutId?: string | null;
    createdBy?: string | null;
    note?: string | null;
    lines: LedgerLine[];
  },
): Promise<string | null> {
  const lines = input.lines.filter((line) => line.amountMinor !== 0);
  if (lines.length === 0) {
    return null;
  }
  const total = lines.reduce((sum, line) => sum + line.amountMinor, 0);
  if (total !== 0) {
    throw new Error(`Unbalanced ledger transaction "${input.kind}": off by ${total}`);
  }

  const created = await client.query<{ id: string }>(
    `INSERT INTO ledger_transactions (kind, booking_id, payout_id, currency, note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      input.kind,
      input.bookingId ?? null,
      input.payoutId ?? null,
      input.currency,
      input.note ?? null,
      input.createdBy ?? null,
    ],
  );
  const id = created.rows[0]?.id;
  if (!id) {
    throw new Error('The ledger transaction was not saved');
  }

  for (const line of lines) {
    await client.query(
      `INSERT INTO ledger_entries (transaction_id, account, user_id, currency, amount_minor)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, line.account, line.userId ?? null, input.currency, line.amountMinor],
    );
  }
  return id;
}

export type OwnerBalance = {
  currency: string;
  availableMinor: number;
  pendingPayoutMinor: number;
};

export async function getOwnerBalances(ownerId: string): Promise<OwnerBalance[]> {
  const result = await pool.query<OwnerBalance>(
    `SELECT currency,
            COALESCE(-SUM(amount_minor) FILTER (WHERE account = 'owner_payable'), 0)::int
              AS "availableMinor",
            COALESCE(-SUM(amount_minor) FILTER (WHERE account = 'payout_pending'), 0)::int
              AS "pendingPayoutMinor"
     FROM ledger_entries
     WHERE user_id = $1 AND account IN ('owner_payable', 'payout_pending')
     GROUP BY currency ORDER BY currency`,
    [ownerId],
  );
  return result.rows;
}

export type PlatformBalance = { account: LedgerAccount; currency: string; balanceMinor: number };

export async function getPlatformBalances(): Promise<PlatformBalance[]> {
  const result = await pool.query<PlatformBalance>(
    `SELECT account, currency, SUM(amount_minor)::int AS "balanceMinor"
     FROM ledger_entries GROUP BY account, currency ORDER BY currency, account`,
  );
  return result.rows;
}

export async function listLedgerTransactions(filters: {
  bookingId?: string;
  limit: number;
  offset: number;
}): Promise<unknown[]> {
  const result = await pool.query(
    `SELECT t.id, t.kind, t.booking_id AS "bookingId", t.payout_id AS "payoutId",
            t.currency, t.note, t.created_at AS "createdAt",
            (SELECT json_agg(json_build_object(
                      'account', e.account, 'userId', e.user_id, 'amountMinor', e.amount_minor)
                    ORDER BY e.id)
             FROM ledger_entries e WHERE e.transaction_id = t.id) AS entries
     FROM ledger_transactions t
     WHERE ($1::uuid IS NULL OR t.booking_id = $1::uuid)
     ORDER BY t.created_at DESC
     LIMIT $2 OFFSET $3`,
    [filters.bookingId ?? null, filters.limit, filters.offset],
  );
  return result.rows;
}

// File: backend/src/payments/ledger.ts
// END OF FILE