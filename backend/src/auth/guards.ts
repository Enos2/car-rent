// Project: Via Nostra
// File: backend/src/auth/guards.ts
// Purpose: The login and permission checks for routes. requireUser needs any
//          logged-in active user; requirePermission also needs a staff permission.
//          The user is read fresh from the database, so role changes apply at once.

import type { FastifyReply, FastifyRequest } from 'fastify';
import { findUserById } from '../users/repository.js';
import type { User } from '../users/repository.js';
import { hasPermission } from './permissions.js';
import type { Permission } from './permissions.js';

const accounts = new WeakMap<FastifyRequest, User>();

// Returns the logged-in user. Only call it in routes protected by a guard.
export function currentAccount(request: FastifyRequest): User {
  const account = accounts.get(request);
  if (!account) {
    throw new Error('currentAccount was used on a route without a login guard');
  }
  return account;
}

export async function requireUser(
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

  const user = await findUserById(request.user.sub);
  if (!user || !user.isActive) {
    return reply
      .code(401)
      .send({ error: 'Unauthorized', message: 'Account not found or disabled' });
  }
  accounts.set(request, user);
}

export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | void> => {
    const denied = await requireUser(request, reply);
    if (denied) {
      return denied;
    }
    if (!hasPermission(currentAccount(request).roles, permission)) {
      return reply
        .code(403)
        .send({ error: 'Forbidden', message: 'You do not have permission to do this' });
    }
  };
}

// File: backend/src/auth/guards.ts
// END OF FILE
