// Project: Via Nostra
// File: frontend/components/BookingForm.tsx
// Purpose: The booking box on a car's page: the renter picks the start and end
//          dates, sees the price (rental plus refundable deposit) and creates the
//          booking.

'use client';

import { useActionState, useState } from 'react';
import { createBookingAction } from '@/app/booking-actions';
import { daysBetween, formatMoney } from '@/lib/format';

type Props = {
  carId: string;
  currency: string;
  dailyPriceMinor: number;
  depositMinor: number;
  minDays: number;
  maxDays: number;
  today: string;
};

export default function BookingForm(props: Props) {
  const [state, formAction, pending] = useActionState(createBookingAction, undefined);
  const [start, setStart] = useState(state?.values?.startDate ?? '');
  const [end, setEnd] = useState(state?.values?.endDate ?? '');

  const days = start && end ? daysBetween(start, end) : 0;
  const validDays = days >= props.minDays && days <= props.maxDays;
  const subtotal = props.dailyPriceMinor * Math.max(days, 0);

  return (
    <form action={formAction}>
      <input type="hidden" name="carId" value={props.carId} />

      {state?.message ? <div className="alert">{state.message}</div> : null}

      <div className="field">
        <label htmlFor="startDate">Pick-up date</label>
        <input
          id="startDate"
          name="startDate"
          type="date"
          min={props.today}
          value={start}
          onChange={(event) => setStart(event.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="endDate">Return date</label>
        <input
          id="endDate"
          name="endDate"
          type="date"
          min={start || props.today}
          value={end}
          onChange={(event) => setEnd(event.target.value)}
          required
        />
        <p className="hint">
          Rent for {props.minDays} to {props.maxDays} days.
        </p>
      </div>

      {days >= 1 ? (
        <div className="estimate">
          <div>
            <span>
              {formatMoney(props.dailyPriceMinor, props.currency)} x {days}{' '}
              {days === 1 ? 'day' : 'days'}
            </span>
            <span>{formatMoney(subtotal, props.currency)}</span>
          </div>
          <div>
            <span>Refundable deposit</span>
            <span>{formatMoney(props.depositMinor, props.currency)}</span>
          </div>
          <div>
            <strong>Total to pay</strong>
            <strong>{formatMoney(subtotal + props.depositMinor, props.currency)}</strong>
          </div>
          {!validDays ? (
            <p className="field-error">
              This car can be rented for {props.minDays} to {props.maxDays} days.
            </p>
          ) : null}
        </div>
      ) : null}

      <button type="submit" className="btn btn-primary" disabled={pending || !validDays}>
        {pending ? 'Booking...' : 'Book this car'}
      </button>
      <p className="hint">You pay on the next page. The car is held for you while you pay.</p>
    </form>
  );
}

// File: frontend/components/BookingForm.tsx
// END OF FILE