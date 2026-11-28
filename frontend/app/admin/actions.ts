// Project: Via Nostra
// File: frontend/app/admin/actions.ts
// Purpose: The server-side logic behind every button and form in the staff console:
//          approve or reject verifications and cars, hub inspections, hand-over and
//          return of cars, payouts, staff ranks, suspensions and hubs. Each one asks
//          the backend, which checks the staff member's permission again.

'use server';

import { redirect } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { describeError, field, runApiAction, withMessage } from '@/lib/action-helpers';
import { getToken } from '@/lib/session';

function enc(value: string): string {
  return encodeURIComponent(value);
}

// ----- Identity verification -----

export async function approveVerificationAction(formData: FormData): Promise<void> {
  const id = field(formData, 'id');
  await runApiAction({
    path: `/admin/verifications/${enc(id)}/approve`,
    back: '/admin/verifications',
    notice: 'Verification approved.',
  });
}

export async function rejectVerificationAction(formData: FormData): Promise<void> {
  const id = field(formData, 'id');
  await runApiAction({
    path: `/admin/verifications/${enc(id)}/reject`,
    body: { reason: field(formData, 'reason') },
    back: `/admin/verifications/${enc(id)}`,
    notice: 'Verification rejected.',
  });
}

// ----- Cars -----

export async function approveCarDocumentsAction(formData: FormData): Promise<void> {
  const carId = field(formData, 'carId');
  await runApiAction({
    path: `/admin/cars/${enc(carId)}/approve-documents`,
    back: `/admin/cars/${enc(carId)}`,
    notice: 'Documents approved. The owner can now drop the car at the hub.',
  });
}

export async function rejectCarAction(formData: FormData): Promise<void> {
  const carId = field(formData, 'carId');
  await runApiAction({
    path: `/admin/cars/${enc(carId)}/reject`,
    body: { reason: field(formData, 'reason') },
    back: `/admin/cars/${enc(carId)}`,
    notice: 'The car was sent back to the owner.',
  });
}

export async function suspendCarAction(formData: FormData): Promise<void> {
  const carId = field(formData, 'carId');
  await runApiAction({
    path: `/admin/cars/${enc(carId)}/suspend`,
    body: { reason: field(formData, 'reason') },
    back: `/admin/cars/${enc(carId)}`,
    notice: 'The car was suspended.',
  });
}

export async function reinstateCarAction(formData: FormData): Promise<void> {
  const carId = field(formData, 'carId');
  await runApiAction({
    path: `/admin/cars/${enc(carId)}/reinstate`,
    back: `/admin/cars/${enc(carId)}`,
    notice: 'The car is live again.',
  });
}

export async function uploadInspectionPhotosAction(formData: FormData): Promise<void> {
  const carId = field(formData, 'carId');
  const back = `/admin/cars/${enc(carId)}`;
  const files = formData
    .getAll('photos')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length === 0) {
    redirect(withMessage(back, 'error', 'Please choose at least one photo.'));
  }
  if (files.length > 5) {
    redirect(withMessage(back, 'error', 'Upload at most 5 photos at a time.'));
  }

  const token = await getToken();
  if (!token) {
    redirect('/login');
  }
  let uploaded = 0;
  for (const file of files) {
    const body = new FormData();
    body.append('file', file, file.name);
    const result = await apiRequest(`/admin/cars/${enc(carId)}/inspection-photos`, {
      method: 'POST',
      formData: body,
      token,
    });
    if (!result.ok) {
      if (result.status === 401) {
        redirect('/login');
      }
      const reason = describeError(result.error);
      redirect(
        withMessage(back, 'error', uploaded > 0 ? `${uploaded} uploaded, then: ${reason}` : reason),
      );
    }
    uploaded += 1;
  }
  redirect(withMessage(back, 'notice', `${uploaded} inspection photo${uploaded === 1 ? '' : 's'} uploaded.`));
}

export async function recordInspectionAction(formData: FormData): Promise<void> {
  const carId = field(formData, 'carId');
  await runApiAction({
    path: `/admin/cars/${enc(carId)}/inspection`,
    body: {
      result: field(formData, 'result'),
      odometerKm: Number(field(formData, 'odometerKm')),
      fuelLevelPercent: Number(field(formData, 'fuelLevelPercent')),
      conditionNotes: field(formData, 'conditionNotes'),
    },
    back: `/admin/cars/${enc(carId)}`,
    notice: 'Inspection recorded.',
  });
}

// ----- Bookings -----

export async function handoverAction(formData: FormData): Promise<void> {
  const bookingId = field(formData, 'bookingId');
  await runApiAction({
    path: `/admin/bookings/${enc(bookingId)}/handover`,
    body: {
      odometerKm: Number(field(formData, 'odometerKm')),
      fuelLevelPercent: Number(field(formData, 'fuelLevelPercent')),
      notes: field(formData, 'notes'),
    },
    back: `/admin/bookings/${enc(bookingId)}`,
    notice: 'Car handed over. Waiting for the renter to confirm.',
  });
}

export async function returnAction(formData: FormData): Promise<void> {
  const bookingId = field(formData, 'bookingId');
  const deduction = Math.round(Number(field(formData, 'deduction') || '0') * 100);
  const reason = field(formData, 'deductionReason');
  await runApiAction({
    path: `/admin/bookings/${enc(bookingId)}/return`,
    body: {
      odometerKm: Number(field(formData, 'odometerKm')),
      fuelLevelPercent: Number(field(formData, 'fuelLevelPercent')),
      notes: field(formData, 'notes'),
      deductionMinor: deduction,
      ...(reason ? { deductionReason: reason } : {}),
    },
    back: `/admin/bookings/${enc(bookingId)}`,
    notice: 'Car returned. The deposit has been settled.',
  });
}

export async function adminCancelBookingAction(formData: FormData): Promise<void> {
  const bookingId = field(formData, 'bookingId');
  await runApiAction({
    path: `/admin/bookings/${enc(bookingId)}/cancel`,
    body: { reason: field(formData, 'reason') },
    back: `/admin/bookings/${enc(bookingId)}`,
    notice: 'Booking cancelled and the renter refunded.',
  });
}

// ----- Payouts -----

export async function payPayoutAction(formData: FormData): Promise<void> {
  await runApiAction({
    path: `/admin/payouts/${enc(field(formData, 'id'))}/pay`,
    back: '/admin/payouts',
    notice: 'Payout marked as paid.',
  });
}

export async function rejectPayoutAction(formData: FormData): Promise<void> {
  await runApiAction({
    path: `/admin/payouts/${enc(field(formData, 'id'))}/reject`,
    body: { reason: field(formData, 'reason') },
    back: '/admin/payouts',
    notice: 'Payout rejected. The money is back in the owner\'s balance.',
  });
}

// ----- Users and staff ranks -----

export async function changeStaffRolesAction(formData: FormData): Promise<void> {
  const userId = field(formData, 'userId');
  await runApiAction({
    path: `/admin/users/${enc(userId)}/staff-roles`,
    method: 'PATCH',
    body: { staffRoles: formData.getAll('staffRoles').map(String) },
    back: `/admin/users/${enc(userId)}`,
    notice: 'Staff ranks updated.',
  });
}

export async function setUserActiveAction(formData: FormData): Promise<void> {
  const userId = field(formData, 'userId');
  const active = field(formData, 'active') === 'true';
  await runApiAction({
    path: `/admin/users/${enc(userId)}/active`,
    method: 'PATCH',
    body: { isActive: active, reason: field(formData, 'reason') },
    back: `/admin/users/${enc(userId)}`,
    notice: active ? 'The account was reactivated.' : 'The account was suspended.',
  });
}

// ----- Hubs -----

function hubBody(formData: FormData): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const name of ['name', 'city', 'countryCode', 'address', 'openingHours', 'contactPhone']) {
    const value = field(formData, name);
    if (value) {
      body[name] = value;
    }
  }
  for (const name of ['latitude', 'longitude']) {
    const value = field(formData, name);
    if (value !== '') {
      body[name] = Number(value);
    }
  }
  return body;
}

export async function createHubAction(formData: FormData): Promise<void> {
  await runApiAction({
    path: '/admin/hubs',
    body: hubBody(formData),
    back: '/admin/hubs',
    notice: 'Hub created.',
  });
}

export async function updateHubAction(formData: FormData): Promise<void> {
  const id = field(formData, 'id');
  const body = hubBody(formData);
  const active = field(formData, 'isActive');
  if (active) {
    body.isActive = active === 'true';
  }
  await runApiAction({
    path: `/admin/hubs/${enc(id)}`,
    method: 'PATCH',
    body,
    back: `/admin/hubs/${enc(id)}`,
    notice: 'Hub updated.',
  });
}

export async function addHubStaffAction(formData: FormData): Promise<void> {
  const hubId = field(formData, 'hubId');
  const email = field(formData, 'email').toLowerCase();
  const back = `/admin/hubs/${enc(hubId)}`;

  const token = await getToken();
  if (!token) {
    redirect('/login');
  }
  const found = await apiRequest<{ items: Array<{ id: string; email: string }> }>(
    `/admin/users?search=${enc(email)}&limit=10`,
    { token },
  );
  if (!found.ok) {
    if (found.status === 401) {
      redirect('/login');
    }
    redirect(
      withMessage(
        back,
        'error',
        found.status === 403
          ? 'Only staff with user access (such as a super admin) can look people up by email. Ask one of them to add this person.'
          : describeError(found.error),
      ),
    );
  }
  const match = found.data.items.find((entry) => entry.email.toLowerCase() === email);
  if (!match) {
    redirect(withMessage(back, 'error', 'No account with that email was found.'));
  }

  await runApiAction({
    path: `/admin/hubs/${enc(hubId)}/staff`,
    body: { userId: match.id },
    back,
    notice: 'Staff member added to the hub.',
  });
}

export async function removeHubStaffAction(formData: FormData): Promise<void> {
  const hubId = field(formData, 'hubId');
  await runApiAction({
    path: `/admin/hubs/${enc(hubId)}/staff/${enc(field(formData, 'userId'))}`,
    method: 'DELETE',
    back: `/admin/hubs/${enc(hubId)}`,
    notice: 'Staff member removed from the hub.',
  });
}

// File: frontend/app/admin/actions.ts
// END OF FILE