// Project: Via Nostra
// File: frontend/app/admin/layout.tsx
// Purpose: The frame of the staff console: only logged-in staff can enter. It shows
//          the menu with only the sections the person's rank allows.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireStaff } from '@/lib/session';
import './admin.css';

const LINKS = [
  { href: '/admin', label: 'Overview', permission: null },
  { href: '/admin/verifications', label: 'Verifications', permission: 'verification.review' },
  { href: '/admin/cars', label: 'Cars', permission: 'cars.review' },
  { href: '/admin/bookings', label: 'Bookings', permission: 'bookings.read' },
  { href: '/admin/payouts', label: 'Payouts', permission: 'finance.read' },
  { href: '/admin/finance', label: 'Finance', permission: 'finance.read' },
  { href: '/admin/users', label: 'Users', permission: 'users.read' },
  { href: '/admin/hubs', label: 'Hubs', permission: 'hubs.manage' },
  { href: '/admin/audit', label: 'Audit log', permission: 'audit.read' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await requireStaff();
  const links = LINKS.filter(
    (link) => !link.permission || user.permissions.includes(link.permission),
  );

  return (
    <div className="container page">
      <div className="section-head">
        <h1>Staff console</h1>
        <span className="hint">{user.fullName}</span>
      </div>
      <nav className="subnav">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}

// File: frontend/app/admin/layout.tsx
// END OF FILE