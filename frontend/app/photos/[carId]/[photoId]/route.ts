// Project: Via Nostra
// File: frontend/app/photos/[carId]/[photoId]/route.ts
// Purpose: Delivers car photos to the browser by asking the backend for them. This
//          keeps the backend address private and passes along the visitor's login
//          so owners can see photos of cars that are not live yet.

import { getToken } from '@/lib/session';

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:3001/api/v1';

export async function GET(
  _request: Request,
  context: { params: Promise<{ carId: string; photoId: string }> },
): Promise<Response> {
  const { carId, photoId } = await context.params;
  const token = await getToken();

  const upstream = await fetch(
    `${API_URL}/cars/${encodeURIComponent(carId)}/photos/${encodeURIComponent(photoId)}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    },
  );
  if (!upstream.ok || !upstream.body) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

// File: frontend/app/photos/[carId]/[photoId]/route.ts
// END OF FILE