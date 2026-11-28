// Project: Via Nostra
// File: frontend/app/owner/payouts/page.tsx
// Purpose: The owner's money page: the balance that can be withdrawn, a form to
//          request a payout, and the history of payouts with their status.

import type { Metadata } from 'next';
import Link from 'next/link';
import { requestPayoutAction } from '@/app/owner/actions';
import Flash from '@/components/Flash';
import { apiRequest } from '@/lib/api';
import {
  PAYOUT_STATUS,
  firstParam,
  formatDateTime,
  formatMoney,
} from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { requireUser } from '@/lib/session';
import type { OwnerBalance, PayoutListResponse } from '@/lib/types';

export const metadata: Metadata = { title: 'Payouts' };

export default async function OwnerPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { token, user } = await requireUser();
  const query = await searchParams;

  if (!user.roles.includes('owner')) {
    return (
      <div className="container page">
        <div className="alert">Only owner accounts have payouts.</div>
      </div>
    );
  }

  const [balance, payouts] = await Promise.all([
    apiRequest<{ balances: OwnerBalance[] }>('/payouts/balance', { token }),
    apiRequest<PayoutListResponse>('/payouts?limit=50', { token }),
  ]);
  const balances = balance.ok ? balance.data.balances : [];
  const defaultCurrency = balances.find((entry) => entry.availableMinor > 0)?.currency ?? 'USD';

  return (
    <div className="container page">
      <div className="section-head">
        <h1>Payouts</h1>
      </div>
      <div className="subnav">
        <Link href="/owner">Cars</Link>
        <Link href="/owner/bookings">Bookings</Link>
        <Link href="/owner/payouts" className="active">
          Payouts
        </Link>
      </div>

      <Flash notice={firstParam(query.notice)} error={firstParam(query.error)} />

      <div className="stats">
        {balances.length === 0 ? (
          <div className="stat">
            <div className="value">0.00</div>
            <div className="label">Available to withdraw</div>
          </div>
        ) : (
          balances.map((entry) => (
            <div className="stat" key={entry.currency}>
              <div className="value">{formatMoney(entry.availableMinor, entry.currency)}</div>
              <div className="label">
                Available ({entry.currency})
                {entry.pendingPayoutMinor > 0
                  ? ` - ${formatMoney(entry.pendingPayoutMinor, entry.currency)} waiting for payout`
                  : ''}
              </div>
            </div>
          ))
        )}
      </div>

      {user.verificationStatus === 'verified' ? (
        <form action={requestPayoutAction} className="form-panel">
          <h2>Request a payout</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="amount">Amount</label>
              <input id="amount" name="amount" type="number" step="0.01" min="1" required />
            </div>
            <div className="field">
              <label htmlFor="currency">Currency</label>
              <input
                id="currency"
                name="currency"
                type="text"
                defaultValue={defaultCurrency}
                minLength={3}
                maxLength={3}
                required
              />
            </div>
            <div className="field wide">
              <label htmlFor="destination">Where should we send it?</label>
              <input
                id="destination"
                name="destination"
                type="text"
                placeholder="Phone number or bank account"
                minLength={3}
                maxLength={120}
                required
              />
              <p className="hint">Our finance team reviews every payout before it is paid.</p>
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            Request payout
          </button>
        </form>
      ) : (
        <div className="callout">
          Only verified owners can request a payout. <Link href="/verify">Verify your identity</Link>
        </div>
      )}

      <h2>History</h2>
      {!payouts.ok ? (
        <div className="alert">{payouts.error.message}</div>
      ) : payouts.data.items.length === 0 ? (
        <div className="empty">
          <p>No payouts yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Requested</th>
                <th>To</th>
                <th>Status</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payouts.data.items.map((payout) => {
                const status = PAYOUT_STATUS[payout.status];
                return (
                  <tr key={payout.id}>
                    <td>{formatDateTime(payout.createdAt)}</td>
                    <td>{payout.destination}</td>
                    <td>
                      <span className={status?.badge ?? 'badge'}>{status?.label ?? payout.status}</span>
                      {payout.rejectionReason ? (
                        <p className="hint">{payout.rejectionReason}</p>
                      ) : null}
                    </td>
                    <td className="num">{formatMoney(payout.amountMinor, payout.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// File: frontend/app/owner/payouts/page.tsx
// END OF FILE