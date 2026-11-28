// Project: Via Nostra
// File: frontend/app/admin/hubs/[id]/page.tsx
// Purpose: One hub: edit its details or close it, and manage the staff assigned to
//          it. Only assigned staff (and super admins) can inspect cars and hand
//          over or receive cars at this hub.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  addHubStaffAction,
  removeHubStaffAction,
  updateHubAction,
} from '@/app/admin/actions';
import Field from '@/components/Field';
import Flash from '@/components/Flash';
import { apiRequest } from '@/lib/api';
import { ROLE_LABELS, firstParam } from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import type { Hub, HubStaffMember } from '@/lib/types';

export default async function AdminHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { token } = await requireStaff('hubs.manage');

  const [hubs, staff] = await Promise.all([
    apiRequest<{ items: Hub[] }>('/admin/hubs', { token }),
    apiRequest<{ items: HubStaffMember[] }>(`/admin/hubs/${encodeURIComponent(id)}/staff`, { token }),
  ]);
  if (!hubs.ok) {
    return <div className="alert">{hubs.error.message}</div>;
  }
  const hub = hubs.data.items.find((entry) => entry.id === id);
  if (!hub) {
    notFound();
  }
  const members = staff.ok ? staff.data.items : [];

  return (
    <div className="stack">
      <p className="hint">
        <Link href="/admin/hubs">&larr; Hubs</Link>
      </p>
      <Flash notice={firstParam(query.notice)} error={firstParam(query.error)} />

      <form action={updateHubAction} className="form-panel">
        <h2>{hub.name}</h2>
        <input type="hidden" name="id" value={hub.id} />
        <div className="form-grid">
          <Field label="Name" name="name" defaultValue={hub.name} required minLength={2} maxLength={120} />
          <Field label="City" name="city" defaultValue={hub.city} required minLength={2} maxLength={100} />
          <Field label="Country code" name="countryCode" defaultValue={hub.countryCode} required minLength={2} maxLength={2} />
          <Field label="Address" name="address" defaultValue={hub.address} required minLength={5} maxLength={255} />
          <Field label="Opening hours" name="openingHours" defaultValue={hub.openingHours ?? ''} maxLength={255} />
          <Field label="Contact phone" name="contactPhone" defaultValue={hub.contactPhone ?? ''} maxLength={40} />
          <Field label="Latitude" name="latitude" type="number" step="any" defaultValue={hub.latitude ?? ''} min={-90} max={90} />
          <Field label="Longitude" name="longitude" type="number" step="any" defaultValue={hub.longitude ?? ''} min={-180} max={180} />
          <Field
            label="Status"
            name="isActive"
            defaultValue={hub.isActive ? 'true' : 'false'}
            options={[
              { value: 'true', label: 'Open' },
              { value: 'false', label: 'Closed (hidden from owners)' },
            ]}
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Save changes
        </button>
      </form>

      <div className="form-panel">
        <h2>Staff at this hub</h2>
        {members.length === 0 ? (
          <p className="hint">No staff assigned yet.</p>
        ) : (
          members.map((member) => (
            <div className="doc-row" key={member.id}>
              <div>
                <strong>{member.fullName}</strong>
                <p className="hint">
                  {member.email} &middot; {member.roles.map((role) => ROLE_LABELS[role] ?? role).join(', ')}
                </p>
              </div>
              <form action={removeHubStaffAction} className="inline-form">
                <input type="hidden" name="hubId" value={hub.id} />
                <input type="hidden" name="userId" value={member.id} />
                <button type="submit" className="btn btn-danger btn-small">
                  Remove
                </button>
              </form>
            </div>
          ))
        )}

        <form action={addHubStaffAction} className="inline-form" style={{ marginTop: 16 }}>
          <input type="hidden" name="hubId" value={hub.id} />
          <input type="email" name="email" placeholder="Staff member's email" required />
          <button type="submit" className="btn btn-ghost btn-small">
            Add to this hub
          </button>
        </form>
        <p className="hint">The person must already have an account with a staff rank.</p>
      </div>
    </div>
  );
}

// File: frontend/app/admin/hubs/[id]/page.tsx
// END OF FILE