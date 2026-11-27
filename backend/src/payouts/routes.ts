// Project: Via Nostra
// File: backend/src/payouts/routes.ts
// Purpose: The web addresses for owner money: an owner sees their balance and asks
//          for a payout; finance staff review payouts and see the platform's totals
//          and the ledger. Finance staff cannot approve their own payout.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordAudit } from '../audit/audit.js';
import { currentAccount, requirePermission, requireUser } from '../auth/guards.js';
import { idParamSchema, paginationSchema, sendError, sendValidationError } from '../http.js';
import { getOwnerBalances, getPlatformBalances, listLedgerTransactions } from '../payments/ledger.js';
import { getPaymentProvider } from '../payments/provider.js';
import { listPayouts, markPayoutPaid, rejectPayout, requestPayout } from './repository.js';
import type { DecisionOutcome } from './repository.js';

const requestSchema = z.strictObject({
  amountMinor: z.number().int().min(100).max(2_000_000_000),
  currency: z.string().trim().length(3).toUpperCase(),
  destination: z.string().trim().min(3).max(120),
});

const rejectSchema = z.strictObject({ reason: z.string().trim().min(5).max(500) });

const statusSchema = z.enum(['requested', 'paid', 'rejected']);
const ownerListSchema = paginationSchema.extend({ status: statusSchema.optional() });
const adminListSchema = paginationSchema.extend({ status: statusSchema.default('requested') });
const ledgerQuerySchema = paginationSchema.extend({ bookingId: z.uuid().optional() });

function decisionError(
  reply: Parameters<typeof sendError>[0],
  outcome: Extract<DecisionOutcome, { ok: false }>,
) {
  switch (outcome.reason) {
    case 'not_found':
      return sendError(reply, 404, 'Not Found', 'Payout not found');
    case 'own_payout':
      return sendError(reply, 403, 'Forbidden', 'You cannot review your own payout');
    case 'state':
      return sendError(reply, 409, 'Conflict', 'This payout is not waiting for review');
  }
}

export async function payoutRoutes(app: FastifyInstance): Promise<void> {
  // ----- For owners -----

  app.get('/payouts/balance', { preHandler: requireUser }, async (request) => ({
    balances: await getOwnerBalances(currentAccount(request).id),
  }));

  app.get('/payouts', { preHandler: requireUser }, async (request, reply) => {
    const query = ownerListSchema.safeParse(request.query);
    if (!query.success) {
      return sendValidationError(reply, query.error);
    }
    const { items, total } = await listPayouts({
      ownerId: currentAccount(request).id,
      ...query.data,
    });
    return { items, total, limit: query.data.limit, offset: query.data.offset };
  });

  app.post(
    '/payouts',
    { preHandler: requireUser, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const account = currentAccount(request);
      if (!account.roles.includes('owner') || account.verificationStatus !== 'verified') {
        return sendError(reply, 403, 'Forbidden', 'Only verified owners can request a payout');
      }
      const body = requestSchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }
      const outcome = await requestPayout({ ownerId: account.id, ...body.data });
      if (!outcome.ok) {
        return reply.code(400).send({
          error: 'Insufficient balance',
          message: 'You do not have enough available balance for this payout',
          availableMinor: outcome.availableMinor,
        });
      }
      await recordAudit({
        actorId: account.id,
        action: 'payout.requested',
        entityType: 'payout',
        entityId: outcome.payout.id,
        metadata: { amountMinor: body.data.amountMinor, currency: body.data.currency },
        ip: request.ip,
      });
      return reply.code(201).send({ payout: outcome.payout });
    },
  );

  // ----- For finance staff -----

  app.get('/admin/payouts', { preHandler: requirePermission('finance.read') }, async (request, reply) => {
    const query = adminListSchema.safeParse(request.query);
    if (!query.success) {
      return sendValidationError(reply, query.error);
    }
    const { items, total } = await listPayouts(query.data);
    return { items, total, limit: query.data.limit, offset: query.data.offset };
  });

  app.post(
    '/admin/payouts/:id/pay',
    { preHandler: requirePermission('finance.manage') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const actor = currentAccount(request);
      const outcome = await markPayoutPaid(params.data.id, actor.id, getPaymentProvider());
      if (!outcome.ok) {
        return decisionError(reply, outcome);
      }
      await recordAudit({
        actorId: actor.id,
        action: 'payout.paid',
        entityType: 'payout',
        entityId: outcome.payout.id,
        metadata: { ownerId: outcome.payout.ownerId, amountMinor: outcome.payout.amountMinor },
        ip: request.ip,
      });
      return { payout: outcome.payout };
    },
  );

  app.post(
    '/admin/payouts/:id/reject',
    { preHandler: requirePermission('finance.manage') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const body = rejectSchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }
      const actor = currentAccount(request);
      const outcome = await rejectPayout(params.data.id, actor.id, body.data.reason);
      if (!outcome.ok) {
        return decisionError(reply, outcome);
      }
      await recordAudit({
        actorId: actor.id,
        action: 'payout.rejected',
        entityType: 'payout',
        entityId: outcome.payout.id,
        metadata: { ownerId: outcome.payout.ownerId, reason: body.data.reason },
        ip: request.ip,
      });
      return { payout: outcome.payout };
    },
  );

  app.get(
    '/admin/finance/summary',
    { preHandler: requirePermission('finance.read') },
    async () => ({ balances: await getPlatformBalances() }),
  );

  app.get('/admin/finance/ledger', { preHandler: requirePermission('finance.read') }, async (request, reply) => {
    const query = ledgerQuerySchema.safeParse(request.query);
    if (!query.success) {
      return sendValidationError(reply, query.error);
    }
    return {
      items: await listLedgerTransactions(query.data),
      limit: query.data.limit,
      offset: query.data.offset,
    };
  });
}

// File: backend/src/payouts/routes.ts
// END OF FILE