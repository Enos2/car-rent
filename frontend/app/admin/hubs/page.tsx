// Project: Via Nostra
// File: frontend/app/admin/hubs/page.tsx
// Purpose: The hubs: the drop-off and inspection locations. Lists every hub with its
//          status and shows the form for opening a new hub.

import type { Metadata } from 'next';
import Link from 'next/link';
import { createHubAction } from '@/app/admin/actions';
import Field from '@/components/Field';
import Flash from '@/components/Flash';
import { apiRequest } from '@/lib/api';
import { firstParam } from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import type { Hub } from '@/lib/types';

export const metadata: Metadata = { title: 'Hubs' };

export default async function AdminHubsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await requireStaff('hubs.manage');
  const query = await searchParams;
  const result = await apiRequest<{ items: Hub[] }>('/admin/hubs', { token });

  return (
    <div className="stack">
      <Flash notice={firstParam(query.notice)} error={firstParam(query.error)} />

      {!result.ok ? (
        <div className="alert">{result.error.message}</div>
      ) : result.data.items.length === 0 ? (
        <div className="empty">
          <p>No hubs yet. Open the first one below.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Hub</th>
                <th>City</th>
                <th>Address</th>
                <th>Hours</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {result.data.items.map((hub) => (
                <tr key={hub.id}>
                  <td>{hub.name}</td>
                  <td>
                    {hub.city}, {hub.countryCode}
                  </td>
                  <td>{hub.address}</td>
                  <td>{hub.openingHours ?? '-'}</td>
                  <td>
                    <span className={hub.isActive ? 'badge badge-ok' : 'badge badge-bad'}>
                      {hub.isActive ? 'Open' : 'Closed'}
                    </span>
                  </td>
                  <td className="num">
                    <Link href={`/admin/hubs/${hub.id}`} className="btn btn-ghost btn-small">
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form action={createHubAction} className="form-panel">
        <h2>Open a new hub</h2>
        <div className="form-grid">
          <Field label="Name" name="name" required minLength={2} maxLength={120} />
          <Field label="City" name="city" required minLength={2} maxLength={100} />
          <Field label="Country code (2 letters)" name="countryCode" required minLength={2} maxLength={2} />
          <Field label="Address" name="address" required minLength={5} maxLength={255} />
          <Field label="Opening hours" name="openingHours" maxLength={255} placeholder="08:00-18:00 every day" />
          <Field label="Contact phone" name="contactPhone" maxLength={40} />
          <Field label="Latitude (optional)" name="latitude" type="number" step="any" min={-90} max={90} />
          <Field label="Longitude (optional)" name="longitude" type="number" step="any" min={-180} max={180} />
        </div>
        <button type="submit" className="btn btn-primary">
          Create hub
        </button>
      </form>
    </div>
  );
}

// File: frontend/app/admin/hubs/page.tsx
// END OF FILE