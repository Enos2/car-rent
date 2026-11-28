// Project: Via Nostra
// File: frontend/app/admin/bookings/[id]/page.tsx
// Purpose: One booking for staff: the renter and car, the full money breakdown with
//          the commission, the payments, and the forms for the hub work: hand over
//          the car, receive it back (with any deposit deduction), or cancel.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  adminCancelBookingAction,
  handoverAction,
  returnAction,
} from '@/app/admin/actions';
import Field from '@/components/Field';
import Flash from '@/components/Flash';
import { apiRequest } from '@/lib/api';
import {
  BOOKING_STATUS,
  firstParam,
  formatDate,
  formatDateTime,
  formatMoney,
  todayIso,
} from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import type { AdminBooking, PaymentRecord } from '@/lib/types';

export default async function AdminBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { token, user } = await requireStaff('bookings.read');

  const result = await apiRequest<{ booking: AdminBooking; payments: PaymentRecord[] }>(
    `/admin/bookings/${encodeURIComponent(id)}`,
    { token },
  );
  if (!result.ok) {
    if (result.status === 404 || result.status === 400) {
      notFound();
    }
    return <div className="alert">{result.error.message}</div>;
  }

  const { booking, payments } = result.data;
  const can = (permission: string): boolean => user.permissions.includes(permission);
  const status = BOOKING_STATUS[booking.status];
  const started = booking.startDate <= todayIso();
  const money = (amount: number): string => formatMoney(amount, booking.currency);

  return (
    <div className="stack">
      <p className="hint">
        <Link href="/admin/bookings">&larr; Bookings</Link>
      </p>
      <Flash notice={firstParam(query.notice)} error={firstParam(query.error)} />

      <div className="form-panel">
        <div className="section-head">
          <h2 style={{ margin: 0 }}>
            {booking.carMake} {booking.carModel} ({booking.plateNumber})
          </h2>
          <span className={status.badge}>{status.label}</span>
        </div>
        <dl className="kv">
          <dt>Renter</dt>
          <dd>
            {booking.renterName} ({booking.renterEmail})
          </dd>
          <dt>Owner</dt>
          <dd>{booking.ownerName}</dd>
          <dt>Dates</dt>
          <dd>
            {formatDate(booking.startDate)} to {formatDate(booking.endDate)} ({booking.days}{' '}
            {booking.days === 1 ? 'day' : 'days'})
          </dd>
          <dt>Hub</dt>
          <dd>
            {booking.hubName}, {booking.hubCity}
          </dd>
          <dt>Created</dt>
          <dd>{formatDateTime(booking.createdAt)}</dd>
          {booking.paidAt ? (
            <>
              <dt>Paid</dt>
              <dd>{formatDateTime(booking.paidAt)}</dd>
            </>
          ) : null}
          {booking.cancellationReason ? (
            <>
              <dt>Cancelled because</dt>
              <dd>{booking.cancellationReason}</dd>
            </>
          ) : null}
        </dl>
      </div>

      <div className="split">
        <div className="form-panel">
          <h3>Money</h3>
          <dl className="kv">
            <dt>Rental</dt>
            <dd>{money(booking.subtotalMinor)}</dd>
            <dt>Deposit</dt>
            <dd>{money(booking.depositMinor)}</dd>
            <dt>Commission ({booking.commissionBps / 100}%)</dt>
            <dd>{money(booking.commissionMinor)}</dd>
            <dt>Owner&apos;s share</dt>
            <dd>{money(booking.ownerShareMinor)}</dd>
            {booking.refundMinor !== null ? (
              <>
                <dt>Refunded</dt>
                <dd>{money(booking.refundMinor)}</dd>
              </>
            ) : null}
            {booking.depositDeductionMinor > 0 ? (
              <>
                <dt>Deducted from deposit</dt>
                <dd>
                  {money(booking.depositDeductionMinor)}
                  {booking.deductionReason ? ` (${booking.deductionReason})` : ''}
                </dd>
              </>
            ) : null}
          </dl>
        </div>

        <div className="form-panel">
          <h3>Payments</h3>
          {payments.length === 0 ? (
            <p className="hint">No payments yet.</p>
          ) : (
            payments.map((payment) => (
              <div className="doc-row" key={payment.id}>
                <div>
                  <strong>{payment.kind === 'charge' ? 'Charge' : 'Refund'}</strong>
                  <p className="hint mono">{payment.providerReference}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {money(payment.amountMinor)}
                  <p className="hint">{formatDateTime(payment.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {booking.handedOverAt ? (
        <div className="form-panel">
          <h3>Hand-over record</h3>
          <p>
            {formatDateTime(booking.handedOverAt)} &middot; {booking.handoverOdometerKm} km &middot; fuel{' '}
            {booking.handoverFuelPercent}%
          </p>
          <p>{booking.handoverNotes}</p>
        </div>
      ) : null}

      {booking.returnedAt ? (
        <div className="form-panel">
          <h3>Return record</h3>
          <p>
            {formatDateTime(booking.returnedAt)} &middot; {booking.returnOdometerKm} km &middot; fuel{' '}
            {booking.returnFuelPercent}%
          </p>
          <p>{booking.returnNotes}</p>
        </div>
      ) : null}

      {booking.status === 'confirmed' && can('cars.inspect') ? (
        <form action={handoverAction} className="form-panel">
          <h2>Hand over the car</h2>
          {!started ? (
            <div className="callout">The rental starts on {formatDate(booking.startDate)}. The car cannot be handed over earlier.</div>
          ) : (
            <p className="hint">
              Check the renter&apos;s ID in person first. The system only hands over to verified renters.
            </p>
          )}
          <input type="hidden" name="bookingId" value={booking.id} />
          <div className="form-grid">
            <Field label="Odometer (km)" name="odometerKm" type="number" min={0} required />
            <Field label="Fuel level (%)" name="fuelLevelPercent" type="number" min={0} max={100} required />
            <div className="wide">
              <Field label="Condition notes" name="notes" rows={3} minLength={5} maxLength={2000} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={!started}>
            Hand over the car
          </button>
        </form>
      ) : null}

      {booking.status === 'in_progress' && can('cars.inspect') ? (
        <form action={returnAction} className="form-panel">
          <h2>Receive the car back</h2>
          <p className="hint">
            The deposit of {money(booking.depositMinor)} goes back to the renter. If you deduct
            something for damage, it is paid to the owner and you must give a reason.
          </p>
          <input type="hidden" name="bookingId" value={booking.id} />
          <div className="form-grid">
            <Field label="Odometer (km)" name="odometerKm" type="number" min={0} required />
            <Field label="Fuel level (%)" name="fuelLevelPercent" type="number" min={0} max={100} required />
            <Field
              label={`Damage deduction (${booking.currency})`}
              name="deduction"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
            />
            <Field label="Deduction reason" name="deductionReason" maxLength={500} />
            <div className="wide">
              <Field label="Condition notes" name="notes" rows={3} minLength={5} maxLength={2000} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            Record the return
          </button>
        </form>
      ) : null}

      {(booking.status === 'pending_payment' || booking.status === 'confirmed') &&
      can('bookings.manage') ? (
        <form action={adminCancelBookingAction} className="form-panel">
          <h3>Cancel this booking</h3>
          <p className="hint">The renter is refunded in full when staff cancel.</p>
          <input type="hidden" name="bookingId" value={booking.id} />
          <div className="field">
            <label htmlFor="cancel-reason">Reason</label>
            <input id="cancel-reason" name="reason" type="text" minLength={5} maxLength={500} required />
          </div>
          <button type="submit" className="btn btn-danger">
            Cancel booking
          </button>
        </form>
      ) : null}
    </div>
  );
}

// File: frontend/app/admin/bookings/[id]/page.tsx
// END OF FILE