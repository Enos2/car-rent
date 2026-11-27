// Project: Via Nostra
// File: frontend/app/cars/page.tsx
// Purpose: The browse page: search the live cars by city, make, price, gearbox,
//          fuel and seats, sort them, and page through the results.

import type { Metadata } from 'next';
import Link from 'next/link';
import CarCard from '@/components/CarCard';
import { apiRequest } from '@/lib/api';
import type { CarSearchResponse } from '@/lib/types';

export const metadata: Metadata = { title: 'Browse cars' };

const PAGE_SIZE = 12;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

function pageHref(filters: Record<string, string>, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && !(key === 'sort' && value === 'newest')) {
      params.set(key, value);
    }
  }
  if (page > 1) {
    params.set('page', String(page));
  }
  const text = params.toString();
  return text ? `/cars?${text}` : '/cars';
}

export default async function CarsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const filters = {
    city: first(raw.city),
    make: first(raw.make),
    transmission: first(raw.transmission),
    fuelType: first(raw.fuelType),
    minSeats: first(raw.minSeats),
    maxPrice: first(raw.maxPrice),
    sort: first(raw.sort) || 'newest',
  };
  const page = Math.max(1, Math.floor(Number(first(raw.page))) || 1);

  const query = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
    sort: filters.sort,
  });
  if (filters.city) query.set('city', filters.city);
  if (filters.make) query.set('make', filters.make);
  if (filters.transmission) query.set('transmission', filters.transmission);
  if (filters.fuelType) query.set('fuelType', filters.fuelType);
  if (filters.minSeats) query.set('minSeats', filters.minSeats);
  const maxPrice = Number(filters.maxPrice);
  if (filters.maxPrice && Number.isFinite(maxPrice) && maxPrice > 0) {
    query.set('maxDailyPriceMinor', String(Math.round(maxPrice * 100)));
  }

  const result = await apiRequest<CarSearchResponse>(`/cars?${query.toString()}`);
  const totalPages = result.ok ? Math.max(1, Math.ceil(result.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="container page">
      <div className="section-head">
        <h1>Browse cars</h1>
        {result.ok ? (
          <span className="hint">
            {result.data.total} {result.data.total === 1 ? 'car' : 'cars'} available
          </span>
        ) : null}
      </div>

      <form className="filters" method="get" action="/cars">
        <div>
          <label htmlFor="city">City</label>
          <input id="city" name="city" type="text" defaultValue={filters.city} />
        </div>
        <div>
          <label htmlFor="make">Make</label>
          <input id="make" name="make" type="text" defaultValue={filters.make} />
        </div>
        <div>
          <label htmlFor="transmission">Gearbox</label>
          <select id="transmission" name="transmission" defaultValue={filters.transmission}>
            <option value="">Any</option>
            <option value="automatic">Automatic</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <div>
          <label htmlFor="fuelType">Fuel</label>
          <select id="fuelType" name="fuelType" defaultValue={filters.fuelType}>
            <option value="">Any</option>
            <option value="petrol">Petrol</option>
            <option value="diesel">Diesel</option>
            <option value="hybrid">Hybrid</option>
            <option value="electric">Electric</option>
          </select>
        </div>
        <div>
          <label htmlFor="minSeats">Seats (at least)</label>
          <input id="minSeats" name="minSeats" type="number" min="1" max="20" defaultValue={filters.minSeats} />
        </div>
        <div>
          <label htmlFor="maxPrice">Max price per day</label>
          <input id="maxPrice" name="maxPrice" type="number" min="1" step="1" defaultValue={filters.maxPrice} />
        </div>
        <div>
          <label htmlFor="sort">Sort by</label>
          <select id="sort" name="sort" defaultValue={filters.sort}>
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      {!result.ok ? (
        <div className="alert">{result.error.message}</div>
      ) : result.data.items.length === 0 ? (
        <div className="empty">
          <p>No cars match your search.</p>
          <Link href="/cars" className="btn btn-ghost">
            Clear the filters
          </Link>
        </div>
      ) : (
        <div className="car-grid">
          {result.data.items.map((car) => (
            <CarCard key={car.id} car={car} />
          ))}
        </div>
      )}

      {result.ok && totalPages > 1 ? (
        <div className="pagination">
          {page > 1 ? (
            <Link href={pageHref(filters, page - 1)} className="btn btn-ghost">
              Previous
            </Link>
          ) : null}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(filters, page + 1)} className="btn btn-ghost">
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// File: frontend/app/cars/page.tsx
// END OF FILE