// Project: Via Nostra
// File: frontend/app/admin/reports/page.tsx
// Purpose: The moderation queue: what people reported, oldest first. Staff close
//          each report with a note, and can also hide a reported review or post, or
//          suspend a reported car, if their rank allows it.

import type { Metadata } from 'next';
import Link from 'next/link';
import { resolveReportAction } from '@/app/admin/trust-admin-actions';
import Flash from '@/components/Flash';
import Pager from '@/components/Pager';
import StatusTabs from '@/components/StatusTabs';
import { apiRequest } from '@/lib/api';
import { firstParam, formatDateTime } from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { PAGE_SIZE, offsetFor, pageFrom } from '@/lib/paging';
import { requireStaff } from '@/lib/session';
import { REPORT_REASON_LABELS, REPORT_TARGET_LABELS } from '@/lib/trust';
import type { ReportItem } from '@/lib/trust';

export const metadata: Metadata = { title: 'Reports' };

const TABS = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { token, user } = await requireStaff('reports.review');
  const query = await searchParams;
  const status = firstParam(query.status) || 'open';
  const page = pageFrom(firstParam(query.page));
  const can = (permission: string): boolean => user.permissions.includes(permission);

  const result = await apiRequest<{ items: ReportItem[]; total: number }>(
    `/admin/reports?status=${encodeURIComponent(status)}&limit=${PAGE_SIZE}&offset=${offsetFor(page)}`,
    { token },
  );

  return (
    <div>
      <Flash notice={firstParam(query.notice)} error={firstParam(query.error)} />
      <StatusTabs tabs={TABS} current={status} basePath="/admin/reports" />

      {!result.ok ? (
        <div className="alert">{result.error.message}</div>
      ) : result.data.items.length === 0 ? (
        <div className="empty">
          <p>No reports in this list.</p>
        </div>
      ) : (
        <div className="stack">
          {result.data.items.map((report) => (
            <div className="form-panel" key={report.id}>
              <div className="section-head">
                <h3 style={{ margin: 0 }}>
                  {REPORT_TARGET_LABELS[report.targetType]}: {report.targetLabel ?? 'No longer available'}
                </h3>
                <span className="badge badge-warn">{REPORT_REASON_LABELS[report.reason] ?? report.reason}</span>
              </div>
              <p>{report.details}</p>
              <p className="hint">
                Reported by {report.reporterEmail} on {formatDateTime(report.createdAt)}
                {report.targetType === 'car' && can('cars.review') ? (
                  <>
                    {' '}
                    &middot; <Link href={`/admin/cars/${report.targetId}`}>open the car</Link>
                  </>
                ) : null}
                {report.targetType === 'user' && can('users.read') ? (
                  <>
                    {' '}
                    &middot; <Link href={`/admin/users/${report.targetId}`}>open the account</Link>
                  </>
                ) : null}
              </p>

              {report.status === 'open' ? (
                <form action={resolveReportAction} className="stack">
                  <input type="hidden" name="id" value={report.id} />
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor={`note-${report.id}`}>Your note</label>
                      <input id={`note-${report.id}`} name="note" type="text" minLength={5} maxLength={500} required />
                    </div>
                    {report.targetType === 'review' ||
                    (report.targetType === 'post' && can('content.manage')) ||
                    (report.targetType === 'car' && can('cars.review')) ? (
                      <div className="field">
                        <label htmlFor={`action-${report.id}`}>Action (when resolving)</label>
                        <select id={`action-${report.id}`} name="action" defaultValue="">
                          <option value="">No action</option>
                          {report.targetType === 'review' ? (
                            <option value="hide_review">Hide the review</option>
                          ) : null}
                          {report.targetType === 'post' ? (
                            <option value="hide_post">Hide the post</option>
                          ) : null}
                          {report.targetType === 'car' ? (
                            <option value="suspend_car">Suspend the car</option>
                          ) : null}
                        </select>
                      </div>
                    ) : null}
                  </div>
                  <div className="actions" style={{ marginTop: 0 }}>
                    <button type="submit" name="outcome" value="resolved" className="btn btn-ok btn-small">
                      Resolve
                    </button>
                    <button type="submit" name="outcome" value="dismissed" className="btn btn-ghost btn-small">
                      Dismiss
                    </button>
                  </div>
                </form>
              ) : (
                <p className="hint">
                  {report.status === 'resolved' ? 'Resolved' : 'Dismissed'}
                  {report.resolvedAt ? ` on ${formatDateTime(report.resolvedAt)}` : ''}
                  {report.resolutionNote ? `: ${report.resolutionNote}` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {result.ok ? (
        <Pager
          basePath="/admin/reports"
          params={{ status }}
          page={page}
          pageSize={PAGE_SIZE}
          total={result.data.total}
        />
      ) : null}
    </div>
  );
}

// File: frontend/app/admin/reports/page.tsx
// END OF FILE