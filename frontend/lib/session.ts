// Project: Via Nostra
// File: frontend/lib/session.ts
// Purpose: Keeps the login token in a secure cookie that browser scripts cannot
//          read, looks up the logged-in user, and guards pages: requireUser sends
//          visitors to login, requireStaff also checks for a staff permission.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
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

// For pages that need a logged-in person. Sends everyone else to the login page.
export async function requireUser(): Promise<{ token: string; user: PublicUser }> {
  const token = await getToken();
  if (!token) {
    redirect('/login');
  }
  const result = await apiRequest<{ user: PublicUser }>('/auth/me', { token });
  if (!result.ok) {
    redirect('/login');
  }
  return { token, user: result.data.user };
}

// For staff pages. Sends people without the needed permission to the home page.
export async function requireStaff(
  permission?: string,
): Promise<{ token: string; user: PublicUser }> {
  const session = await requireUser();
  const permissions = session.user.permissions;
  if (permissions.length === 0 || (permission && !permissions.includes(permission))) {
    redirect('/');
  }
  return session;
}

// File: frontend/lib/session.ts
// END OF FILE