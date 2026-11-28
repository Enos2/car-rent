// Project: Via Nostra
// File: frontend/app/owner/page.tsx
// Purpose: The owner dashboard: balance, live cars and latest bookings at a glance,
//          and the list of the owner's cars with their status and a link to manage
//          each one.

import type { Metadata } from 'next';
import Link from 'next/link';
import Flash from '@/components/Flash';
import { apiRequest } from '@/lib/api';
import {
  CAR_STATUS,
  BOOKING_STATUS,
  firstParam,
  formatDate,
  formatMoney,
} from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { requireUser } from '@/lib/session';
import type { OwnerBalance, OwnerBookingListResponse, OwnerCarItem } from '@/lib/types';

export const metadata: Metadata = { title: 'Owner dashboard' };

export default async function OwnerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { token, user } = await requireUser();
  const query = await searchParams;

  if (!user.roles.includes('owner')) {
    return (
      <div className="container page">
        <div className="empty">
          <p>Only owner accounts can list cars. Create an account as an owner to get started.</p>
          <Link href="/register" className="btn btn-primary">
            Sign up as an owner
          </Link>
        </div>
      </div>
    );
  }

  const [cars, balance, bookings] = await Promise.all([
    apiRequest<{ items: OwnerCarItem[] }>('/cars/mine', { token }),
    apiRequest<{ balances: OwnerBalance[] }>('/payouts/balance', { token }),
    apiRequest<OwnerBookingListResponse>('/bookings/owner?limit=5', { token }),
  ]);

  const carList = cars.ok ? cars.data.items : [];
  const liveCount = carList.filter((car) => car.status === 'live').length;
  const balances = balance.ok ? balance.data.balances : [];
  const recent = bookings.ok ? bookings.data.items : [];

  return (
    <div className="container page">
      <div className="section-head">
        <h1>Owner dashboard</h1>
        <Link href="/owner/cars/new" className="btn btn-primary">
          Add a car
        </Link>
      </div>

      <div className="subnav">
        <Link href="/owner" className="active">
          Cars
        </Link>
        <Link href="/owner/bookings">Bookings</Link>
        <Link href="/owner/payouts">Payouts</Link>
      </div>

      <Flash notice={firstParam(query.notice)} error={firstParam(query.error)} />

      {user.verificationStatus !== 'verified' ? (
        <div className="callout">
          You must be verified before you can list a car. <Link href="/verify">Verify your identity</Link>
        </div>
      ) : null}

      <div className="stats">
        <div className="stat">
          <div className="value">{liveCount}</div>
          <div className="label">Live cars</div>
        </div>
        <Link href="/owner/bookings" className="stat">
          <div className="value">{bookings.ok ? bookings.data.total : 0}</div>
          <div className="label">Bookings</div>
        </Link>
        <Link href="/owner/payouts" className="stat">
          <div className="value">
            {balances.length > 0
              ? balances.map((entry) => formatMoney(entry.availableMinor, entry.currency)).join(' / ')
              : '0.00'}
          </div>
          <div className="label">Available to withdraw</div>
        </Link>
      </div>

      <h2>Your cars</h2>
      {carList.length === 0 ? (
        <div className="empty">
          <p>You have not added a car yet.</p>
          <Link href="/owner/cars/new" className="btn btn-primary">
            Add your first car
          </Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th />
                <th>Car</th>
                <th>Plate</th>
                <th>Status</th>
                <th className="num">Per day</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {carList.map((car) => (
                <tr key={car.id}>
                  <td>
                    {car.coverPhotoId ? (
                      <img className="thumb" src={`/photos/${car.id}/${car.coverPhotoId}`} alt="" />
                    ) : (
                      <span className="thumb" />
                    )}
                  </td>
                  <td>
                    {car.year} {car.make} {car.model}
                  </td>
                  <td>{car.plateNumber}</td>
                  <td>
                    <span className={CAR_STATUS[car.status].badge}>{CAR_STATUS[car.status].label}</span>
                  </td>
                  <td className="num">{formatMoney(car.dailyPriceMinor, car.currency)}</td>
                  <td className="num">
                    <Link href={`/owner/cars/${car.id}`} className="btn btn-ghost btn-small">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {recent.length > 0 ? (
        <>
          <div className="section-head">
            <h2>Latest bookings</h2>
            <Link href="/owner/bookings" className="btn btn-ghost btn-small">
              See all
            </Link>
          </div>
          <div className="row-list">
            {recent.map((booking) => (
              <div className="row-card" key={booking.id}>
                <div>
                  <strong>
                    {booking.carMake} {booking.carModel}
                  </strong>
                  <p>
                    {booking.renterFirstName} &middot; {formatDate(booking.startDate)} to{' '}
                    {formatDate(booking.endDate)}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={BOOKING_STATUS[booking.status].badge}>
                    {BOOKING_STATUS[booking.status].label}
                  </span>
                  <p>Your share {formatMoney(booking.ownerShareMinor, booking.currency)}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

// File: frontend/app/owner/page.tsx
// END OF FILE