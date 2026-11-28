// Project: Via Nostra
// File: frontend/app/admin/page.tsx
// Purpose: The staff console home: counts of the work waiting for the staff
//          member's rank (verifications, cars, hand-overs, returns, payouts), each
//          linking to its queue.

import type { Metadata } from 'next';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { ROLE_LABELS, STAFF_ROLE_VALUES } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata: Metadata = { title: 'Staff console' };

async function count(token: string, allowed: boolean, path: string): Promise<number | null> {
  if (!allowed) {
    return null;
  }
  const result = await apiRequest<{ total: number }>(path, { token });
  return result.ok ? result.data.total : null;
}

export default async function AdminOverviewPage() {
  const { token, user } = await requireStaff();
  const can = (permission: string): boolean => user.permissions.includes(permission);

  const [verifications, carsToReview, carsToInspect, handovers, returns, payouts] =
    await Promise.all([
      count(token, can('verification.review'), '/admin/verifications?status=pending&limit=1'),
      count(token, can('cars.review'), '/admin/cars?status=submitted&limit=1'),
      count(token, can('cars.review'), '/admin/cars?status=awaiting_dropoff&limit=1'),
      count(token, can('bookings.read'), '/admin/bookings?status=confirmed&limit=1'),
      count(token, can('bookings.read'), '/admin/bookings?status=in_progress&limit=1'),
      count(token, can('finance.read'), '/admin/payouts?status=requested&limit=1'),
    ]);

  const cards = [
    { label: 'Verifications to review', value: verifications, href: '/admin/verifications' },
    { label: 'Cars: documents to review', value: carsToReview, href: '/admin/cars?status=submitted' },
    { label: 'Cars waiting for drop-off', value: carsToInspect, href: '/admin/cars?status=awaiting_dropoff' },
    { label: 'Bookings to hand over', value: handovers, href: '/admin/bookings?status=confirmed' },
    { label: 'Cars out on rent', value: returns, href: '/admin/bookings?status=in_progress' },
    { label: 'Payout requests', value: payouts, href: '/admin/payouts' },
  ].filter((card) => card.value !== null);

  const ranks = user.roles.filter((role) => (STAFF_ROLE_VALUES as readonly string[]).includes(role));

  return (
    <div>
      <p className="section-intro">
        Your rank:{' '}
        {ranks.map((role) => (
          <span className="badge" key={role} style={{ marginRight: 6 }}>
            {ROLE_LABELS[role] ?? role}
          </span>
        ))}
      </p>

      {cards.length === 0 ? (
        <div className="empty">
          <p>There are no queues for your rank. Use the menu above.</p>
        </div>
      ) : (
        <div className="stats">
          {cards.map((card) => (
            <Link href={card.href} className="stat" key={card.label}>
              <div className="value">{card.value}</div>
              <div className="label">{card.label}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// File: frontend/app/admin/page.tsx
// END OF FILE