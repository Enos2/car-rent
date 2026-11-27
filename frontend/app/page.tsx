// Project: Via Nostra
// File: frontend/app/page.tsx
// Purpose: The home page: what Via Nostra is, how it works, why it is trustworthy,
//          and the place where cars from verified owners will appear.

import Link from 'next/link';

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

export default function HomePage() {
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
            <Link href="/register" className="btn btn-light">
              Create an account
            </Link>
            <Link href="/login" className="btn btn-ghost">
              Log in
            </Link>
          </div>
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

      <section className="section">
        <div className="container">
          <h2>Latest cars</h2>
          <p className="section-intro">
            Cars from verified owners will appear here, newest first.{' '}
            <span className="badge badge-warn">Coming soon</span>
          </p>
          <div className="grid">
            {[1, 2, 3].map((slot) => (
              <div className="card skeleton" key={slot}>
                <span className="badge">Verified owner</span>
                <h3>Your car could be here</h3>
                <p>Sign up as an owner to be ready when listings open.</p>
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
