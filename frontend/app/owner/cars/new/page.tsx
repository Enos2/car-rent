// Project: Via Nostra
// File: frontend/app/owner/cars/new/page.tsx
// Purpose: The page for adding a new car: the details form. After saving, the owner
//          adds the documents and photos and submits the car for review.

import type { Metadata } from 'next';
import Link from 'next/link';
import { createCarAction } from '@/app/owner/actions';
import CarForm from '@/components/CarForm';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Add a car' };

export default async function NewCarPage() {
  const { user } = await requireUser();

  if (!user.roles.includes('owner')) {
    return (
      <div className="container page">
        <div className="alert">Only owner accounts can list cars.</div>
      </div>
    );
  }

  return (
    <div className="container page">
      <p className="hint">
        <Link href="/owner">&larr; Owner dashboard</Link>
      </p>
      <h1>Add a car</h1>
      {user.verificationStatus !== 'verified' ? (
        <div className="callout">
          You must be verified before you can list a car. <Link href="/verify">Verify your identity</Link>
        </div>
      ) : null}
      <p className="section-intro">
        Step 1 of 3: the car&apos;s details. Next you upload the logbook, registration and
        insurance, add photos, and choose the hub where you will drop the car off.
      </p>
      <CarForm action={createCarAction} submitLabel="Create car" />
    </div>
  );
}

// File: frontend/app/owner/cars/new/page.tsx
// END OF FILE