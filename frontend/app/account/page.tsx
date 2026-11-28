// Project: Via Nostra
// File: frontend/app/account/page.tsx
// Purpose: The logged-in person's account page: their details, roles and
//          verification status, with links to verify, to the owner dashboard and to
//          the staff console. Visitors who are not logged in are sent to login.

import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { ROLE_LABELS, VERIFICATION_STATUS } from '@/lib/format';

export const metadata: Metadata = { title: 'My account' };

export default async function AccountPage() {
  const { user } = await requireUser();
  const verification = VERIFICATION_STATUS[user.verificationStatus];
  const isOwner = user.roles.includes('owner');
  const isStaff = user.permissions.length > 0;

  return (
    <div className="container account">
      <h1>Hello, {user.fullName}</h1>
      <p className="section-intro">This is your Via Nostra account.</p>

      {user.verificationStatus !== 'verified' ? (
        <div className="callout">
          {user.verificationStatus === 'pending'
            ? 'Your documents are being reviewed.'
            : 'Verify your identity to rent or list cars.'}{' '}
          <Link href="/verify">Open verification</Link>
        </div>
      ) : null}

      <div className="card">
        <span className={verification.badge}>{verification.label}</span>
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
                  {ROLE_LABELS[role] ?? role}
                </span>
              ))}
            </span>
          </dd>
          <dt>Member since</dt>
          <dd>{new Date(user.createdAt).toLocaleDateString('en-GB')}</dd>
        </dl>
      </div>

      <div className="actions">
        <Link href="/verify" className="btn btn-ghost">
          Verification
        </Link>
        {user.roles.includes('renter') ? (
          <Link href="/bookings" className="btn btn-ghost">
            My bookings
          </Link>
        ) : null}
        {isOwner ? (
          <Link href="/owner" className="btn btn-ghost">
            Owner dashboard
          </Link>
        ) : null}
        {isStaff ? (
          <Link href="/admin" className="btn btn-ghost">
            Staff console
          </Link>
        ) : null}
      </div>
    </div>
  );
}

// File: frontend/app/account/page.tsx
// END OF FILE