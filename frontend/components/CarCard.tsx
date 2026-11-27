// Project: Via Nostra
// File: frontend/components/CarCard.tsx
// Purpose: One car in a grid: its photo, name, key facts, daily price and owner.
//          Clicking it opens the car's page.

import Link from 'next/link';
import { formatMoney } from '@/lib/format';
import type { CarListing } from '@/lib/types';

export default function CarCard({ car }: { car: CarListing }) {
  const title = `${car.year} ${car.make} ${car.model}`;

  return (
    <Link href={`/cars/${car.id}`} className="car-card">
      <div className="car-photo">
        {car.coverPhotoId ? (
          <img src={`/photos/${car.id}/${car.coverPhotoId}`} alt={title} loading="lazy" />
        ) : (
          <span>No photo yet</span>
        )}
      </div>
      <div className="car-body">
        <h3>{title}</h3>
        <p className="car-meta">
          {car.hub.city} &middot; {car.seats} seats &middot; {car.transmission} &middot;{' '}
          {car.fuelType}
        </p>
        <p className="car-price">
          <strong>{formatMoney(car.dailyPriceMinor, car.currency)}</strong> / day
        </p>
        <p className="car-owner">
          {car.owner.accountType === 'company' ? 'Company' : 'Owner'}: {car.owner.displayName}
        </p>
      </div>
    </Link>
  );
}

// File: frontend/components/CarCard.tsx
// END OF FILE