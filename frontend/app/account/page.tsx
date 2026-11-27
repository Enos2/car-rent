// Project: Via Nostra
// File: frontend/app/account/page.tsx
// Purpose: The logged-in person's account page: their details, roles and
//          verification status. Visitors who are not logged in are sent to login.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';

export const metadata: Metadata = { title: 'My account' };

const verificationLabels = {
  unverified: { text: 'Not verified yet', className: 'badge badge-warn' },
  pending: { text: 'Verification in review', className: 'badge' },
  verified: { text: 'Verified', className: 'badge badge-ok' },
  rejected: { text: 'Verification rejected', className: 'badge badge-warn' },
} as const;

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const verification = verificationLabels[user.verificationStatus];

  return (
    <div className="container account">
      <h1>Hello, {user.fullName}</h1>
      <p className="section-intro">This is your Via Nostra account.</p>

      <div className="card">
        <span className={verification.className}>{verification.text}</span>
        <dl className="details">
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Account type</dt>
          <dd>{user.accountType === 'company' ? 'Company' : 'Individual'}</dd>
          {user.companyName ? (
            <>
              <dt>Company</dt>
              <dd>{user.companyName}</dd>
            </>
          ) : null}
          <dt>Roles</dt>
          <dd>
            <span className="chips">
              {user.roles.map((role) => (
                <span className="badge" key={role}>
                  {role.replace('_', ' ')}
                </span>
              ))}
            </span>
          </dd>
          <dt>Member since</dt>
          <dd>{new Date(user.createdAt).toLocaleDateString('en-GB')}</dd>
        </dl>
      </div>
    </div>
  );
}

// File: frontend/app/account/page.tsx
// END OF FILE
