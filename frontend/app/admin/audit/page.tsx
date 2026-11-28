// Project: Via Nostra
// File: frontend/app/admin/audit/page.tsx
// Purpose: The audit log: the permanent record of what every staff member did and
//          when, newest first. It can be filtered by what kind of thing was changed.

import type { Metadata } from 'next';
import Field from '@/components/Field';
import Pager from '@/components/Pager';
import { apiRequest } from '@/lib/api';
import { firstParam, formatDateTime } from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { PAGE_SIZE, offsetFor, pageFrom } from '@/lib/paging';
import { requireStaff } from '@/lib/session';
import type { AuditItem } from '@/lib/types';

export const metadata: Metadata = { title: 'Audit log' };

const ENTITY_TYPES = [
  'user',
  'hub',
  'verification_request',
  'verification_document',
  'car',
  'car_document',
  'booking',
  'payout',
];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await requireStaff('audit.read');
  const query = await searchParams;
  const entityType = firstParam(query.entityType);
  const page = pageFrom(firstParam(query.page));

  const api = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offsetFor(page)) });
  if (entityType) {
    api.set('entityType', entityType);
  }
  const result = await apiRequest<{ items: AuditItem[] }>(`/admin/audit-log?${api.toString()}`, {
    token,
  });

  return (
    <div>
      <form className="admin-filters" method="get" action="/admin/audit">
        <Field
          label="What changed"
          name="entityType"
          defaultValue={entityType}
          options={[
            { value: '', label: 'Everything' },
            ...ENTITY_TYPES.map((type) => ({ value: type, label: type.replaceAll('_', ' ') })),
          ]}
        />
        <button type="submit" className="btn btn-primary">
          Filter
        </button>
      </form>

      {!result.ok ? (
        <div className="alert">{result.error.message}</div>
      ) : result.data.items.length === 0 ? (
        <div className="empty">
          <p>Nothing recorded yet.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>On</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {result.data.items.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.createdAt)}</td>
                  <td>{item.actorEmail ?? 'System'}</td>
                  <td className="mono">{item.action}</td>
                  <td>
                    {item.entityType.replaceAll('_', ' ')}
                    {item.entityId ? <p className="hint mono">{item.entityId.slice(0, 8)}</p> : null}
                  </td>
                  <td>
                    <p className="meta">{JSON.stringify(item.metadata)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result.ok ? (
        <Pager
          basePath="/admin/audit"
          params={{ entityType }}
          page={page}
          pageSize={PAGE_SIZE}
          hasNext={result.data.items.length === PAGE_SIZE}
        />
      ) : null}
    </div>
  );
}

// File: frontend/app/admin/audit/page.tsx
// END OF FILE