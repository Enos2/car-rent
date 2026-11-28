// Project: Via Nostra
// File: backend/src/posts/routes.ts
// Purpose: The web addresses for the blog. Anyone can list and read published posts;
//          staff with content permission write, edit, publish and hide posts. Posts
//          are plain text, so they can never contain harmful code.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { recordAudit } from '../audit/audit.js';
import { currentAccount, requirePermission } from '../auth/guards.js';
import { idParamSchema, paginationSchema, sendError, sendValidationError } from '../http.js';
import {
  createPost,
  getPublishedPostBySlug,
  listAllPosts,
  listPublishedPosts,
  setPostStatus,
  updatePost,
} from './repository.js';

const slugParams = z.object({ slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/) });

const createSchema = z.strictObject({
  title: z.string().trim().min(3).max(150),
  excerpt: z.string().trim().max(300).optional(),
  body: z.string().trim().min(20).max(20000),
  publish: z.boolean().default(false),
});

const updateSchema = z
  .strictObject({
    title: z.string().trim().min(3).max(150),
    excerpt: z.string().trim().max(300).nullable(),
    body: z.string().trim().min(20).max(20000),
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, {
    message: 'Send at least one field to change',
  });

const statusSchema = z.strictObject({ status: z.enum(['draft', 'published', 'hidden']) });

const adminListSchema = paginationSchema.extend({
  status: z.enum(['draft', 'published', 'hidden']).default('published'),
});

export async function postRoutes(app: FastifyInstance): Promise<void> {
  app.get('/posts', async (request, reply) => {
    const query = paginationSchema.safeParse(request.query);
    if (!query.success) {
      return sendValidationError(reply, query.error);
    }
    const { items, total } = await listPublishedPosts(query.data.limit, query.data.offset);
    return { items, total, limit: query.data.limit, offset: query.data.offset };
  });

  app.get('/posts/:slug', async (request, reply) => {
    const params = slugParams.safeParse(request.params);
    if (!params.success) {
      return sendValidationError(reply, params.error);
    }
    const post = await getPublishedPostBySlug(params.data.slug);
    if (!post) {
      return sendError(reply, 404, 'Not Found', 'Post not found');
    }
    return { post };
  });

  app.get('/admin/posts', { preHandler: requirePermission('content.manage') }, async (request, reply) => {
    const query = adminListSchema.safeParse(request.query);
    if (!query.success) {
      return sendValidationError(reply, query.error);
    }
    const { items, total } = await listAllPosts(query.data.status, query.data.limit, query.data.offset);
    return { items, total, limit: query.data.limit, offset: query.data.offset };
  });

  app.post('/admin/posts', { preHandler: requirePermission('content.manage') }, async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) {
      return sendValidationError(reply, body.error);
    }
    const actor = currentAccount(request);
    const post = await createPost({
      authorId: actor.id,
      title: body.data.title,
      excerpt: body.data.excerpt ? body.data.excerpt : null,
      body: body.data.body,
      publish: body.data.publish,
    });
    await recordAudit({
      actorId: actor.id,
      action: body.data.publish ? 'post.published' : 'post.drafted',
      entityType: 'post',
      entityId: post.id,
      metadata: { title: post.title },
      ip: request.ip,
    });
    return reply.code(201).send({ post });
  });

  app.patch(
    '/admin/posts/:id',
    { preHandler: requirePermission('content.manage') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const body = updateSchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }
      const post = await updatePost(params.data.id, body.data);
      if (!post) {
        return sendError(reply, 404, 'Not Found', 'Post not found');
      }
      await recordAudit({
        actorId: currentAccount(request).id,
        action: 'post.edited',
        entityType: 'post',
        entityId: post.id,
        ip: request.ip,
      });
      return { post };
    },
  );

  app.post(
    '/admin/posts/:id/status',
    { preHandler: requirePermission('content.manage') },
    async (request, reply) => {
      const params = idParamSchema.safeParse(request.params);
      if (!params.success) {
        return sendValidationError(reply, params.error);
      }
      const body = statusSchema.safeParse(request.body);
      if (!body.success) {
        return sendValidationError(reply, body.error);
      }
      const post = await setPostStatus(params.data.id, body.data.status);
      if (!post) {
        return sendError(reply, 404, 'Not Found', 'Post not found');
      }
      await recordAudit({
        actorId: currentAccount(request).id,
        action: `post.${body.data.status}`,
        entityType: 'post',
        entityId: post.id,
        ip: request.ip,
      });
      return { post };
    },
  );
}

// File: backend/src/posts/routes.ts
// END OF FILE