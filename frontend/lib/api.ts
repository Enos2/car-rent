// File: frontend/lib/api.ts
// Purpose: Talks to the Via Nostra backend from the server side of the website and
//          turns every answer into a simple "ok" or "error" result.

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3001/api/v1';

export type PublicUser = {
  id: string;
  email: string;
  fullName: string;
  accountType: 'individual' | 'company';
  companyName: string | null;
  roles: string[];
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  createdAt: string;
};

export type AuthResponse = {
  accessToken: string;
  expiresInSeconds: number;
  user: PublicUser;
};

export type ApiIssue = { field: string; message: string };
export type ApiError = { message: string; issues?: ApiIssue[] };

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: ApiError };

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: 'no-store',
    });
    const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (response.ok) {
      return { ok: true, data: json as unknown as T };
    }

    const message =
      typeof json?.message === 'string'
        ? json.message
        : typeof json?.error === 'string'
          ? json.error
          : 'The request failed.';
    return {
      ok: false,
      status: response.status,
      error: {
        message,
        issues: Array.isArray(json?.issues) ? (json.issues as ApiIssue[]) : undefined,
      },
    };
  } catch {
    return {
      ok: false,
      status: 0,
      error: { message: 'The server could not be reached. Please try again in a moment.' },
    };
  }
}

// File: frontend/lib/api.ts
// END OF FILE
