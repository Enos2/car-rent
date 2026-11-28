// Project: Via Nostra
// File: frontend/app/admin/posts/page.tsx
// Purpose: The blog desk: write a new post (as a draft or published at once), and
//          for each post edit it, publish it, move it back to draft, or hide it.

import type { Metadata } from 'next';
import {
  createPostAction,
  setPostStatusAction,
  updatePostAction,
} from '@/app/admin/trust-admin-actions';
import Field from '@/components/Field';
import Flash from '@/components/Flash';
import Pager from '@/components/Pager';
import StatusTabs from '@/components/StatusTabs';
import { apiRequest } from '@/lib/api';
import { firstParam, formatDateTime } from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { PAGE_SIZE, offsetFor, pageFrom } from '@/lib/paging';
import { requireStaff } from '@/lib/session';
import type { AdminPost } from '@/lib/trust';

export const metadata: Metadata = { title: 'Blog posts' };

const TABS = [
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
  { value: 'hidden', label: 'Hidden' },
];

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await requireStaff('content.manage');
  const query = await searchParams;
  const status = firstParam(query.status) || 'published';
  const page = pageFrom(firstParam(query.page));

  const result = await apiRequest<{ items: AdminPost[]; total: number }>(
    `/admin/posts?status=${encodeURIComponent(status)}&limit=${PAGE_SIZE}&offset=${offsetFor(page)}`,
    { token },
  );

  return (
    <div className="stack">
      <Flash notice={firstParam(query.notice)} error={firstParam(query.error)} />

      <form action={createPostAction} className="form-panel">
        <h2>Write a post</h2>
        <Field label="Title" name="title" required minLength={3} maxLength={150} />
        <Field label="Short summary (optional)" name="excerpt" maxLength={300} />
        <Field
          label="Text"
          name="body"
          rows={8}
          required
          minLength={20}
          maxLength={20000}
          hint="Plain text. Leave a blank line between paragraphs."
        />
        <label className="choice" style={{ marginBottom: 16 }}>
          <input type="checkbox" name="publish" />
          Publish now (otherwise it is saved as a draft)
        </label>
        <div>
          <button type="submit" className="btn btn-primary">
            Save post
          </button>
        </div>
      </form>

      <StatusTabs tabs={TABS} current={status} basePath="/admin/posts" />
      {!result.ok ? (
        <div className="alert">{result.error.message}</div>
      ) : result.data.items.length === 0 ? (
        <div className="empty">
          <p>No posts in this list.</p>
        </div>
      ) : (
        result.data.items.map((post) => (
          <div className="form-panel" key={post.id}>
            <div className="section-head">
              <h3 style={{ margin: 0 }}>{post.title}</h3>
              <span className="hint">
                {post.authorName} &middot; {formatDateTime(post.updatedAt)}
              </span>
            </div>
            {post.excerpt ? <p>{post.excerpt}</p> : null}

            <div className="actions" style={{ marginTop: 8 }}>
              {(['published', 'draft', 'hidden'] as const)
                .filter((target) => target !== post.status)
                .map((target) => (
                  <form action={setPostStatusAction} key={target}>
                    <input type="hidden" name="id" value={post.id} />
                    <input type="hidden" name="status" value={target} />
                    <input type="hidden" name="currentStatus" value={post.status} />
                    <button
                      type="submit"
                      className={target === 'hidden' ? 'btn btn-danger btn-small' : 'btn btn-ghost btn-small'}
                    >
                      {target === 'published' ? 'Publish' : target === 'draft' ? 'Move to drafts' : 'Hide'}
                    </button>
                  </form>
                ))}
            </div>

            <details className="cancel-box">
              <summary>Edit</summary>
              <form action={updatePostAction} style={{ maxWidth: 'none' }}>
                <input type="hidden" name="id" value={post.id} />
                <input type="hidden" name="currentStatus" value={post.status} />
                <Field label="Title" name="title" defaultValue={post.title} required minLength={3} maxLength={150} />
                <Field label="Short summary" name="excerpt" defaultValue={post.excerpt ?? ''} maxLength={300} />
                <Field label="Text" name="body" rows={8} defaultValue={post.body} required minLength={20} maxLength={20000} />
                <button type="submit" className="btn btn-primary btn-small">
                  Save changes
                </button>
              </form>
            </details>
          </div>
        ))
      )}
      {result.ok ? (
        <Pager
          basePath="/admin/posts"
          params={{ status }}
          page={page}
          pageSize={PAGE_SIZE}
          total={result.data.total}
        />
      ) : null}
    </div>
  );
}

// File: frontend/app/admin/posts/page.tsx
// END OF FILE