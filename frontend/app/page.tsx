// Project: Via Nostra
// File: frontend/app/page.tsx
// Purpose: The home page: what Via Nostra is, the feed of the newest live cars from
//          verified owners, and how the platform keeps renting safe.

import Link from 'next/link';
import CarCard from '@/components/CarCard';
import { apiRequest } from '@/lib/api';
import type { CarSearchResponse } from '@/lib/types';

const steps = [
  {
    title: 'Verified people only',
    text: 'Renters and owners, individuals and companies, are checked before they can rent or list a car.',
  },
  {
    title: 'Cars checked at a hub',
    text: 'Every car is dropped off and inspected at a Via Nostra hub, so what you see is what you get.',
  },
  {
    title: 'Payment held safely',
    text: 'Your payment is held by Via Nostra and only released to the owner after you confirm the car was received.',
  },
];

export default async function HomePage() {
  const result = await apiRequest<CarSearchResponse>('/cars?limit=6&sort=newest');
  const cars = result.ok ? result.data.items : [];

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>Rent the car you need. Share the car you own.</h1>
          <p>
            Via Nostra connects verified renters with verified owners. Cars are inspected at
            our hubs and payments are protected from the first booking.
          </p>
          <div className="hero-actions">
            <Link href="/cars" className="btn btn-light">
              Browse cars
            </Link>
            <Link href="/register" className="btn btn-ghost">
              Create an account
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>Latest cars</h2>
            <Link href="/cars" className="btn btn-ghost">
              See all cars
            </Link>
          </div>
          {!result.ok ? (
            <div className="alert">{result.error.message}</div>
          ) : cars.length === 0 ? (
            <div className="empty">
              <p>No cars are live yet. Be one of the first owners on Via Nostra.</p>
              <Link href="/register" className="btn btn-primary">
                List your car
              </Link>
            </div>
          ) : (
            <div className="car-grid">
              {cars.map((car) => (
                <CarCard key={car.id} car={car} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>How it works</h2>
          <p className="section-intro">Three promises that make renting from strangers feel safe.</p>
          <div className="grid">
            {steps.map((step, index) => (
              <div className="card" key={step.title}>
                <div className="step-number">{index + 1}</div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

// File: frontend/app/page.tsx
// END OF FILE