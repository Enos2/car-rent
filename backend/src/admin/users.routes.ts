// File: backend/src/admin/users.routes.ts
// Purpose: Staff tools for managing accounts: search users, give or remove staff
//          ranks (super admin only), suspend or reactivate accounts, and read the
//          audit log. Every change is recorded in the audit log.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordAudit } from '../audit/audit.js';
import { currentAccount, requirePermission } from '../auth/guards.js';
import { ALL_ROLES, STAFF_ROLES } from '../auth/permissions.js';
import { pool } from '../db.js';
import {
  idParamSchema,
  paginationSchema,
  sendError,
  sendValidationError,
} from '../http.js';
import {
  countUsersWithRole,
  findUserById,
  listUsers,
  setUserActive,
  setUserRoles,
} from '../users/repository.js';
import type { UserRole } from '../users/repository.js';

const listQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
  role: z.enum(ALL_ROLES).optional(),
  verificationStatus: z.enum(['unverified', 'pending', 'verified', 'rejected']).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

const staffRolesSchema = z.strictObject({
  staffRoles: z.array(z.enum(STAFF_ROLES)).max(STAFF_ROLES.length),
});

const activeSchema = z.strictObject({
  isActive: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

const auditQuerySchema = paginationSchema.extend({
  entityType: z.string().trim().min(1).max(50).optional(),
  actorId: z.uuid().optional(),
});

export async function adminUserRoutes(app: FastifyInstance): Promise<void> {
  app.get('/admin/users', { preHandler: requirePermission('users.read') }, async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error);
    }
    const { items, total } = await listUsers(parsed.data);
    return { items, total, limit: parsed.data.limit, offset: parsed.data.offset };
  });

  app.get('/admin/users/:id', { preHandler: requirePermission('users.read') }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const user = await findUserById(params.data.id);
    if (!user) {
      return sendError(reply, 404, 'Not Found', 'User not found');
    }
    return { user };
  });

  app.patch(
    '/admin/users/:id/staff-roles',
    { preHandler: requirePermission('staff.manage') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const body = staffRolesSchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }

      const actor = currentAccount(request);
      if (params.data.id === actor.id) {
        return sendError(reply, 400, 'Bad Request', 'You cannot change your own roles');
      }
      const target = await findUserById(params.data.id);
      if (!target) {
        return sendError(reply, 404, 'Not Found', 'User not found');
      }

      const staffRoles = [...new Set(body.data.staffRoles)];
      const publicRoles = target.roles.filter((role) => role === 'renter' || role === 'owner');
      const newRoles: UserRole[] = [...publicRoles, ...staffRoles];

      const losesSuperAdmin =
        target.roles.includes('super_admin') && !staffRoles.includes('super_admin');
      if (losesSuperAdmin && (await countUsersWithRole('super_admin')) <= 1) {
        return sendError(reply, 409, 'Conflict', 'There must always be at least one super admin');
      }

      const updated = await setUserRoles(target.id, newRoles);
      await recordAudit({
        actorId: actor.id,
        action: 'user.staff_roles.changed',
        entityType: 'user',
        entityId: target.id,
        metadata: { before: target.roles, after: newRoles },
        ip: request.ip,
      });
      return { user: updated };
    },
  );

  app.patch(
    '/admin/users/:id/active',
    { preHandler: requirePermission('users.manage') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const body = activeSchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }

      const actor = currentAccount(request);
      if (params.data.id === actor.id) {
        return sendError(reply, 400, 'Bad Request', 'You cannot suspend your own account');
      }
      const updated = await setUserActive(params.data.id, body.data.isActive);
      if (!updated) {
        return sendError(reply, 404, 'Not Found', 'User not found');
      }

      await recordAudit({
        actorId: actor.id,
        action: body.data.isActive ? 'user.reactivated' : 'user.suspended',
        entityType: 'user',
        entityId: updated.id,
        metadata: { reason: body.data.reason },
        ip: request.ip,
      });
      return { user: updated };
    },
  );

  app.get('/admin/audit-log', { preHandler: requirePermission('audit.read') }, async (request, reply) => {
    const parsed = auditQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return sendValidationError(reply, parsed.error);
    }

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (parsed.data.entityType) {
      params.push(parsed.data.entityType);
      conditions.push(`a.entity_type = $${params.length}`);
    }
    if (parsed.data.actorId) {
      params.push(parsed.data.actorId);
      conditions.push(`a.actor_id = $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(parsed.data.limit, parsed.data.offset);
    const result = await pool.query(
      `SELECT a.id, a.action, a.entity_type AS "entityType", a.entity_id AS "entityId",
              a.metadata, a.ip, a.created_at AS "createdAt",
              a.actor_id AS "actorId", u.email AS "actorEmail"
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_id
       ${where}
       ORDER BY a.id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items: result.rows, limit: parsed.data.limit, offset: parsed.data.offset };
  });
}

// File: backend/src/admin/users.routes.ts
// END OF FILE
