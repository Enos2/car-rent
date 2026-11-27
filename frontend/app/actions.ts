// Project: Via Nostra
// File: frontend/app/actions.ts
// Purpose: The server-side logic behind the sign-up, login and logout forms. It talks
//          to the backend and stores the login token in a secure cookie.

'use server';

import { redirect } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import type { ApiError, AuthResponse } from '@/lib/api';
import { clearSession, setSession } from '@/lib/session';

export type FormState =
  | {
      message?: string;
      fieldErrors?: Record<string, string>;
      values?: Record<string, string>;
    }
  | undefined;

function toFormState(error: ApiError, values: Record<string, string>): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues ?? []) {
    if (!fieldErrors[issue.field]) {
      fieldErrors[issue.field] = issue.message;
    }
  }
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  return {
    message: hasFieldErrors ? 'Please fix the highlighted fields.' : error.message,
    fieldErrors,
    values,
  };
}

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '');
}

export async function loginAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = text(formData, 'email');
  const result = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password: text(formData, 'password') },
  });

  if (!result.ok) {
    return toFormState(result.error, { email });
  }

  await setSession(result.data.accessToken, result.data.expiresInSeconds);
  redirect('/account');
}

export async function registerAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = text(formData, 'email');
  const fullName = text(formData, 'fullName');
  const companyName = text(formData, 'companyName').trim();
  const accountType = text(formData, 'accountType') === 'company' ? 'company' : 'individual';
  const roles = formData.getAll('roles').map(String);
  const password = text(formData, 'password');
  const values = { email, fullName, companyName };

  if (password !== text(formData, 'confirmPassword')) {
    return {
      message: 'Please fix the highlighted fields.',
      fieldErrors: { confirmPassword: 'The passwords do not match.' },
      values,
    };
  }

  const result = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: {
      email,
      password,
      fullName,
      accountType,
      roles,
      ...(accountType === 'company' ? { companyName } : {}),
    },
  });

  if (!result.ok) {
    return toFormState(result.error, values);
  }

  await setSession(result.data.accessToken, result.data.expiresInSeconds);
  redirect('/account');
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect('/');
}

// File: frontend/app/actions.ts
// END OF FILE
