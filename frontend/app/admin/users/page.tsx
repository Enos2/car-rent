// Project: Via Nostra
// File: frontend/app/admin/users/page.tsx
// Purpose: Search all accounts by name or email, and filter by role, verification
//          status and whether the account is active.

import type { Metadata } from 'next';
import Link from 'next/link';
import Field from '@/components/Field';
import Pager from '@/components/Pager';
import { apiRequest } from '@/lib/api';
import {
  ROLE_LABELS,
  VERIFICATION_STATUS,
  firstParam,
  formatDate,
} from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { PAGE_SIZE, offsetFor, pageFrom } from '@/lib/paging';
import { requireStaff } from '@/lib/session';
import type { AdminUser } from '@/lib/types';

export const metadata: Metadata = { title: 'Users' };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await requireStaff('users.read');
  const query = await searchParams;
  const filters = {
    search: firstParam(query.search),
    role: firstParam(query.role),
    verificationStatus: firstParam(query.verificationStatus),
    isActive: firstParam(query.isActive),
  };
  const page = pageFrom(firstParam(query.page));

  const api = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offsetFor(page)) });
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      api.set(key, value);
    }
  }
  const result = await apiRequest<{ items: AdminUser[]; total: number }>(
    `/admin/users?${api.toString()}`,
    { token },
  );

  return (
    <div>
      <form className="admin-filters" method="get" action="/admin/users">
        <Field label="Name or email" name="search" defaultValue={filters.search} />
        <Field
          label="Role"
          name="role"
          defaultValue={filters.role}
          options={[
            { value: '', label: 'Any' },
            ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
        <Field
          label="Verification"
          name="verificationStatus"
          defaultValue={filters.verificationStatus}
          options={[
            { value: '', label: 'Any' },
            ...Object.entries(VERIFICATION_STATUS).map(([value, entry]) => ({
              value,
              label: entry.label,
            })),
          ]}
        />
        <Field
          label="Account"
          name="isActive"
          defaultValue={filters.isActive}
          options={[
            { value: '', label: 'Any' },
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Suspended' },
          ]}
        />
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      {!result.ok ? (
        <div className="alert">{result.error.message}</div>
      ) : result.data.items.length === 0 ? (
        <div className="empty">
          <p>No accounts match.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Verification</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {result.data.items.map((person) => {
                const status = VERIFICATION_STATUS[person.verificationStatus];
                return (
                  <tr key={person.id}>
                    <td>
                      {person.fullName}
                      {person.companyName ? <p className="hint">{person.companyName}</p> : null}
                      {!person.isActive ? <span className="badge badge-bad">Suspended</span> : null}
                    </td>
                    <td>{person.email}</td>
                    <td>{person.roles.map((role) => ROLE_LABELS[role] ?? role).join(', ')}</td>
                    <td>
                      <span className={status.badge}>{status.label}</span>
                    </td>
                    <td>{formatDate(person.createdAt)}</td>
                    <td className="num">
                      <Link href={`/admin/users/${person.id}`} className="btn btn-ghost btn-small">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {result.ok ? (
        <Pager
          basePath="/admin/users"
          params={filters}
          page={page}
          pageSize={PAGE_SIZE}
          total={result.data.total}
        />
      ) : null}
    </div>
  );
}

// File: frontend/app/admin/users/page.tsx
// END OF FILE