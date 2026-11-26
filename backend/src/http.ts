// File: backend/src/http.ts
// Purpose: Small helpers shared by the API routes: standard error replies, a check
//          for "this value already exists" database errors, and shared validation
//          rules for ids and paging.

import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import type { ZodError } from 'zod';

export function sendValidationError(reply: FastifyReply, error: ZodError): FastifyReply {
  return reply.code(400).send({
    error: 'Validation failed',
    issues: error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  });
}

export function sendError(
  reply: FastifyReply,
  status: number,
  error: string,
  message: string,
): FastifyReply {
  return reply.code(status).send({ error, message });
}

// PostgreSQL error code 23505 means a unique value (such as an email) already exists.
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === '23505'
  );
}

export const idParamSchema = z.object({ id: z.uuid() });

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// File: backend/src/http.ts
// END OF FILE
