// Project: Via Nostra
// File: frontend/components/Pager.tsx
// Purpose: The "Previous / Next" links under a long list. It keeps the other
//          filters in the address. Give it the total number of rows when known,
//          or hasNext when the list does not report a total.

import Link from 'next/link';

type PagerProps = {
  basePath: string;
  params: Record<string, string>;
  page: number;
  pageSize: number;
  total?: number;
  hasNext?: boolean;
};

export default function Pager({ basePath, params, page, pageSize, total, hasNext }: PagerProps) {
  const totalPages = total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : undefined;
  const more = totalPages !== undefined ? page < totalPages : Boolean(hasNext);
  if (page <= 1 && !more) {
    return null;
  }

  const href = (target: number): string => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        search.set(key, value);
      }
    }
    if (target > 1) {
      search.set('page', String(target));
    }
    const text = search.toString();
    return text ? `${basePath}?${text}` : basePath;
  };

  return (
    <div className="pagination">
      {page > 1 ? (
        <Link href={href(page - 1)} className="btn btn-ghost btn-small">
          Previous
        </Link>
      ) : null}
      <span>
        Page {page}
        {totalPages ? ` of ${totalPages}` : ''}
      </span>
      {more ? (
        <Link href={href(page + 1)} className="btn btn-ghost btn-small">
          Next
        </Link>
      ) : null}
    </div>
  );
}

// File: frontend/components/Pager.tsx
// END OF FILE