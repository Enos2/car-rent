// Project: Via Nostra
// File: frontend/app/cars/[id]/page.tsx
// Purpose: One car's page: photos, facts, description, the dates it is already
//          booked, and the booking box. Visitors who are not logged in are asked to
//          log in or sign up before booking.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import BookingForm from '@/components/BookingForm';
import { apiRequest } from '@/lib/api';
import { formatDate, formatMoney, todayIso } from '@/lib/format';
import { getToken } from '@/lib/session';
import type { AvailabilityResponse, CarDetailResponse } from '@/lib/types';

export default async function CarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [carResult, availability, token] = await Promise.all([
    apiRequest<CarDetailResponse>(`/cars/${encodeURIComponent(id)}`),
    apiRequest<AvailabilityResponse>(`/cars/${encodeURIComponent(id)}/availability`),
    getToken(),
  ]);

  if (!carResult.ok) {
    if (carResult.status === 0) {
      return (
        <div className="container page">
          <div className="alert">{carResult.error.message}</div>
        </div>
      );
    }
    notFound();
  }

  const { car, photos } = carResult.data;
  const title = `${car.year} ${car.make} ${car.model}`;
  const blocked = availability.ok ? availability.data.blocked : [];
  const [mainPhoto, ...otherPhotos] = photos;

  return (
    <div className="container page">
      <p className="hint">
        <Link href="/cars">&larr; All cars</Link>
      </p>
      <div className="detail-layout">
        <div>
          <div className="gallery-main">
            {mainPhoto ? (
              <img src={`/photos/${car.id}/${mainPhoto.id}`} alt={title} />
            ) : (
              <span>No photos yet</span>
            )}
          </div>
          {otherPhotos.length > 0 ? (
            <div className="gallery-thumbs">
              {otherPhotos.map((photo) => (
                <div key={photo.id}>
                  <img src={`/photos/${car.id}/${photo.id}`} alt={`${title}, photo ${photo.position + 1}`} loading="lazy" />
                </div>
              ))}
            </div>
          ) : null}

          <h1 style={{ marginBottom: 4 }}>{title}</h1>
          <p className="hint">
            Pick up and return at {car.hub.name}, {car.hub.city}
          </p>
          <div className="facts">
            <span className="badge">{car.seats} seats</span>
            <span className="badge">{car.transmission}</span>
            <span className="badge">{car.fuelType}</span>
            {car.color ? <span className="badge">{car.color}</span> : null}
            <span className="badge badge-ok">
              {car.owner.accountType === 'company' ? 'Company' : 'Owner'}: {car.owner.displayName}
            </span>
          </div>
          {car.description ? <p>{car.description}</p> : null}
        </div>

        <aside className="booking-box">
          <h2>
            {formatMoney(car.dailyPriceMinor, car.currency)} <small>/ day</small>
          </h2>
          <p className="hint">
            Refundable deposit {formatMoney(car.depositMinor, car.currency)}
          </p>

          {token ? (
            <BookingForm
              carId={car.id}
              currency={car.currency}
              dailyPriceMinor={car.dailyPriceMinor}
              depositMinor={car.depositMinor}
              minDays={car.minRentalDays}
              maxDays={car.maxRentalDays}
              today={todayIso()}
            />
          ) : (
            <div>
              <p>Log in or create an account to book this car.</p>
              <div className="actions">
                <Link href="/login" className="btn btn-primary">
                  Log in
                </Link>
                <Link href="/register" className="btn btn-ghost">
                  Sign up
                </Link>
              </div>
            </div>
          )}

          {blocked.length > 0 ? (
            <div>
              <p className="hint" style={{ marginTop: 20 }}>
                Already booked:
              </p>
              <ul className="blocked-list">
                {blocked.map((range) => (
                  <li key={`${range.startDate}-${range.endDate}`}>
                    {formatDate(range.startDate)} to {formatDate(range.endDate)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

// File: frontend/app/cars/[id]/page.tsx
// END OF FILE