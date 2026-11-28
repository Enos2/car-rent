// Project: Via Nostra
// File: frontend/app/admin/users/[id]/page.tsx
// Purpose: One account: its details, and the controls for staff ranks (super admin
//          only) and for suspending or reactivating the account. Nobody can change
//          their own ranks or suspend themselves.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { changeStaffRolesAction, setUserActiveAction } from '@/app/admin/actions';
import Flash from '@/components/Flash';
import { apiRequest } from '@/lib/api';
import {
  ROLE_LABELS,
  STAFF_ROLE_VALUES,
  VERIFICATION_STATUS,
  firstParam,
  formatDateTime,
} from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import type { AdminUser } from '@/lib/types';

export default async function AdminUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { token, user } = await requireStaff('users.read');

  const result = await apiRequest<{ user: AdminUser }>(`/admin/users/${encodeURIComponent(id)}`, {
    token,
  });
  if (!result.ok) {
    if (result.status === 404 || result.status === 400) {
      notFound();
    }
    return <div className="alert">{result.error.message}</div>;
  }

  const person = result.data.user;
  const can = (permission: string): boolean => user.permissions.includes(permission);
  const isSelf = person.id === user.id;
  const status = VERIFICATION_STATUS[person.verificationStatus];

  return (
    <div className="stack">
      <p className="hint">
        <Link href="/admin/users">&larr; Users</Link>
      </p>
      <Flash notice={firstParam(query.notice)} error={firstParam(query.error)} />

      <div className="form-panel">
        <div className="section-head">
          <h2 style={{ margin: 0 }}>{person.fullName}</h2>
          <span className={status.badge}>{status.label}</span>
        </div>
        <dl className="kv">
          <dt>Email</dt>
          <dd>{person.email}</dd>
          <dt>Account</dt>
          <dd>
            {person.accountType === 'company'
              ? `Company${person.companyName ? `: ${person.companyName}` : ''}`
              : 'Individual'}
          </dd>
          <dt>Roles</dt>
          <dd>{person.roles.map((role) => ROLE_LABELS[role] ?? role).join(', ')}</dd>
          <dt>Status</dt>
          <dd>{person.isActive ? 'Active' : 'Suspended'}</dd>
          <dt>Joined</dt>
          <dd>{formatDateTime(person.createdAt)}</dd>
        </dl>
      </div>

      {can('staff.manage') && !isSelf ? (
        <form action={changeStaffRolesAction} className="form-panel">
          <h3>Staff ranks</h3>
          <p className="hint">
            Choose the staff ranks this person has. Renter and owner roles are not affected.
          </p>
          <input type="hidden" name="userId" value={person.id} />
          <div className="role-grid">
            {STAFF_ROLE_VALUES.map((role) => (
              <label className="choice" key={role}>
                <input
                  type="checkbox"
                  name="staffRoles"
                  value={role}
                  defaultChecked={person.roles.includes(role)}
                />
                {ROLE_LABELS[role]}
              </label>
            ))}
          </div>
          <button type="submit" className="btn btn-primary">
            Save ranks
          </button>
        </form>
      ) : null}
      {can('staff.manage') && isSelf ? (
        <div className="callout">You cannot change your own ranks.</div>
      ) : null}

      {can('users.manage') && !isSelf ? (
        <form action={setUserActiveAction} className="form-panel">
          <h3>{person.isActive ? 'Suspend this account' : 'Reactivate this account'}</h3>
          <p className="hint">
            {person.isActive
              ? 'The person can no longer log in or use Via Nostra.'
              : 'The person can log in again.'}
          </p>
          <input type="hidden" name="userId" value={person.id} />
          <input type="hidden" name="active" value={person.isActive ? 'false' : 'true'} />
          <div className="field">
            <label htmlFor="active-reason">Reason</label>
            <input id="active-reason" name="reason" type="text" minLength={3} maxLength={500} required />
          </div>
          <button type="submit" className={person.isActive ? 'btn btn-danger' : 'btn btn-ok'}>
            {person.isActive ? 'Suspend account' : 'Reactivate account'}
          </button>
        </form>
      ) : null}
    </div>
  );
}

// File: frontend/app/admin/users/[id]/page.tsx
// END OF FILE