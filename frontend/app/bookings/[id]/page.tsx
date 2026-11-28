// Project: Via Nostra
// File: frontend/app/bookings/[id]/page.tsx
// Purpose: One booking: its status and timeline, the price, where to collect the
//          car, and the buttons that fit the stage: pay, confirm that the car was
//          received, cancel, or (after the return) rate the rental. The renter's
//          money is held until they confirm.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  cancelBookingAction,
  confirmReceiptAction,
  payBookingAction,
} from '@/app/booking-actions';
import { submitReviewAction } from '@/app/trust-actions';
import Flash from '@/components/Flash';
import { apiRequest } from '@/lib/api';
import {
  BOOKING_STATUS,
  firstParam,
  formatDate,
  formatDateTime,
  formatMoney,
} from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { requireUser } from '@/lib/session';
import type { PendingReview } from '@/lib/trust';
import type { BookingResponse } from '@/lib/types';

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { token, user } = await requireUser();

  const [result, pending] = await Promise.all([
    apiRequest<BookingResponse>(`/bookings/${encodeURIComponent(id)}`, { token }),
    apiRequest<{ items: PendingReview[] }>('/reviews/pending', { token }),
  ]);
  if (!result.ok) {
    if (result.status === 0) {
      return (
        <div className="container page">
          <div className="alert">{result.error.message}</div>
        </div>
      );
    }
    notFound();
  }

  const { booking, hub } = result.data;
  const isRenter = booking.renterId === user.id;
  const status = BOOKING_STATUS[booking.status];
  const total = booking.subtotalMinor + booking.depositMinor;
  const canReview =
    isRenter &&
    booking.status === 'completed' &&
    pending.ok &&
    pending.data.items.some(
      (entry) => entry.bookingId === booking.id && entry.direction === 'renter_to_owner',
    );

  const steps: Array<{ label: string; at: string | null; done: boolean }> = [
    { label: 'Booking created', at: booking.createdAt, done: true },
    { label: 'Payment received', at: booking.paidAt, done: Boolean(booking.paidAt) },
    {
      label: 'Car handed over at the hub',
      at: booking.handedOverAt,
      done: Boolean(booking.handedOverAt),
    },
    {
      label: 'Receipt confirmed, owner paid',
      at: booking.receiptConfirmedAt,
      done: Boolean(booking.receiptConfirmedAt),
    },
    {
      label: 'Car returned, deposit settled',
      at: booking.returnedAt,
      done: Boolean(booking.returnedAt),
    },
  ];
  if (booking.status === 'cancelled') {
    steps.push({ label: 'Booking cancelled', at: booking.cancelledAt, done: true });
  }
  if (booking.status === 'expired') {
    steps.push({ label: 'Payment window expired', at: booking.expiresAt, done: true });
  }

  return (
    <div className="container page">
      <p className="hint">
        <Link href="/bookings">&larr; My bookings</Link>
      </p>
      <div className="section-head">
        <h1>
          {booking.carMake} {booking.carModel}
        </h1>
        <span className={status.badge}>{status.label}</span>
      </div>

      <Flash notice={firstParam(query.notice)} error={firstParam(query.error)} />

      <div className="detail-layout">
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3>Progress</h3>
            <ul className="timeline">
              {steps.map((step) => (
                <li key={step.label} className={step.done ? 'done' : ''}>
                  <span className="dot" />
                  <span>
                    {step.label}
                    {step.done && step.at ? (
                      <span className="hint"> &middot; {formatDateTime(step.at)}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {hub ? (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3>Collect and return at</h3>
              <p>
                <strong>{hub.name}</strong>
                <br />
                {hub.address}, {hub.city}
                {hub.openingHours ? (
                  <>
                    <br />
                    Open {hub.openingHours}
                  </>
                ) : null}
                {hub.contactPhone ? (
                  <>
                    <br />
                    {hub.contactPhone}
                  </>
                ) : null}
              </p>
              <p className="hint">Bring your ID. Staff check it before handing over the car.</p>
            </div>
          ) : null}

          {canReview ? (
            <form action={submitReviewAction} className="form-panel">
              <h3>Rate your rental</h3>
              <p className="hint">Your honest review helps other renters and the owner.</p>
              <input type="hidden" name="bookingId" value={booking.id} />
              <div className="field">
                <label htmlFor="rating">Rating</label>
                <select id="rating" name="rating" defaultValue="5">
                  <option value="5">5 - Excellent</option>
                  <option value="4">4 - Good</option>
                  <option value="3">3 - Okay</option>
                  <option value="2">2 - Poor</option>
                  <option value="1">1 - Terrible</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="comment">Comment (optional)</label>
                <textarea id="comment" name="comment" rows={3} maxLength={1000} />
              </div>
              <button type="submit" className="btn btn-primary">
                Submit review
              </button>
            </form>
          ) : null}
        </div>

        <aside className="booking-box">
          <h2>{formatMoney(total, booking.currency)}</h2>
          <p className="hint">
            {formatDate(booking.startDate)} to {formatDate(booking.endDate)} ({booking.days}{' '}
            {booking.days === 1 ? 'day' : 'days'})
          </p>
          <div className="estimate">
            <div>
              <span>Rental</span>
              <span>{formatMoney(booking.subtotalMinor, booking.currency)}</span>
            </div>
            <div>
              <span>Refundable deposit</span>
              <span>{formatMoney(booking.depositMinor, booking.currency)}</span>
            </div>
            {booking.refundMinor !== null ? (
              <div>
                <span>Refunded to you</span>
                <span>{formatMoney(booking.refundMinor, booking.currency)}</span>
              </div>
            ) : null}
            {booking.depositDeductionMinor > 0 ? (
              <div>
                <span>Deducted from deposit</span>
                <span>{formatMoney(booking.depositDeductionMinor, booking.currency)}</span>
              </div>
            ) : null}
          </div>
          {booking.deductionReason ? (
            <p className="hint">Deduction reason: {booking.deductionReason}</p>
          ) : null}
          {booking.cancellationReason ? (
            <p className="hint">Reason for cancelling: {booking.cancellationReason}</p>
          ) : null}

          {isRenter && booking.status === 'pending_payment' ? (
            <div>
              <form action={payBookingAction}>
                <input type="hidden" name="bookingId" value={booking.id} />
                <button type="submit" className="btn btn-primary">
                  Pay {formatMoney(total, booking.currency)}
                </button>
              </form>
              <p className="hint">
                This is a test payment. No real money is charged.
                {booking.expiresAt ? ` Pay before ${formatDateTime(booking.expiresAt)}.` : ''}
              </p>
            </div>
          ) : null}

          {isRenter && booking.status === 'handed_over' ? (
            <div>
              <p>The hub has handed you the car. Do you have it?</p>
              <form action={confirmReceiptAction}>
                <input type="hidden" name="bookingId" value={booking.id} />
                <button type="submit" className="btn btn-primary">
                  Yes, I received the car
                </button>
              </form>
              <p className="hint">
                Confirming releases the rental payment to the owner. Your deposit stays held
                until you return the car.
              </p>
            </div>
          ) : null}

          {isRenter && booking.status === 'in_progress' ? (
            <p className="hint">Return the car to the hub by {formatDate(booking.endDate)}.</p>
          ) : null}

          {isRenter && (booking.status === 'pending_payment' || booking.status === 'confirmed') ? (
            <details className="cancel-box">
              <summary>Cancel this booking</summary>
              {booking.status === 'confirmed' ? (
                <p className="hint">
                  Full refund more than 48 hours before pick-up. Closer to the date you get
                  your deposit and half the rental back. After the start date the rental is
                  not refunded.{' '}
                  <Link href="/legal/rules">Read the rules</Link>
                </p>
              ) : null}
              <form action={cancelBookingAction}>
                <input type="hidden" name="bookingId" value={booking.id} />
                <input
                  type="text"
                  name="reason"
                  placeholder="Why are you cancelling?"
                  minLength={5}
                  maxLength={500}
                  required
                />
                <button type="submit" className="btn btn-ghost">
                  Cancel booking
                </button>
              </form>
            </details>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

// File: frontend/app/bookings/[id]/page.tsx
// END OF FILE