// Project: Via Nostra
// File: frontend/app/trust-actions.ts
// Purpose: The server-side logic behind the buttons for trust: writing a review of a
//          finished rental and reporting a car, a person, a review or a post.

'use server';

import { redirect } from 'next/navigation';
import { field, runApiAction, withMessage } from '@/lib/action-helpers';

// Only plain site paths are allowed as the place to return to.
function safeBack(value: string): string {
  return /^\/[A-Za-z0-9/_-]*$/.test(value) ? value : '/';
}

export async function submitReviewAction(formData: FormData): Promise<void> {
  const bookingId = field(formData, 'bookingId');
  const rating = Number(field(formData, 'rating'));
  const comment = field(formData, 'comment');
  const back = `/bookings/${encodeURIComponent(bookingId)}`;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    redirect(withMessage(back, 'error', 'Please choose a rating from 1 to 5.'));
  }
  await runApiAction({
    path: `/bookings/${encodeURIComponent(bookingId)}/review`,
    body: { rating, ...(comment ? { comment } : {}) },
    back,
    notice: 'Thank you for your review.',
  });
}

export async function submitReportAction(formData: FormData): Promise<void> {
  await runApiAction({
    path: '/reports',
    body: {
      targetType: field(formData, 'targetType'),
      targetId: field(formData, 'targetId'),
      reason: field(formData, 'reason'),
      details: field(formData, 'details'),
    },
    back: safeBack(field(formData, 'back')),
    notice: 'Thank you. Our team will look at your report.',
  });
}

// File: frontend/app/trust-actions.ts
// END OF FILE