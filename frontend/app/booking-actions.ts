// Project: Via Nostra
// File: frontend/app/booking-actions.ts
// Purpose: The server-side logic behind the booking buttons: create a booking, pay,
//          confirm that the car was received, and cancel. Each talks to the backend
//          and then sends the person back to their booking page with a message.

'use server';

import { redirect } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import type { ApiError } from '@/lib/api';
import { getToken } from '@/lib/session';

export type BookingFormState =
  | { message?: string; values?: { startDate: string; endDate: string } }
  | undefined;

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

function describe(error: ApiError): string {
  const issue = error.issues?.[0];
  return issue ? `${issue.field}: ${issue.message}` : error.message;
}

export async function createBookingAction(
  _previous: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const token = await getToken();
  if (!token) {
    redirect('/login');
  }

  const carId = field(formData, 'carId');
  const startDate = field(formData, 'startDate');
  const endDate = field(formData, 'endDate');
  const values = { startDate, endDate };
  if (!startDate || !endDate) {
    return { message: 'Please choose both dates.', values };
  }

  const result = await apiRequest<{ booking: { id: string } }>('/bookings', {
    method: 'POST',
    token,
    body: { carId, startDate, endDate },
  });
  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    return { message: describe(result.error), values };
  }
  redirect(`/bookings/${result.data.booking.id}`);
}

async function runStep(
  bookingId: string,
  step: 'pay' | 'confirm-receipt' | 'cancel',
  body: unknown,
  notice: string,
): Promise<never> {
  const token = await getToken();
  if (!token) {
    redirect('/login');
  }
  const id = encodeURIComponent(bookingId);
  const result = await apiRequest(`/bookings/${id}/${step}`, { method: 'POST', token, body });
  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    redirect(`/bookings/${id}?error=${encodeURIComponent(describe(result.error))}`);
  }
  redirect(`/bookings/${id}?notice=${encodeURIComponent(notice)}`);
}

export async function payBookingAction(formData: FormData): Promise<void> {
  await runStep(
    field(formData, 'bookingId'),
    'pay',
    undefined,
    'Payment received. Your booking is confirmed.',
  );
}

export async function confirmReceiptAction(formData: FormData): Promise<void> {
  await runStep(
    field(formData, 'bookingId'),
    'confirm-receipt',
    undefined,
    'Thank you. The owner has been paid and your rental is under way.',
  );
}

export async function cancelBookingAction(formData: FormData): Promise<void> {
  await runStep(
    field(formData, 'bookingId'),
    'cancel',
    { reason: field(formData, 'reason') },
    'Your booking was cancelled.',
  );
}

// File: frontend/app/booking-actions.ts
// END OF FILE