// Project: Via Nostra
// File: frontend/app/owner/actions.ts
// Purpose: The server-side logic behind the owner pages: create and edit a car,
//          upload its documents and photos, submit it for review, pause, resume or
//          remove it, and request a payout.

'use server';

import { redirect } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import {
  describeError,
  field,
  runApiAction,
  withMessage,
} from '@/lib/action-helpers';
import { getToken } from '@/lib/session';
import type { CarFormState, CarFormValues } from '@/lib/types';

const FORM_FIELDS: Array<keyof CarFormValues> = [
  'make',
  'model',
  'year',
  'plateNumber',
  'vin',
  'color',
  'seats',
  'transmission',
  'fuelType',
  'description',
  'currency',
  'dailyPrice',
  'deposit',
  'minRentalDays',
  'maxRentalDays',
];

// Backend field names mapped to the names used on the form.
const FIELD_NAMES: Record<string, string> = {
  dailyPriceMinor: 'dailyPrice',
  depositMinor: 'deposit',
};

function readValues(formData: FormData): Partial<CarFormValues> {
  const values: Partial<CarFormValues> = {};
  for (const name of FORM_FIELDS) {
    if (formData.has(name)) {
      values[name] = field(formData, name);
    }
  }
  return values;
}

// Builds the request for the backend. Prices are typed in whole units and sent in
// the smallest unit. Fields that are missing (locked or empty) are left out.
function buildCarBody(formData: FormData): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const text = (name: string): void => {
    const value = field(formData, name);
    if (formData.has(name) && value) {
      body[name] = value;
    }
  };
  const whole = (name: string): void => {
    const value = field(formData, name);
    if (formData.has(name) && value !== '') {
      body[name] = Number(value);
    }
  };
  const money = (name: string, key: string): void => {
    const value = field(formData, name);
    if (formData.has(name) && value !== '') {
      body[key] = Math.round(Number(value) * 100);
    }
  };

  text('make');
  text('model');
  whole('year');
  text('plateNumber');
  text('vin');
  text('color');
  whole('seats');
  text('transmission');
  text('fuelType');
  text('description');
  text('currency');
  money('dailyPrice', 'dailyPriceMinor');
  money('deposit', 'depositMinor');
  whole('minRentalDays');
  whole('maxRentalDays');
  return body;
}

async function sendCar(
  formData: FormData,
  method: 'POST' | 'PATCH',
  path: string,
  notice: string,
): Promise<CarFormState> {
  const token = await getToken();
  if (!token) {
    redirect('/login');
  }
  const result = await apiRequest<{ car: { id: string } }>(path, {
    method,
    token,
    body: buildCarBody(formData),
  });

  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    const fieldErrors: Record<string, string> = {};
    for (const issue of result.error.issues ?? []) {
      const name = FIELD_NAMES[issue.field] ?? issue.field;
      fieldErrors[name] ??= issue.message;
    }
    return {
      message:
        Object.keys(fieldErrors).length > 0
          ? 'Please fix the highlighted fields.'
          : describeError(result.error),
      fieldErrors,
      values: readValues(formData),
    };
  }
  const id = method === 'POST' ? result.data.car.id : field(formData, 'carId');
  redirect(withMessage(`/owner/cars/${encodeURIComponent(id)}`, 'notice', notice));
}

export async function createCarAction(
  _previous: CarFormState,
  formData: FormData,
): Promise<CarFormState> {
  return sendCar(formData, 'POST', '/cars', 'Car created. Now add its documents and photos.');
}

export async function updateCarAction(
  _previous: CarFormState,
  formData: FormData,
): Promise<CarFormState> {
  const carId = field(formData, 'carId');
  return sendCar(formData, 'PATCH', `/cars/${encodeURIComponent(carId)}`, 'Changes saved.');
}

export async function uploadCarDocumentAction(formData: FormData): Promise<void> {
  const carId = field(formData, 'carId');
  const docType = field(formData, 'docType');
  const expiresOn = field(formData, 'expiresOn');
  const file = formData.get('file');
  const back = `/owner/cars/${encodeURIComponent(carId)}`;
  if (!(file instanceof File) || file.size === 0) {
    redirect(withMessage(back, 'error', 'Please choose a file to upload.'));
  }

  const body = new FormData();
  body.append('file', file, file.name);
  const query = expiresOn ? `?expiresOn=${encodeURIComponent(expiresOn)}` : '';
  await runApiAction({
    path: `/cars/${encodeURIComponent(carId)}/documents/${encodeURIComponent(docType)}${query}`,
    formData: body,
    back,
    notice: 'Document uploaded.',
  });
}

export async function uploadCarPhotosAction(formData: FormData): Promise<void> {
  const carId = field(formData, 'carId');
  const back = `/owner/cars/${encodeURIComponent(carId)}`;
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
    const result = await apiRequest(`/cars/${encodeURIComponent(carId)}/photos`, {
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
  redirect(withMessage(back, 'notice', `${uploaded} photo${uploaded === 1 ? '' : 's'} uploaded.`));
}

export async function deleteCarPhotoAction(formData: FormData): Promise<void> {
  const carId = field(formData, 'carId');
  await runApiAction({
    path: `/cars/${encodeURIComponent(carId)}/photos/${encodeURIComponent(field(formData, 'photoId'))}`,
    method: 'DELETE',
    back: `/owner/cars/${encodeURIComponent(carId)}`,
    notice: 'Photo removed.',
  });
}

export async function submitCarAction(formData: FormData): Promise<void> {
  const carId = field(formData, 'carId');
  await runApiAction({
    path: `/cars/${encodeURIComponent(carId)}/submit`,
    body: { hubId: field(formData, 'hubId') },
    back: `/owner/cars/${encodeURIComponent(carId)}`,
    notice: 'Submitted for review. We will check your documents.',
  });
}

export async function pauseCarAction(formData: FormData): Promise<void> {
  const carId = field(formData, 'carId');
  await runApiAction({
    path: `/cars/${encodeURIComponent(carId)}/pause`,
    back: `/owner/cars/${encodeURIComponent(carId)}`,
    notice: 'Your car is paused and hidden from search.',
  });
}

export async function resumeCarAction(formData: FormData): Promise<void> {
  const carId = field(formData, 'carId');
  await runApiAction({
    path: `/cars/${encodeURIComponent(carId)}/resume`,
    back: `/owner/cars/${encodeURIComponent(carId)}`,
    notice: 'Your car is live again.',
  });
}

export async function retireCarAction(formData: FormData): Promise<void> {
  const carId = field(formData, 'carId');
  await runApiAction({
    path: `/cars/${encodeURIComponent(carId)}/retire`,
    back: '/owner',
    notice: 'The car was removed.',
  });
}

export async function requestPayoutAction(formData: FormData): Promise<void> {
  const amount = Number(field(formData, 'amount'));
  if (!Number.isFinite(amount) || amount <= 0) {
    redirect(withMessage('/owner/payouts', 'error', 'Enter a valid amount.'));
  }
  await runApiAction({
    path: '/payouts',
    body: {
      amountMinor: Math.round(amount * 100),
      currency: field(formData, 'currency'),
      destination: field(formData, 'destination'),
    },
    back: '/owner/payouts',
    notice: 'Payout requested. Our finance team will review it.',
  });
}

// File: frontend/app/owner/actions.ts
// END OF FILE