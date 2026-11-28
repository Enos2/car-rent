// Project: Via Nostra
// File: frontend/lib/action-helpers.ts
// Purpose: Shared helpers for the buttons and forms that change data. runApiAction
//          sends one request to the backend and then returns the person to a page
//          with a success or error message.

import { redirect } from 'next/navigation';
import { apiRequest } from './api';
import type { ApiError } from './api';
import { getToken } from './session';

// Turns an API error into one readable sentence.
export function describeError(error: ApiError): string {
  const issue = error.issues?.[0];
  if (issue) {
    return `${issue.field}: ${issue.message}`;
  }
  if (error.details && error.details.length > 0) {
    return `${error.message}: ${error.details.join('; ')}`;
  }
  return error.message;
}

export function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim();
}

// Adds ?notice=... or ?error=... to a page address.
export function withMessage(path: string, key: 'notice' | 'error', message: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${key}=${encodeURIComponent(message)}`;
}

export async function runApiAction(options: {
  path: string;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  back: string;
  notice: string;
}): Promise<never> {
  const token = await getToken();
  if (!token) {
    redirect('/login');
  }
  const result = await apiRequest(options.path, {
    method: options.method ?? 'POST',
    body: options.body,
    formData: options.formData,
    token,
  });
  if (!result.ok) {
    if (result.status === 401) {
      redirect('/login');
    }
    redirect(withMessage(options.back, 'error', describeError(result.error)));
  }
  redirect(withMessage(options.back, 'notice', options.notice));
}

// File: frontend/lib/action-helpers.ts
// END OF FILE