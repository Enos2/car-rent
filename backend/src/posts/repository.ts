// Project: Via Nostra
// File: backend/src/posts/repository.ts
// Purpose: Database work for blog posts: public listing and reading of published
//          posts, and the staff tools to create, edit, publish and hide posts.

import { randomBytes } from 'node:crypto';
import { pool } from '../db.js';

export type PostStatus = 'draft' | 'published' | 'hidden';

export type Post = {
  id: string;
  authorId: string;
  authorName: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  status: PostStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: Date | null;
  authorName: string;
};

const POST_COLUMNS = `
  p.id, p.author_id AS "authorId", u.full_name AS "authorName", p.slug, p.title, p.excerpt,
  p.body, p.status, p.published_at AS "publishedAt", p.created_at AS "createdAt",
  p.updated_at AS "updatedAt"
`;

const POST_FROM = `FROM posts p JOIN users u ON u.id = p.author_id`;

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'post'}-${randomBytes(3).toString('hex')}`;
}

export async function listPublishedPosts(
  limit: number,
  offset: number,
): Promise<{ items: PostSummary[]; total: number }> {
  const total = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM posts WHERE status = 'published'`,
  );
  const items = await pool.query<PostSummary>(
    `SELECT p.id, p.slug, p.title, p.excerpt, p.published_at AS "publishedAt",
            u.full_name AS "authorName"
     ${POST_FROM}
     WHERE p.status = 'published'
     ORDER BY p.published_at DESC NULLS LAST
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return { items: items.rows, total: total.rows[0]?.count ?? 0 };
}

export async function getPublishedPostBySlug(slug: string): Promise<Post | null> {
  const result = await pool.query<Post>(
    `SELECT ${POST_COLUMNS} ${POST_FROM} WHERE p.slug = $1 AND p.status = 'published'`,
    [slug],
  );
  return result.rows[0] ?? null;
}

export async function getPost(id: string): Promise<Post | null> {
  const result = await pool.query<Post>(`SELECT ${POST_COLUMNS} ${POST_FROM} WHERE p.id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function listAllPosts(
  status: PostStatus,
  limit: number,
  offset: number,
): Promise<{ items: Post[]; total: number }> {
  const total = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM posts WHERE status = $1`,
    [status],
  );
  const items = await pool.query<Post>(
    `SELECT ${POST_COLUMNS} ${POST_FROM}
     WHERE p.status = $1
     ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
    [status, limit, offset],
  );
  return { items: items.rows, total: total.rows[0]?.count ?? 0 };
}

export async function createPost(input: {
  authorId: string;
  title: string;
  excerpt: string | null;
  body: string;
  publish: boolean;
}): Promise<Post> {
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO posts (author_id, slug, title, excerpt, body, status, published_at)
     VALUES ($1, $2, $3, $4, $5, $6::post_status, CASE WHEN $6::post_status = 'published' THEN now() END)
     RETURNING id`,
    [
      input.authorId,
      slugify(input.title),
      input.title,
      input.excerpt,
      input.body,
      input.publish ? 'published' : 'draft',
    ],
  );
  const id = inserted.rows[0]?.id;
  const post = id ? await getPost(id) : null;
  if (!post) {
    throw new Error('The post was not saved');
  }
  return post;
}

export async function updatePost(
  id: string,
  changes: { title?: string; excerpt?: string | null; body?: string },
): Promise<Post | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (changes.title !== undefined) {
    params.push(changes.title);
    sets.push(`title = $${params.length}`);
  }
  if (changes.excerpt !== undefined) {
    params.push(changes.excerpt);
    sets.push(`excerpt = $${params.length}`);
  }
  if (changes.body !== undefined) {
    params.push(changes.body);
    sets.push(`body = $${params.length}`);
  }
  if (sets.length === 0) {
    return getPost(id);
  }
  params.push(id);
  const result = await pool.query<{ id: string }>(
    `UPDATE posts SET ${sets.join(', ')}, updated_at = now()
     WHERE id = $${params.length} RETURNING id`,
    params,
  );
  return result.rows[0] ? getPost(id) : null;
}

export async function setPostStatus(id: string, status: PostStatus): Promise<Post | null> {
  const result = await pool.query<{ id: string }>(
    `UPDATE posts
     SET status = $2::post_status,
         published_at = CASE WHEN $2::post_status = 'published' AND published_at IS NULL
                             THEN now() ELSE published_at END,
         updated_at = now()
     WHERE id = $1 RETURNING id`,
    [id, status],
  );
  return result.rows[0] ? getPost(id) : null;
}

// File: backend/src/posts/repository.ts
// END OF FILE