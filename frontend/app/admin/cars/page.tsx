// Project: Via Nostra
// File: frontend/app/admin/cars/page.tsx
// Purpose: The car review queue: cars waiting for document review, waiting for
//          their drop-off at the hub, live, paused, rejected or suspended.

import type { Metadata } from 'next';
import Link from 'next/link';
import Pager from '@/components/Pager';
import StatusTabs from '@/components/StatusTabs';
import { apiRequest } from '@/lib/api';
import { CAR_STATUS, firstParam, formatDateTime } from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { PAGE_SIZE, offsetFor, pageFrom } from '@/lib/paging';
import { requireStaff } from '@/lib/session';
import type { CarStatus, QueueCarResponse } from '@/lib/types';

export const metadata: Metadata = { title: 'Cars' };

const TABS = [
  { value: 'submitted', label: 'Documents to review' },
  { value: 'awaiting_dropoff', label: 'Waiting for drop-off' },
  { value: 'live', label: 'Live' },
  { value: 'paused', label: 'Paused' },
  { value: 'rejected', label: 'Sent back' },
  { value: 'suspended', label: 'Suspended' },
];

export default async function AdminCarsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await requireStaff('cars.review');
  const query = await searchParams;
  const status = firstParam(query.status) || 'submitted';
  const page = pageFrom(firstParam(query.page));

  const result = await apiRequest<QueueCarResponse>(
    `/admin/cars?status=${encodeURIComponent(status)}&limit=${PAGE_SIZE}&offset=${offsetFor(page)}`,
    { token },
  );

  return (
    <div>
      <StatusTabs tabs={TABS} current={status} basePath="/admin/cars" />
      {!result.ok ? (
        <div className="alert">{result.error.message}</div>
      ) : result.data.items.length === 0 ? (
        <div className="empty">
          <p>No cars in this list.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Car</th>
                <th>Plate</th>
                <th>Owner</th>
                <th>Hub</th>
                <th>Status</th>
                <th>Submitted</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {result.data.items.map((car) => {
                const label = CAR_STATUS[car.status as CarStatus];
                return (
                  <tr key={car.id}>
                    <td>
                      {car.year} {car.make} {car.model}
                    </td>
                    <td>{car.plateNumber}</td>
                    <td>{car.ownerName}</td>
                    <td>{car.hubName ?? '-'}</td>
                    <td>
                      <span className={label.badge}>{label.label}</span>
                    </td>
                    <td>{car.submittedAt ? formatDateTime(car.submittedAt) : '-'}</td>
                    <td className="num">
                      <Link href={`/admin/cars/${car.id}`} className="btn btn-ghost btn-small">
                        Open
                      </Link>
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
          basePath="/admin/cars"
          params={{ status }}
          page={page}
          pageSize={PAGE_SIZE}
          total={result.data.total}
        />
      ) : null}
    </div>
  );
}

// File: frontend/app/admin/cars/page.tsx
// END OF FILE