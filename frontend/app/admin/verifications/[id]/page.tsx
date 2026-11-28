// Project: Via Nostra
// File: frontend/app/admin/verifications/[id]/page.tsx
// Purpose: Reviewing one person's verification: their details, which required
//          documents they uploaded, links to open each document, and the approve
//          and reject forms. Nobody can review their own verification.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { approveVerificationAction, rejectVerificationAction } from '@/app/admin/actions';
import Flash from '@/components/Flash';
import { apiRequest } from '@/lib/api';
import {
  DOC_LABELS,
  VERIFICATION_STATUS,
  firstParam,
  formatBytes,
  formatDateTime,
} from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import type { VerificationDetail } from '@/lib/types';

export default async function VerificationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { token, user } = await requireStaff('verification.review');

  const result = await apiRequest<VerificationDetail>(
    `/admin/verifications/${encodeURIComponent(id)}`,
    { token },
  );
  if (!result.ok) {
    if (result.status === 404 || result.status === 400) {
      notFound();
    }
    return <div className="alert">{result.error.message}</div>;
  }

  const { request, user: person, documents, requirements } = result.data;
  const isOwnRequest = request.userId === user.id;
  const pending = request.status === 'pending';
  const status = person ? VERIFICATION_STATUS[person.verificationStatus] : null;

  return (
    <div className="stack">
      <p className="hint">
        <Link href="/admin/verifications">&larr; Verification queue</Link>
      </p>
      <Flash notice={firstParam(query.notice)} error={firstParam(query.error)} />

      <div className="form-panel">
        <div className="section-head">
          <h2 style={{ margin: 0 }}>{person?.fullName ?? 'Unknown person'}</h2>
          {status ? <span className={status.badge}>{status.label}</span> : null}
        </div>
        <dl className="kv">
          <dt>Email</dt>
          <dd>{person?.email ?? '-'}</dd>
          <dt>Account</dt>
          <dd>
            {person?.accountType === 'company'
              ? `Company${person.companyName ? `: ${person.companyName}` : ''}`
              : 'Individual'}
          </dd>
          <dt>Roles</dt>
          <dd>{person?.roles.join(', ') ?? '-'}</dd>
          <dt>Request</dt>
          <dd>
            {request.status}
            {request.submittedAt ? `, submitted ${formatDateTime(request.submittedAt)}` : ''}
          </dd>
          {request.rejectionReason ? (
            <>
              <dt>Rejection reason</dt>
              <dd>{request.rejectionReason}</dd>
            </>
          ) : null}
        </dl>
      </div>

      <div className="form-panel">
        <h2>Required documents</h2>
        <ul className="checklist">
          {requirements.map((requirement) => (
            <li key={requirement.key} className={requirement.satisfied ? 'done' : ''}>
              <span className="tick">{requirement.satisfied ? '\u2713' : ''}</span>
              <span>{requirement.label}</span>
            </li>
          ))}
        </ul>
        {documents.length === 0 ? (
          <p className="hint">No documents were uploaded.</p>
        ) : (
          documents.map((document) => (
            <div className="doc-row" key={document.id}>
              <div>
                <strong>{DOC_LABELS[document.docType] ?? document.docType}</strong>
                <p className="hint">
                  {document.originalName} ({formatBytes(document.sizeBytes)})
                </p>
              </div>
              <a
                href={`/files/verification/${document.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-small"
              >
                Open
              </a>
            </div>
          ))
        )}
        <p className="hint">Opening a document is recorded in the audit log.</p>
      </div>

      {pending && isOwnRequest ? (
        <div className="callout">You cannot review your own verification. Ask another officer.</div>
      ) : null}

      {pending && !isOwnRequest ? (
        <div className="split">
          <form action={approveVerificationAction} className="form-panel">
            <h3>Approve</h3>
            <p className="hint">The person can then rent or list cars.</p>
            <input type="hidden" name="id" value={request.id} />
            <button type="submit" className="btn btn-ok">
              Approve verification
            </button>
          </form>
          <form action={rejectVerificationAction} className="form-panel">
            <h3>Reject</h3>
            <div className="field">
              <label htmlFor="reason">Reason (the person will see it)</label>
              <input id="reason" name="reason" type="text" minLength={5} maxLength={500} required />
            </div>
            <input type="hidden" name="id" value={request.id} />
            <button type="submit" className="btn btn-danger">
              Reject verification
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

// File: frontend/app/admin/verifications/[id]/page.tsx
// END OF FILE