// Project: Via Nostra
// File: frontend/app/admin/payouts/page.tsx
// Purpose: The payout requests from owners. Finance staff mark a request as paid
//          or reject it with a reason (the money then returns to the owner's
//          balance). Nobody can review their own payout.

import type { Metadata } from 'next';
import { payPayoutAction, rejectPayoutAction } from '@/app/admin/actions';
import Flash from '@/components/Flash';
import Pager from '@/components/Pager';
import StatusTabs from '@/components/StatusTabs';
import { apiRequest } from '@/lib/api';
import { PAYOUT_STATUS, firstParam, formatDateTime, formatMoney } from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { PAGE_SIZE, offsetFor, pageFrom } from '@/lib/paging';
import { requireStaff } from '@/lib/session';
import type { PayoutListResponse } from '@/lib/types';

export const metadata: Metadata = { title: 'Payouts' };

const TABS = [
  { value: 'requested', label: 'Requested' },
  { value: 'paid', label: 'Paid' },
  { value: 'rejected', label: 'Rejected' },
];

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { token, user } = await requireStaff('finance.read');
  const query = await searchParams;
  const status = firstParam(query.status) || 'requested';
  const page = pageFrom(firstParam(query.page));
  const canManage = user.permissions.includes('finance.manage');

  const result = await apiRequest<PayoutListResponse>(
    `/admin/payouts?status=${encodeURIComponent(status)}&limit=${PAGE_SIZE}&offset=${offsetFor(page)}`,
    { token },
  );

  return (
    <div>
      <Flash notice={firstParam(query.notice)} error={firstParam(query.error)} />
      <StatusTabs tabs={TABS} current={status} basePath="/admin/payouts" />
      {!result.ok ? (
        <div className="alert">{result.error.message}</div>
      ) : result.data.items.length === 0 ? (
        <div className="empty">
          <p>No payouts in this list.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Requested</th>
                <th>Owner</th>
                <th>Send to</th>
                <th>Status</th>
                <th className="num">Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {result.data.items.map((payout) => {
                const label = PAYOUT_STATUS[payout.status];
                const isOwn = payout.ownerId === user.id;
                return (
                  <tr key={payout.id}>
                    <td>{formatDateTime(payout.createdAt)}</td>
                    <td className="mono">{payout.ownerId.slice(0, 8)}</td>
                    <td>{payout.destination}</td>
                    <td>
                      <span className={label?.badge ?? 'badge'}>{label?.label ?? payout.status}</span>
                      {payout.rejectionReason ? <p className="hint">{payout.rejectionReason}</p> : null}
                      {payout.providerReference ? (
                        <p className="hint mono">{payout.providerReference}</p>
                      ) : null}
                    </td>
                    <td className="num">{formatMoney(payout.amountMinor, payout.currency)}</td>
                    <td>
                      {payout.status === 'requested' && canManage && !isOwn ? (
                        <div className="stack">
                          <form action={payPayoutAction} className="inline-form">
                            <input type="hidden" name="id" value={payout.id} />
                            <button type="submit" className="btn btn-ok btn-small">
                              Mark paid
                            </button>
                          </form>
                          <form action={rejectPayoutAction} className="inline-form">
                            <input type="hidden" name="id" value={payout.id} />
                            <input
                              type="text"
                              name="reason"
                              placeholder="Reason"
                              minLength={5}
                              maxLength={500}
                              required
                            />
                            <button type="submit" className="btn btn-danger btn-small">
                              Reject
                            </button>
                          </form>
                        </div>
                      ) : null}
                      {payout.status === 'requested' && isOwn ? (
                        <span className="hint">Your own payout</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {result.ok ? (
        <Pager
          basePath="/admin/payouts"
          params={{ status }}
          page={page}
          pageSize={PAGE_SIZE}
          total={result.data.total}
        />
      ) : null}
      <p className="hint">
        Mark a payout as paid only after the money has really been sent. With the test payment
        provider, nothing real is sent.
      </p>
    </div>
  );
}

// File: frontend/app/admin/payouts/page.tsx
// END OF FILE