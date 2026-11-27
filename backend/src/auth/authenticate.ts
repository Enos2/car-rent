// Project: Via Nostra
// File: backend/src/auth/authenticate.ts
// Purpose: The login check. Put requireAuth in front of any route that needs a
//          logged-in user; it rejects requests without a valid token.

import '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; exp?: number; iat?: number };
    user: { sub: string; exp?: number; iat?: number };
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply | void> {
  try {
    await request.jwtVerify();
  } catch {
    return reply
      .code(401)
      .send({ error: 'Unauthorized', message: 'Missing or invalid access token' });
  }
}

// File: backend/src/auth/authenticate.ts
// END OF FILE
