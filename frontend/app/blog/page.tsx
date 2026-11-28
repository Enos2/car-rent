// Project: Via Nostra
// File: frontend/app/blog/page.tsx
// Purpose: The public blog: the published posts, newest first, with a short summary
//          of each.

import type { Metadata } from 'next';
import Link from 'next/link';
import Pager from '@/components/Pager';
import { apiRequest } from '@/lib/api';
import { firstParam, formatDate } from '@/lib/format';
import type { SearchParams } from '@/lib/format';
import { offsetFor, pageFrom } from '@/lib/paging';
import type { PostSummary } from '@/lib/trust';

export const metadata: Metadata = { title: 'Blog' };

const BLOG_PAGE_SIZE = 10;

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;
  const page = pageFrom(firstParam(query.page));
  const offset = (page - 1) * BLOG_PAGE_SIZE;
  void offsetFor;

  const result = await apiRequest<{ items: PostSummary[]; total: number }>(
    `/posts?limit=${BLOG_PAGE_SIZE}&offset=${offset}`,
  );

  return (
    <div className="container page" style={{ maxWidth: 820 }}>
      <h1>Blog</h1>
      <p className="section-intro">News, tips and stories from the Via Nostra team.</p>

      {!result.ok ? (
        <div className="alert">{result.error.message}</div>
      ) : result.data.items.length === 0 ? (
        <div className="empty">
          <p>No posts yet. Check back soon.</p>
        </div>
      ) : (
        <div className="row-list">
          {result.data.items.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="row-card">
              <div>
                <strong>{post.title}</strong>
                {post.excerpt ? <p>{post.excerpt}</p> : null}
              </div>
              <p>{post.publishedAt ? formatDate(post.publishedAt) : ''}</p>
            </Link>
          ))}
        </div>
      )}
      {result.ok ? (
        <Pager
          basePath="/blog"
          params={{}}
          page={page}
          pageSize={BLOG_PAGE_SIZE}
          total={result.data.total}
        />
      ) : null}
    </div>
  );
}

// File: frontend/app/blog/page.tsx
// END OF FILE