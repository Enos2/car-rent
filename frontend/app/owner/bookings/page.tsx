// Project: Via Nostra
// File: frontend/app/owner/bookings/page.tsx
// Purpose: The owner's bookings: every booking of their cars with the renter's first
//          name, the dates, the status and the owner's share of the money.

import type { Metadata } from 'next';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { BOOKING_STATUS, formatDate, formatMoney } from '@/lib/format';
import { requireUser } from '@/lib/session';
import type { OwnerBookingListResponse } from '@/lib/types';

export const metadata: Metadata = { title: 'Owner bookings' };

export default async function OwnerBookingsPage() {
  const { token, user } = await requireUser();
  if (!user.roles.includes('owner')) {
    return (
      <div className="container page">
        <div className="alert">Only owner accounts have owner bookings.</div>
      </div>
    );
  }

  const result = await apiRequest<OwnerBookingListResponse>('/bookings/owner?limit=100', { token });

  return (
    <div className="container page">
      <div className="section-head">
        <h1>Owner bookings</h1>
      </div>
      <div className="subnav">
        <Link href="/owner">Cars</Link>
        <Link href="/owner/bookings" className="active">
          Bookings
        </Link>
        <Link href="/owner/payouts">Payouts</Link>
      </div>

      {!result.ok ? (
        <div className="alert">{result.error.message}</div>
      ) : result.data.items.length === 0 ? (
        <div className="empty">
          <p>No one has booked your cars yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Car</th>
                <th>Renter</th>
                <th>Dates</th>
                <th>Status</th>
                <th className="num">Rental</th>
                <th className="num">Your share</th>
              </tr>
            </thead>
            <tbody>
              {result.data.items.map((booking) => (
                <tr key={booking.id}>
                  <td>
                    {booking.carMake} {booking.carModel}
                    <br />
                    <span className="hint">{booking.plateNumber}</span>
                  </td>
                  <td>{booking.renterFirstName}</td>
                  <td>
                    {formatDate(booking.startDate)} to {formatDate(booking.endDate)}
                  </td>
                  <td>
                    <span className={BOOKING_STATUS[booking.status].badge}>
                      {BOOKING_STATUS[booking.status].label}
                    </span>
                  </td>
                  <td className="num">{formatMoney(booking.subtotalMinor, booking.currency)}</td>
                  <td className="num">{formatMoney(booking.ownerShareMinor, booking.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="hint">
        Your share is paid out after the renter confirms they received the car, minus Via Nostra&apos;s
        commission.
      </p>
    </div>
  );
}

// File: frontend/app/owner/bookings/page.tsx
// END OF FILE