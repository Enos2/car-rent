// Project: Via Nostra
// File: frontend/app/admin/trust-admin-actions.ts
// Purpose: The server-side logic behind the moderation tools in the staff console:
//          closing reports (with an optional action) and writing, editing,
//          publishing and hiding blog posts.

'use server';

import { field, runApiAction } from '@/lib/action-helpers';

function enc(value: string): string {
  return encodeURIComponent(value);
}

export async function resolveReportAction(formData: FormData): Promise<void> {
  const action = field(formData, 'action');
  await runApiAction({
    path: `/admin/reports/${enc(field(formData, 'id'))}/resolve`,
    body: {
      outcome: field(formData, 'outcome'),
      note: field(formData, 'note'),
      ...(action ? { action } : {}),
    },
    back: '/admin/reports',
    notice: 'Report closed.',
  });
}

export async function createPostAction(formData: FormData): Promise<void> {
  const publish = formData.get('publish') === 'on';
  const excerpt = field(formData, 'excerpt');
  await runApiAction({
    path: '/admin/posts',
    body: {
      title: field(formData, 'title'),
      body: field(formData, 'body'),
      publish,
      ...(excerpt ? { excerpt } : {}),
    },
    back: `/admin/posts?status=${publish ? 'published' : 'draft'}`,
    notice: publish ? 'Post published.' : 'Draft saved.',
  });
}

export async function updatePostAction(formData: FormData): Promise<void> {
  const excerpt = field(formData, 'excerpt');
  await runApiAction({
    path: `/admin/posts/${enc(field(formData, 'id'))}`,
    method: 'PATCH',
    body: {
      title: field(formData, 'title'),
      body: field(formData, 'body'),
      excerpt: excerpt ? excerpt : null,
    },
    back: `/admin/posts?status=${enc(field(formData, 'currentStatus') || 'published')}`,
    notice: 'Post updated.',
  });
}

export async function setPostStatusAction(formData: FormData): Promise<void> {
  await runApiAction({
    path: `/admin/posts/${enc(field(formData, 'id'))}/status`,
    body: { status: field(formData, 'status') },
    back: `/admin/posts?status=${enc(field(formData, 'currentStatus') || 'published')}`,
    notice: 'Post status changed.',
  });
}

// File: frontend/app/admin/trust-admin-actions.ts
// END OF FILE