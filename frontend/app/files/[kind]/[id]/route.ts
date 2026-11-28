// Project: Via Nostra
// File: frontend/app/files/[kind]/[id]/route.ts
// Purpose: Lets staff open private documents (ID papers and car papers) in the
//          browser. It asks the backend for the file with the staff member's login,
//          so the backend decides who may see it. Nothing is stored or cached.

import { getToken } from '@/lib/session';

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3001/api/v1';

const FOLDERS: Record<string, string> = {
  verification: 'verification-documents',
  'car-document': 'car-documents',
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ kind: string; id: string }> },
): Promise<Response> {
  const { kind, id } = await context.params;
  const folder = FOLDERS[kind];
  if (!folder) {
    return new Response('Not found', { status: 404 });
  }
  const token = await getToken();
  if (!token) {
    return new Response('Please log in', { status: 401 });
  }

  const upstream = await fetch(`${API_URL}/admin/${folder}/${encodeURIComponent(id)}/file`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!upstream.ok || !upstream.body) {
    return new Response('Not found', { status: upstream.status === 403 ? 403 : 404 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// File: frontend/app/files/[kind]/[id]/route.ts
// END OF FILE