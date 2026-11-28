// Project: Via Nostra
// File: frontend/app/admin/cars/[id]/page.tsx
// Purpose: Reviewing one car: the owner, the documents (logbook, registration,
//          insurance), the photos, approving or sending back the documents, the hub
//          inspection (upload inspection photos, then record pass or fail), and
//          suspending or reinstating a live car.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  approveCarDocumentsAction,
  recordInspectionAction,
  reinstateCarAction,
  rejectCarAction,
  suspendCarAction,
  uploadInspectionPhotosAction,
} from '@/app/admin/actions';
import Field from '@/components/Field';
import Flash from '@/components/Flash';
import { apiRequest } from '@/lib/api';
import {
  CAR_STATUS,
  DOC_LABELS,
  firstParam,
  formatBytes,
  formatDate,
  formatDateTime,
  formatMoney,
} from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import type { AdminCarDetail } from '@/lib/types';

export default async function AdminCarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { token, user } = await requireStaff('cars.review');

  const result = await apiRequest<AdminCarDetail>(`/admin/cars/${encodeURIComponent(id)}`, { token });
  if (!result.ok) {
    if (result.status === 404 || result.status === 400) {
      notFound();
    }
    return <div className="alert">{result.error.message}</div>;
  }

  const { car, owner, documents, photos, inspections, readiness } = result.data;
  const can = (permission: string): boolean => user.permissions.includes(permission);
  const status = CAR_STATUS[car.status];
  const listing = photos.filter((photo) => photo.kind === 'listing');
  const inspectionPhotos = photos.filter((photo) => photo.kind === 'inspection');
  const pendingInspection = inspectionPhotos.filter((photo) => photo.inspectionId === null);
  const isOwnCar = car.ownerId === user.id;

  return (
    <div className="stack">
      <p className="hint">
        <Link href="/admin/cars">&larr; Cars</Link>
      </p>
      <Flash notice={firstParam(query.notice)} error={firstParam(query.error)} />

      <div className="form-panel">
        <div className="section-head">
          <h2 style={{ margin: 0 }}>
            {car.year} {car.make} {car.model}
          </h2>
          <span className={status.badge}>{status.label}</span>
        </div>
        <dl className="kv">
          <dt>Plate</dt>
          <dd>{car.plateNumber}</dd>
          <dt>VIN</dt>
          <dd>{car.vin ?? '-'}</dd>
          <dt>Price</dt>
          <dd>
            {formatMoney(car.dailyPriceMinor, car.currency)} per day, deposit{' '}
            {formatMoney(car.depositMinor, car.currency)}
          </dd>
          <dt>Specs</dt>
          <dd>
            {car.seats} seats, {car.transmission}, {car.fuelType}
          </dd>
          <dt>Owner</dt>
          <dd>
            {owner ? (
              <>
                {owner.companyName ? `${owner.companyName} - ` : ''}
                {owner.fullName} ({owner.email})
                {can('users.read') ? (
                  <>
                    {' '}
                    <Link href={`/admin/users/${owner.id}`}>profile</Link>
                  </>
                ) : null}
              </>
            ) : (
              '-'
            )}
          </dd>
          <dt>Submitted</dt>
          <dd>{car.submittedAt ? formatDateTime(car.submittedAt) : '-'}</dd>
          {car.rejectionReason ? (
            <>
              <dt>Note</dt>
              <dd>{car.rejectionReason}</dd>
            </>
          ) : null}
        </dl>
      </div>

      <div className="form-panel">
        <h2>Documents</h2>
        {documents.length === 0 ? <p className="hint">No documents uploaded.</p> : null}
        {documents.map((document) => (
          <div className="doc-row" key={document.id}>
            <div>
              <strong>{DOC_LABELS[document.docType] ?? document.docType}</strong>
              <p className="hint">
                {document.originalName} ({formatBytes(document.sizeBytes)})
                {document.expiresOn ? `, valid until ${formatDate(document.expiresOn)}` : ''}
              </p>
            </div>
            <a
              href={`/files/car-document/${document.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-small"
            >
              Open
            </a>
          </div>
        ))}
        {!readiness.ready ? (
          <ul className="checklist" style={{ marginTop: 12 }}>
            {readiness.problems.map((problem) => (
              <li key={problem}>
                <span className="tick" />
                <span>{problem}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="hint">Opening a document is recorded in the audit log.</p>
      </div>

      <div className="form-panel">
        <h2>Listing photos</h2>
        {listing.length === 0 ? (
          <p className="hint">No photos.</p>
        ) : (
          <div className="photo-grid">
            {listing.map((photo) => (
              <div className="photo-tile" key={photo.id}>
                <img src={`/photos/${car.id}/${photo.id}`} alt={`Photo ${photo.position + 1}`} />
              </div>
            ))}
          </div>
        )}
      </div>

      {car.status === 'submitted' && !isOwnCar ? (
        <div className="split">
          <form action={approveCarDocumentsAction} className="form-panel">
            <h3>Approve documents</h3>
            <p className="hint">The owner can then bring the car to the hub for inspection.</p>
            <input type="hidden" name="carId" value={car.id} />
            <button type="submit" className="btn btn-ok" disabled={!readiness.ready}>
              Approve documents
            </button>
            {!readiness.ready ? <p className="hint">The listing is not complete.</p> : null}
          </form>
          <form action={rejectCarAction} className="form-panel">
            <h3>Send back to the owner</h3>
            <div className="field">
              <label htmlFor="reject-reason">Reason (the owner will see it)</label>
              <input id="reject-reason" name="reason" type="text" minLength={5} maxLength={500} required />
            </div>
            <input type="hidden" name="carId" value={car.id} />
            <button type="submit" className="btn btn-danger">
              Send back
            </button>
          </form>
        </div>
      ) : null}
      {car.status === 'submitted' && isOwnCar ? (
        <div className="callout">You cannot review your own car.</div>
      ) : null}

      {car.status === 'awaiting_dropoff' && can('cars.inspect') && !isOwnCar ? (
        <div className="form-panel">
          <h2>Hub inspection</h2>
          <p className="hint">
            Step 1: photograph the car (at least 4 photos). Step 2: record what you found. A pass puts
            the car live.
          </p>

          {pendingInspection.length > 0 ? (
            <div className="photo-grid">
              {pendingInspection.map((photo) => (
                <div className="photo-tile" key={photo.id}>
                  <img src={`/photos/${car.id}/${photo.id}`} alt="Inspection photo" />
                </div>
              ))}
            </div>
          ) : (
            <p className="hint">No inspection photos yet.</p>
          )}

          <form action={uploadInspectionPhotosAction} className="inline-form">
            <input type="hidden" name="carId" value={car.id} />
            <input type="file" name="photos" accept="image/jpeg,image/png" multiple required />
            <button type="submit" className="btn btn-ghost btn-small">
              Upload photos
            </button>
            <span className="hint">Up to 5 at a time. {pendingInspection.length} so far.</span>
          </form>

          <form action={recordInspectionAction} style={{ marginTop: 20 }}>
            <input type="hidden" name="carId" value={car.id} />
            <div className="form-grid">
              <Field
                label="Result"
                name="result"
                defaultValue="passed"
                options={[
                  { value: 'passed', label: 'Passed - put the car live' },
                  { value: 'failed', label: 'Failed - send back to the owner' },
                ]}
              />
              <Field label="Odometer (km)" name="odometerKm" type="number" min={0} required />
              <Field label="Fuel level (%)" name="fuelLevelPercent" type="number" min={0} max={100} required />
              <div className="wide">
                <Field
                  label="Condition notes"
                  name="conditionNotes"
                  rows={4}
                  minLength={10}
                  maxLength={2000}
                  required
                  hint="Describe the condition, any damage and anything the next person should know."
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">
              Record inspection
            </button>
          </form>
        </div>
      ) : null}
      {car.status === 'awaiting_dropoff' && isOwnCar ? (
        <div className="callout">You cannot inspect your own car.</div>
      ) : null}

      {(car.status === 'live' || car.status === 'paused') && !isOwnCar ? (
        <form action={suspendCarAction} className="form-panel">
          <h3>Suspend this car</h3>
          <p className="hint">Hides the car from search. Use for safety or policy problems.</p>
          <div className="field">
            <label htmlFor="suspend-reason">Reason</label>
            <input id="suspend-reason" name="reason" type="text" minLength={5} maxLength={500} required />
          </div>
          <input type="hidden" name="carId" value={car.id} />
          <button type="submit" className="btn btn-danger">
            Suspend car
          </button>
        </form>
      ) : null}

      {car.status === 'suspended' ? (
        <form action={reinstateCarAction} className="form-panel">
          <h3>Reinstate this car</h3>
          <input type="hidden" name="carId" value={car.id} />
          <button type="submit" className="btn btn-ok">
            Put the car live again
          </button>
        </form>
      ) : null}

      {inspections.length > 0 ? (
        <div className="form-panel">
          <h2>Inspection history</h2>
          {inspections.map((inspection) => {
            const related = inspectionPhotos.filter((photo) => photo.inspectionId === inspection.id);
            return (
              <div className="doc-row" key={inspection.id}>
                <div>
                  <strong>{inspection.result === 'passed' ? 'Passed' : 'Failed'}</strong>
                  <p className="hint">
                    {formatDateTime(inspection.createdAt)} &middot; {inspection.odometerKm} km &middot; fuel{' '}
                    {inspection.fuelLevelPercent}%
                  </p>
                  <p>{inspection.conditionNotes}</p>
                  {related.length > 0 ? (
                    <div className="photo-grid" style={{ marginTop: 8 }}>
                      {related.map((photo) => (
                        <div className="photo-tile" key={photo.id}>
                          <img src={`/photos/${car.id}/${photo.id}`} alt="Inspection photo" />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// File: frontend/app/admin/cars/[id]/page.tsx
// END OF FILE