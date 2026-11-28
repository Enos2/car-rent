// Project: Via Nostra
// File: frontend/app/admin/verifications/page.tsx
// Purpose: The identity verification queue: people who submitted documents, oldest
//          first, with tabs for those waiting, approved and rejected.

import type { Metadata } from 'next';
import Link from 'next/link';
import Pager from '@/components/Pager';
import StatusTabs from '@/components/StatusTabs';
import { apiRequest } from '@/lib/api';
import { firstParam, formatDateTime } from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { PAGE_SIZE, offsetFor, pageFrom } from '@/lib/paging';
import { requireStaff } from '@/lib/session';
import type { VerificationQueueResponse } from '@/lib/types';

export const metadata: Metadata = { title: 'Verifications' };

const TABS = [
  { value: 'pending', label: 'Waiting for review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const KIND = { renter: 'Renter', owner: 'Owner', company: 'Company' } as const;

export default async function VerificationQueuePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await requireStaff('verification.review');
  const query = await searchParams;
  const status = firstParam(query.status) || 'pending';
  const page = pageFrom(firstParam(query.page));

  const result = await apiRequest<VerificationQueueResponse>(
    `/admin/verifications?status=${encodeURIComponent(status)}&limit=${PAGE_SIZE}&offset=${offsetFor(page)}`,
    { token },
  );

  return (
    <div>
      <StatusTabs tabs={TABS} current={status} basePath="/admin/verifications" />
      {!result.ok ? (
        <div className="alert">{result.error.message}</div>
      ) : result.data.items.length === 0 ? (
        <div className="empty">
          <p>Nothing here.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Person</th>
                <th>Email</th>
                <th>Type</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {result.data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.fullName}
                    {item.companyName ? <p className="hint">{item.companyName}</p> : null}
                  </td>
                  <td>{item.email}</td>
                  <td>{KIND[item.kind]}</td>
                  <td>{item.submittedAt ? formatDateTime(item.submittedAt) : '-'}</td>
                  <td className="num">
                    <Link href={`/admin/verifications/${item.id}`} className="btn btn-ghost btn-small">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result.ok ? (
        <Pager
          basePath="/admin/verifications"
          params={{ status }}
          page={page}
          pageSize={PAGE_SIZE}
          total={result.data.total}
        />
      ) : null}
    </div>
  );
}

// File: frontend/app/admin/verifications/page.tsx
// END OF FILE