// Project: Via Nostra
// File: frontend/lib/session.ts
// Purpose: Keeps the login token in a secure cookie that browser scripts cannot
//          read, and looks up the logged-in user.

import { cookies } from 'next/headers';
import { apiRequest } from './api';
import type { PublicUser } from './api';

const COOKIE_NAME = 'vn_session';

export async function setSession(token: string, maxAgeSeconds: number): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = await getToken();
  if (!token) {
    return null;
  }
  const result = await apiRequest<{ user: PublicUser }>('/auth/me', { token });
  return result.ok ? result.data.user : null;
}

// File: frontend/lib/session.ts
// END OF FILE
