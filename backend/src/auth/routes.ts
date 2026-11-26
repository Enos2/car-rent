// File: backend/src/auth/routes.ts
// Purpose: The web addresses for signing up, logging in and viewing your own
//          account: POST /auth/register, POST /auth/login and GET /auth/me.

import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { isUniqueViolation, sendValidationError } from '../http.js';
import {
  createUser,
  findUserById,
  findUserWithPasswordByEmail,
} from '../users/repository.js';
import type { User } from '../users/repository.js';
import { requireAuth } from './authenticate.js';
import { hashPassword, verifyPassword } from './password.js';
import { loginSchema, registerSchema } from './schemas.js';

// Used so a login for an unknown email takes as long as a real one.
const dummyHash = await hashPassword('timing-protection-only');

// The safe view of a user that is sent to the website. Never includes the password.
function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    accountType: user.accountType,
    companyName: user.companyName,
    roles: user.roles,
    verificationStatus: user.verificationStatus,
    createdAt: user.createdAt,
  };
}

function issueToken(app: FastifyInstance, user: User) {
  const exp = Math.floor(Date.now() / 1000) + config.jwtExpiresInSeconds;
  return {
    accessToken: app.jwt.sign({ sub: user.id, exp }),
    expiresInSeconds: config.jwtExpiresInSeconds,
    user: toPublicUser(user),
  };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error);
      }
      const input = parsed.data;

      try {
        const user = await createUser({
          email: input.email,
          passwordHash: await hashPassword(input.password),
          fullName: input.fullName,
          accountType: input.accountType,
          companyName: input.accountType === 'company' ? (input.companyName ?? null) : null,
          roles: [...new Set(input.roles)],
        });
        return reply.code(201).send(issueToken(app, user));
      } catch (error) {
        if (isUniqueViolation(error)) {
          return reply.code(409).send({
            error: 'Conflict',
            message: 'An account with this email already exists',
          });
        }
        throw error;
      }
    },
  );

  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendValidationError(reply, parsed.error);
      }

      const user = await findUserWithPasswordByEmail(parsed.data.email);
      const passwordMatches = await verifyPassword(
        parsed.data.password,
        user?.passwordHash ?? dummyHash,
      );
      if (!user || !passwordMatches || !user.isActive) {
        return reply
          .code(401)
          .send({ error: 'Unauthorized', message: 'Invalid email or password' });
      }

      return issueToken(app, user);
    },
  );

  app.get('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const user = await findUserById(request.user.sub);
    if (!user || !user.isActive) {
      return reply
        .code(401)
        .send({ error: 'Unauthorized', message: 'Account not found or disabled' });
    }
    return { user: toPublicUser(user) };
  });
}

// File: backend/src/auth/routes.ts
// END OF FILE
