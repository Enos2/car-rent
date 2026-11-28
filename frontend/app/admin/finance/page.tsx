// Project: Via Nostra
// File: frontend/app/admin/finance/page.tsx
// Purpose: The finance overview: how much money Via Nostra holds, how much it owes
//          to owners, deposits held and commission earned, plus the ledger, the
//          permanent record of every movement of money.

import type { Metadata } from 'next';
import Link from 'next/link';
import Pager from '@/components/Pager';
import { apiRequest } from '@/lib/api';
import { firstParam, formatDateTime, formatMoney } from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { PAGE_SIZE, offsetFor, pageFrom } from '@/lib/paging';
import { requireStaff } from '@/lib/session';
import type { LedgerTransaction, PlatformBalance } from '@/lib/types';

export const metadata: Metadata = { title: 'Finance' };

// The ledger stores cash as a positive number and what is owed as negative. These
// rows turn that into plain amounts people can read.
const ACCOUNTS: Record<string, { label: string; sign: 1 | -1; note: string }> = {
  platform_cash: { label: 'Cash held by Via Nostra', sign: 1, note: 'All the money we hold right now' },
  booking_escrow: { label: 'Rentals held in escrow', sign: -1, note: 'Paid by renters, not yet released to owners' },
  deposit_held: { label: 'Deposits held', sign: -1, note: 'Refundable deposits of cars out on rent' },
  owner_payable: { label: 'Owed to owners', sign: -1, note: 'Released earnings owners can withdraw' },
  payout_pending: { label: 'Payouts being processed', sign: -1, note: 'Requested by owners, not yet paid' },
  platform_revenue: { label: 'Via Nostra revenue', sign: -1, note: 'Commission earned' },
};

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await requireStaff('finance.read');
  const query = await searchParams;
  const page = pageFrom(firstParam(query.page));

  const [summary, ledger] = await Promise.all([
    apiRequest<{ balances: PlatformBalance[] }>('/admin/finance/summary', { token }),
    apiRequest<{ items: LedgerTransaction[] }>(
      `/admin/finance/ledger?limit=${PAGE_SIZE}&offset=${offsetFor(page)}`,
      { token },
    ),
  ]);

  return (
    <div className="stack">
      <h2>Balances</h2>
      {!summary.ok ? (
        <div className="alert">{summary.error.message}</div>
      ) : summary.data.balances.length === 0 ? (
        <div className="empty">
          <p>No money has moved yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Account</th>
                <th>What it means</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {summary.data.balances.map((balance) => {
                const info = ACCOUNTS[balance.account];
                return (
                  <tr key={`${balance.account}-${balance.currency}`}>
                    <td>{info?.label ?? balance.account}</td>
                    <td className="hint">{info?.note ?? ''}</td>
                    <td className="num">
                      {formatMoney((info?.sign ?? 1) * balance.balanceMinor, balance.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2>Ledger</h2>
      {!ledger.ok ? (
        <div className="alert">{ledger.error.message}</div>
      ) : ledger.data.items.length === 0 ? (
        <div className="empty">
          <p>The ledger is empty.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Booking</th>
                <th>Entries (positive = money in, negative = money out of that account)</th>
              </tr>
            </thead>
            <tbody>
              {ledger.data.items.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{formatDateTime(transaction.createdAt)}</td>
                  <td>
                    {transaction.kind.replaceAll('_', ' ')}
                    {transaction.note ? <p className="meta">{transaction.note}</p> : null}
                  </td>
                  <td>
                    {transaction.bookingId ? (
                      <Link href={`/admin/bookings/${transaction.bookingId}`}>
                        {transaction.bookingId.slice(0, 8)}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <ul className="entry-list">
                      {(transaction.entries ?? []).map((entry, index) => (
                        <li key={`${entry.account}-${index}`}>
                          <span>{ACCOUNTS[entry.account]?.label ?? entry.account}</span>
                          <span>{formatMoney(entry.amountMinor, transaction.currency)}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ledger.ok ? (
        <Pager
          basePath="/admin/finance"
          params={{}}
          page={page}
          pageSize={PAGE_SIZE}
          hasNext={ledger.data.items.length === PAGE_SIZE}
        />
      ) : null}
    </div>
  );
}

// File: frontend/app/admin/finance/page.tsx
// END OF FILE