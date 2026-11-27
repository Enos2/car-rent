// Project: Via Nostra
// File: frontend/app/bookings/page.tsx
// Purpose: "My bookings": the logged-in renter's bookings, newest first, each with
//          its car, dates, price and status.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { BOOKING_STATUS, formatDate, formatMoney } from '@/lib/format';
import { getToken } from '@/lib/session';
import type { BookingListResponse } from '@/lib/types';

export const metadata: Metadata = { title: 'My bookings' };

export default async function BookingsPage() {
  const token = await getToken();
  if (!token) {
    redirect('/login');
  }

  const result = await apiRequest<BookingListResponse>('/bookings/mine?limit=50', { token });
  if (!result.ok && result.status === 401) {
    redirect('/login');
  }

  return (
    <div className="container page">
      <div className="section-head">
        <h1>My bookings</h1>
        <Link href="/cars" className="btn btn-primary">
          Browse cars
        </Link>
      </div>

      {!result.ok ? (
        <div className="alert">{result.error.message}</div>
      ) : result.data.items.length === 0 ? (
        <div className="empty">
          <p>You have no bookings yet.</p>
          <Link href="/cars" className="btn btn-primary">
            Find a car
          </Link>
        </div>
      ) : (
        <div className="row-list">
          {result.data.items.map((booking) => {
            const status = BOOKING_STATUS[booking.status];
            return (
              <Link key={booking.id} href={`/bookings/${booking.id}`} className="row-card">
                <div>
                  <strong>
                    {booking.carMake} {booking.carModel}
                  </strong>
                  <p>
                    {formatDate(booking.startDate)} to {formatDate(booking.endDate)} &middot;{' '}
                    {booking.hubName}, {booking.hubCity}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={status.badge}>{status.label}</span>
                  <p>{formatMoney(booking.subtotalMinor + booking.depositMinor, booking.currency)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// File: frontend/app/bookings/page.tsx
// END OF FILE