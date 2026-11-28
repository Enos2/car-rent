// Project: Via Nostra
// File: frontend/app/blog/[slug]/page.tsx
// Purpose: One blog post. The text is shown as plain paragraphs, so a post can never
//          contain harmful code. Logged-in readers can report a post.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Flash from '@/components/Flash';
import ReportForm from '@/components/ReportForm';
import { apiRequest } from '@/lib/api';
import { firstParam, formatDate } from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { getToken } from '@/lib/session';
import type { PostDetail } from '@/lib/trust';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await apiRequest<{ post: PostDetail }>(`/posts/${encodeURIComponent(slug)}`);
  return { title: result.ok ? result.data.post.title : 'Blog' };
}

export default async function BlogPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const [result, token] = await Promise.all([
    apiRequest<{ post: PostDetail }>(`/posts/${encodeURIComponent(slug)}`),
    getToken(),
  ]);

  if (!result.ok) {
    if (result.status === 0) {
      return (
        <div className="container page">
          <div className="alert">{result.error.message}</div>
        </div>
      );
    }
    notFound();
  }

  const { post } = result.data;
  const paragraphs = post.body.split(/\n{2,}/);

  return (
    <div className="container page" style={{ maxWidth: 760 }}>
      <p className="hint">
        <Link href="/blog">&larr; All posts</Link>
      </p>
      <Flash notice={firstParam(query.notice)} error={firstParam(query.error)} />
      <h1>{post.title}</h1>
      <p className="hint">
        {post.authorName}
        {post.publishedAt ? ` \u00b7 ${formatDate(post.publishedAt)}` : ''}
      </p>
      {paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 40)} style={{ whiteSpace: 'pre-line' }}>
          {paragraph}
        </p>
      ))}
      {token ? <ReportForm targetType="post" targetId={post.id} back={`/blog/${post.slug}`} label="Report this post" /> : null}
    </div>
  );
}

// File: frontend/app/blog/[slug]/page.tsx
// END OF FILE