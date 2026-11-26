// File: backend/src/hubs/routes.ts
// Purpose: The web addresses for hubs. Anyone can list active hubs; hub managers
//          create and edit hubs and assign staff to them. Changes are audited.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordAudit } from '../audit/audit.js';
import { currentAccount, requirePermission } from '../auth/guards.js';
import { isStaff } from '../auth/permissions.js';
import { idParamSchema, sendError, sendValidationError } from '../http.js';
import { findUserById } from '../users/repository.js';
import {
  addHubStaff,
  createHub,
  getHub,
  listHubStaff,
  listHubs,
  removeHubStaff,
  updateHub,
} from './repository.js';

const hubFields = {
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(100),
  countryCode: z.string().trim().length(2).toUpperCase(),
  address: z.string().trim().min(5).max(255),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  openingHours: z.string().trim().max(255).nullable().optional(),
  contactPhone: z.string().trim().max(40).nullable().optional(),
};

const createHubSchema = z.strictObject(hubFields);

const updateHubSchema = z
  .strictObject(hubFields)
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((changes) => Object.keys(changes).length > 0, {
    message: 'Send at least one field to change',
  });

const publicQuerySchema = z.object({
  city: z.string().trim().min(1).max(100).optional(),
  countryCode: z.string().trim().length(2).toUpperCase().optional(),
});

const staffBodySchema = z.strictObject({ userId: z.uuid() });
const hubStaffParams = z.object({ id: z.uuid(), userId: z.uuid() });

export async function hubRoutes(app: FastifyInstance): Promise<void> {
  // Public: anyone can see the active hubs.
  app.get('/hubs', async (request, reply) => {
    const query = publicQuerySchema.safeParse(request.query);
    if (!query.success) {
      return sendValidationError(reply, query.error);
    }
    return { items: await listHubs(query.data) };
  });

  app.get('/hubs/:id', async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const hub = await getHub(params.data.id);
    if (!hub || !hub.isActive) {
      return sendError(reply, 404, 'Not Found', 'Hub not found');
    }
    return { hub };
  });

  // Staff: manage hubs.
  app.get('/admin/hubs', { preHandler: requirePermission('hubs.manage') }, async () => ({
    items: await listHubs({ includeInactive: true }),
  }));

  app.post('/admin/hubs', { preHandler: requirePermission('hubs.manage') }, async (request, reply) => {
    const body = createHubSchema.safeParse(request.body);
    if (!body.success) {
      return sendValidationError(reply, body.error);
    }
    const hub = await createHub(body.data);
    await recordAudit({
      actorId: currentAccount(request).id,
      action: 'hub.created',
      entityType: 'hub',
      entityId: hub.id,
      metadata: { name: hub.name, city: hub.city },
      ip: request.ip,
    });
    return reply.code(201).send({ hub });
  });

  app.patch('/admin/hubs/:id', { preHandler: requirePermission('hubs.manage') }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const body = updateHubSchema.safeParse(request.body);
    if (!body.success) {
      return sendValidationError(reply, body.error);
    }
    const hub = await updateHub(params.data.id, body.data);
    if (!hub) {
      return sendError(reply, 404, 'Not Found', 'Hub not found');
    }
    await recordAudit({
      actorId: currentAccount(request).id,
      action: 'hub.updated',
      entityType: 'hub',
      entityId: hub.id,
      metadata: { changes: body.data },
      ip: request.ip,
    });
    return { hub };
  });

  app.get('/admin/hubs/:id/staff', { preHandler: requirePermission('hubs.manage') }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    return { items: await listHubStaff(params.data.id) };
  });

  app.post('/admin/hubs/:id/staff', { preHandler: requirePermission('hubs.manage') }, async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const body = staffBodySchema.safeParse(request.body);
    if (!body.success) {
      return sendValidationError(reply, body.error);
    }

    const hub = await getHub(params.data.id);
    if (!hub) {
      return sendError(reply, 404, 'Not Found', 'Hub not found');
    }
    const member = await findUserById(body.data.userId);
    if (!member || !member.isActive) {
      return sendError(reply, 404, 'Not Found', 'User not found');
    }
    if (!isStaff(member.roles)) {
      return sendError(reply, 400, 'Bad Request', 'Only staff accounts can be assigned to a hub');
    }

    await addHubStaff(hub.id, member.id);
    await recordAudit({
      actorId: currentAccount(request).id,
      action: 'hub.staff.added',
      entityType: 'hub',
      entityId: hub.id,
      metadata: { userId: member.id },
      ip: request.ip,
    });
    return reply.code(201).send({ items: await listHubStaff(hub.id) });
  });

  app.delete('/admin/hubs/:id/staff/:userId', { preHandler: requirePermission('hubs.manage') }, async (request, reply) => {
    const params = hubStaffParams.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const removed = await removeHubStaff(params.data.id, params.data.userId);
    if (!removed) {
      return sendError(reply, 404, 'Not Found', 'That staff member is not assigned to this hub');
    }
    await recordAudit({
      actorId: currentAccount(request).id,
      action: 'hub.staff.removed',
      entityType: 'hub',
      entityId: params.data.id,
      metadata: { userId: params.data.userId },
      ip: request.ip,
    });
    return { items: await listHubStaff(params.data.id) };
  });
}

// File: backend/src/hubs/routes.ts
// END OF FILE
