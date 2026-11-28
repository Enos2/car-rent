// Project: Via Nostra
// File: frontend/app/owner/cars/[id]/page.tsx
// Purpose: Where an owner manages one car: edit its details, upload the logbook,
//          registration and insurance, add or remove photos, choose a hub and submit
//          for review, then pause, resume or remove it. Shows what happens next.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  deleteCarPhotoAction,
  pauseCarAction,
  resumeCarAction,
  retireCarAction,
  submitCarAction,
  updateCarAction,
  uploadCarDocumentAction,
  uploadCarPhotosAction,
} from '@/app/owner/actions';
import CarForm from '@/components/CarForm';
import Flash from '@/components/Flash';
import { apiRequest } from '@/lib/api';
import {
  CAR_DETAILS_EDITABLE,
  CAR_DOCUMENTS_EDITABLE,
  CAR_IDENTITY_EDITABLE,
  CAR_PHOTOS_EDITABLE,
  CAR_RETIRABLE,
  CAR_STATUS,
  DOC_LABELS,
  firstParam,
  formatBytes,
  formatDate,
  formatDateTime,
  fromMinor,
} from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { requireUser } from '@/lib/session';
import type { CarFormValues, Hub, OwnerCarDetail } from '@/lib/types';

const DOC_TYPES = ['logbook', 'registration', 'insurance'] as const;

export default async function ManageCarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { token } = await requireUser();

  const [carResult, hubsResult] = await Promise.all([
    apiRequest<OwnerCarDetail>(`/cars/mine/${encodeURIComponent(id)}`, { token }),
    apiRequest<{ items: Hub[] }>('/hubs'),
  ]);

  if (!carResult.ok) {
    if (carResult.status === 0) {
      return (
        <div className="container page">
          <div className="alert">{carResult.error.message}</div>
        </div>
      );
    }
    notFound();
  }

  const { car, documents, photos, inspections, readiness } = carResult.data;
  const hubs = hubsResult.ok ? hubsResult.data.items : [];
  const hub = hubs.find((entry) => entry.id === car.hubId);
  const status = CAR_STATUS[car.status];
  const canEditDetails = CAR_DETAILS_EDITABLE.includes(car.status);
  const identityLocked = !CAR_IDENTITY_EDITABLE.includes(car.status);
  const canEditDocs = CAR_DOCUMENTS_EDITABLE.includes(car.status);
  const canEditPhotos = CAR_PHOTOS_EDITABLE.includes(car.status);
  const listingPhotos = photos.filter((photo) => photo.kind === 'listing');

  const initial: Partial<CarFormValues> = {
    make: car.make,
    model: car.model,
    year: String(car.year),
    plateNumber: car.plateNumber,
    vin: car.vin ?? '',
    color: car.color ?? '',
    seats: String(car.seats),
    transmission: car.transmission,
    fuelType: car.fuelType,
    description: car.description ?? '',
    currency: car.currency,
    dailyPrice: fromMinor(car.dailyPriceMinor),
    deposit: fromMinor(car.depositMinor),
    minRentalDays: String(car.minRentalDays),
    maxRentalDays: String(car.maxRentalDays),
  };

  return (
    <div className="container page">
      <p className="hint">
        <Link href="/owner">&larr; Owner dashboard</Link>
      </p>
      <div className="section-head">
        <h1>
          {car.year} {car.make} {car.model}
        </h1>
        <span className={status.badge}>{status.label}</span>
      </div>
      <p className="hint">Plate {car.plateNumber}</p>

      <Flash notice={firstParam(query.notice)} error={firstParam(query.error)} />

      {car.status === 'draft' ? (
        <div className="callout">Add your documents and photos, then submit the car for review.</div>
      ) : null}
      {car.status === 'submitted' ? (
        <div className="callout">Our team is reviewing your documents. We will update this page.</div>
      ) : null}
      {car.status === 'rejected' && car.rejectionReason ? (
        <div className="alert">Needs changes: {car.rejectionReason}. Fix it and submit again.</div>
      ) : null}
      {car.status === 'awaiting_dropoff' ? (
        <div className="callout">
          Approved. Bring the car to {hub ? `${hub.name}, ${hub.address}, ${hub.city}` : 'your chosen hub'}
          {hub?.openingHours ? ` (open ${hub.openingHours})` : ''}. A hub manager will inspect it and
          your car goes live.
        </div>
      ) : null}
      {car.status === 'live' ? <div className="notice">Your car is live and can be booked.</div> : null}
      {car.status === 'paused' ? (
        <div className="callout">Your car is paused and hidden from search.</div>
      ) : null}
      {car.status === 'suspended' ? (
        <div className="alert">
          Our team suspended this car{car.rejectionReason ? `: ${car.rejectionReason}` : ''}. Contact
          support.
        </div>
      ) : null}

      {canEditDetails ? (
        <>
          <h2>Details</h2>
          <CarForm
            action={updateCarAction}
            initial={initial}
            identityLocked={identityLocked}
            carId={car.id}
            submitLabel="Save changes"
          />
        </>
      ) : null}

      <div className="form-panel">
        <h2>Documents</h2>
        <p className="hint">JPG, PNG or PDF, up to 5 MB each. Only our review team sees them.</p>
        {DOC_TYPES.map((type) => {
          const doc = documents.find((entry) => entry.docType === type);
          return (
            <div className="doc-row" key={type}>
              <div>
                <strong>{DOC_LABELS[type]}</strong>
                <p className="hint">
                  {doc
                    ? `${doc.originalName} (${formatBytes(doc.sizeBytes)})${
                        doc.expiresOn ? `, valid until ${formatDate(doc.expiresOn)}` : ''
                      }`
                    : 'Not uploaded yet'}
                </p>
              </div>
              {canEditDocs ? (
                <form action={uploadCarDocumentAction} className="inline-form">
                  <input type="hidden" name="carId" value={car.id} />
                  <input type="hidden" name="docType" value={type} />
                  {type === 'insurance' ? (
                    <input type="date" name="expiresOn" aria-label="Insurance valid until" required />
                  ) : null}
                  <input type="file" name="file" accept="image/jpeg,image/png,application/pdf" required />
                  <button type="submit" className="btn btn-ghost btn-small">
                    {doc ? 'Replace' : 'Upload'}
                  </button>
                </form>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="form-panel">
        <h2>Photos</h2>
        <p className="hint">At least 3 photos, up to 10. The first one is the cover photo.</p>
        {listingPhotos.length > 0 ? (
          <div className="photo-grid">
            {listingPhotos.map((photo) => (
              <div className="photo-tile" key={photo.id}>
                <img src={`/photos/${car.id}/${photo.id}`} alt={`Photo ${photo.position + 1}`} />
                {canEditPhotos ? (
                  <form action={deleteCarPhotoAction}>
                    <input type="hidden" name="carId" value={car.id} />
                    <input type="hidden" name="photoId" value={photo.id} />
                    <button type="submit" className="btn btn-danger btn-small">
                      Remove
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="hint">No photos yet.</p>
        )}
        {canEditPhotos && listingPhotos.length < 10 ? (
          <form action={uploadCarPhotosAction} className="inline-form">
            <input type="hidden" name="carId" value={car.id} />
            <input type="file" name="photos" accept="image/jpeg,image/png" multiple required />
            <button type="submit" className="btn btn-ghost btn-small">
              Upload photos
            </button>
            <span className="hint">Up to 5 at a time.</span>
          </form>
        ) : null}
      </div>

      {canEditDocs ? (
        <div className="form-panel">
          <h2>Submit for review</h2>
          {!readiness.ready ? (
            <ul className="checklist">
              {readiness.problems.map((problem) => (
                <li key={problem}>
                  <span className="tick" />
                  <span>{problem}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">Everything is ready.</p>
          )}
          <form action={submitCarAction} className="inline-form">
            <input type="hidden" name="carId" value={car.id} />
            <select name="hubId" aria-label="Drop-off hub" defaultValue={car.hubId ?? ''} required>
              <option value="" disabled>
                Choose the hub where you will drop off the car
              </option>
              {hubs.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}, {entry.city}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!readiness.ready || hubs.length === 0}
            >
              Submit for review
            </button>
          </form>
          {hubs.length === 0 ? <p className="hint">No hubs are open yet.</p> : null}
        </div>
      ) : null}

      <div className="actions">
        {car.status === 'live' ? (
          <form action={pauseCarAction}>
            <input type="hidden" name="carId" value={car.id} />
            <button type="submit" className="btn btn-ghost">
              Pause this car
            </button>
          </form>
        ) : null}
        {car.status === 'paused' ? (
          <form action={resumeCarAction}>
            <input type="hidden" name="carId" value={car.id} />
            <button type="submit" className="btn btn-primary">
              Make it live again
            </button>
          </form>
        ) : null}
        {CAR_RETIRABLE.includes(car.status) ? (
          <form action={retireCarAction}>
            <input type="hidden" name="carId" value={car.id} />
            <button type="submit" className="btn btn-danger">
              Remove this car
            </button>
          </form>
        ) : null}
      </div>

      {inspections.length > 0 ? (
        <div className="form-panel" style={{ marginTop: 24 }}>
          <h2>Hub inspections</h2>
          {inspections.map((inspection) => (
            <div className="doc-row" key={inspection.id}>
              <div>
                <strong>{inspection.result === 'passed' ? 'Passed' : 'Failed'}</strong>
                <p className="hint">
                  {formatDateTime(inspection.createdAt)} &middot; {inspection.odometerKm} km &middot; fuel{' '}
                  {inspection.fuelLevelPercent}%
                </p>
                <p>{inspection.conditionNotes}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// File: frontend/app/owner/cars/[id]/page.tsx
// END OF FILE