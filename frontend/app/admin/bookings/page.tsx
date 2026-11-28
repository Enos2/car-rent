// Project: Via Nostra
// File: frontend/app/admin/bookings/page.tsx
// Purpose: The staff bookings list with tabs: bookings to hand over, awaiting the
//          renter's confirmation, cars out on rent, unpaid, completed and cancelled.

import type { Metadata } from 'next';
import Link from 'next/link';
import Pager from '@/components/Pager';
import StatusTabs from '@/components/StatusTabs';
import { apiRequest } from '@/lib/api';
import { BOOKING_STATUS, firstParam, formatDate, formatMoney } from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { PAGE_SIZE, offsetFor, pageFrom } from '@/lib/paging';
import { requireStaff } from '@/lib/session';
import type { AdminBookingListResponse } from '@/lib/types';

export const metadata: Metadata = { title: 'Bookings' };

const TABS = [
  { value: 'confirmed', label: 'To hand over' },
  { value: 'handed_over', label: 'Awaiting renter' },
  { value: 'in_progress', label: 'Out on rent' },
  { value: 'pending_payment', label: 'Unpaid' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await requireStaff('bookings.read');
  const query = await searchParams;
  const status = firstParam(query.status) || 'confirmed';
  const page = pageFrom(firstParam(query.page));

  const result = await apiRequest<AdminBookingListResponse>(
    `/admin/bookings?status=${encodeURIComponent(status)}&limit=${PAGE_SIZE}&offset=${offsetFor(page)}`,
    { token },
  );

  return (
    <div>
      <StatusTabs tabs={TABS} current={status} basePath="/admin/bookings" />
      {!result.ok ? (
        <div className="alert">{result.error.message}</div>
      ) : result.data.items.length === 0 ? (
        <div className="empty">
          <p>No bookings in this list.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Car</th>
                <th>Renter</th>
                <th>Dates</th>
                <th>Hub</th>
                <th>Status</th>
                <th className="num">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {result.data.items.map((booking) => (
                <tr key={booking.id}>
                  <td>
                    {booking.carMake} {booking.carModel}
                    <p className="hint">{booking.plateNumber}</p>
                  </td>
                  <td>{booking.renterName}</td>
                  <td>
                    {formatDate(booking.startDate)} to {formatDate(booking.endDate)}
                  </td>
                  <td>{booking.hubName}</td>
                  <td>
                    <span className={BOOKING_STATUS[booking.status].badge}>
                      {BOOKING_STATUS[booking.status].label}
                    </span>
                  </td>
                  <td className="num">
                    {formatMoney(booking.subtotalMinor + booking.depositMinor, booking.currency)}
                  </td>
                  <td className="num">
                    <Link href={`/admin/bookings/${booking.id}`} className="btn btn-ghost btn-small">
                      Open
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
          basePath="/admin/bookings"
          params={{ status }}
          page={page}
          pageSize={PAGE_SIZE}
          total={result.data.total}
        />
      ) : null}
    </div>
  );
}

// File: frontend/app/admin/bookings/page.tsx
// END OF FILE