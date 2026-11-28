// Project: Via Nostra
// File: frontend/app/verify/page.tsx
// Purpose: The identity verification page: shows which documents are needed, lets
//          the person upload each one, and submits them for review by our team.
//          Only verified people can rent or list cars.

import type { Metadata } from 'next';
import {
  submitVerificationAction,
  uploadVerificationDocumentAction,
} from '@/app/verify/actions';
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
import { requireUser } from '@/lib/session';
import type { VerificationMe } from '@/lib/types';

export const metadata: Metadata = { title: 'Verify your identity' };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { token, user } = await requireUser();
  const query = await searchParams;
  const result = await apiRequest<VerificationMe>('/verification/me', { token });

  if (!result.ok) {
    return (
      <div className="container page">
        <div className="alert">{result.error.message}</div>
      </div>
    );
  }

  const data = result.data;
  const open =
    data.request !== null && (data.request.status === 'draft' || data.request.status === 'pending');
  const documents = open ? data.documents : [];
  const uploaded = new Set(documents.map((document) => document.docType));
  const requirements = data.requirements.map((requirement) => ({
    ...requirement,
    satisfied: requirement.anyOf.some((type) => uploaded.has(type)),
  }));
  const allDone = requirements.every((requirement) => requirement.satisfied);
  const status = VERIFICATION_STATUS[user.verificationStatus];
  const editable =
    user.verificationStatus === 'unverified' || user.verificationStatus === 'rejected';
  const rejection =
    data.request?.status === 'rejected' ? data.request.rejectionReason : null;

  return (
    <div className="container page">
      <div className="section-head">
        <h1>Verify your identity</h1>
        <span className={status.badge}>{status.label}</span>
      </div>
      <p className="section-intro">
        Everyone on Via Nostra is checked before they can rent or list a car. Your documents are
        private and only our verification team can see them.
      </p>

      <Flash notice={firstParam(query.notice)} error={firstParam(query.error)} />

      {user.verificationStatus === 'verified' ? (
        <div className="notice">You are verified. You can rent and list cars.</div>
      ) : null}
      {user.verificationStatus === 'pending' ? (
        <div className="callout">
          Your documents were submitted
          {data.request?.submittedAt ? ` on ${formatDateTime(data.request.submittedAt)}` : ''} and are
          being reviewed. We will update your status here.
        </div>
      ) : null}
      {rejection ? (
        <div className="alert">
          Your last submission was not approved: {rejection}. Please upload the documents again.
        </div>
      ) : null}

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

        {requirements.map((requirement) => {
          const current = documents.filter((document) => requirement.anyOf.includes(document.docType));
          return (
            <div className="doc-row" key={requirement.key}>
              <div>
                <strong>{requirement.label}</strong>
                {current.length > 0 ? (
                  current.map((document) => (
                    <p className="hint" key={document.id}>
                      {DOC_LABELS[document.docType] ?? document.docType}: {document.originalName} (
                      {formatBytes(document.sizeBytes)})
                    </p>
                  ))
                ) : (
                  <p className="hint">Not uploaded yet</p>
                )}
              </div>
              {editable ? (
                <form action={uploadVerificationDocumentAction} className="inline-form">
                  {requirement.anyOf.length > 1 ? (
                    <select name="docType" aria-label="Document type" defaultValue={requirement.anyOf[0]}>
                      {requirement.anyOf.map((type) => (
                        <option key={type} value={type}>
                          {DOC_LABELS[type] ?? type}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input type="hidden" name="docType" value={requirement.anyOf[0]} />
                  )}
                  <input
                    type="file"
                    name="file"
                    accept="image/jpeg,image/png,application/pdf"
                    required
                  />
                  <button type="submit" className="btn btn-ghost btn-small">
                    {current.length > 0 ? 'Replace' : 'Upload'}
                  </button>
                </form>
              ) : null}
            </div>
          );
        })}
        <p className="hint">JPG, PNG or PDF, up to 5 MB each.</p>
      </div>

      {editable ? (
        <form action={submitVerificationAction}>
          <button type="submit" className="btn btn-primary" disabled={!allDone}>
            Submit for review
          </button>
          {!allDone ? <p className="hint">Upload every required document first.</p> : null}
        </form>
      ) : null}
    </div>
  );
}

// File: frontend/app/verify/page.tsx
// END OF FILE