// Project: Via Nostra
// File: frontend/app/legal/[doc]/page.tsx
// Purpose: Shows one legal page (Terms and Conditions, Privacy Policy or Rental
//          Rules) at /legal/terms, /legal/privacy and /legal/rules.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LEGAL_DOCS } from '@/lib/legal';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ doc: string }>;
}): Promise<Metadata> {
  const { doc } = await params;
  const entry = LEGAL_DOCS[doc];
  return { title: entry ? entry.title : 'Legal' };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const entry = LEGAL_DOCS[doc];
  if (!entry) {
    notFound();
  }

  return (
    <div className="container page" style={{ maxWidth: 820 }}>
      <div className="subnav">
        {Object.entries(LEGAL_DOCS).map(([key, value]) => (
          <Link key={key} href={`/legal/${key}`} className={key === doc ? 'active' : undefined}>
            {value.title}
          </Link>
        ))}
      </div>
      <h1>{entry.title}</h1>
      <p className="hint">Last updated {entry.updated}</p>
      <div className="callout">
        Draft: these pages are pending legal review. Text in [square brackets] must be filled in
        before launch.
      </div>
      {entry.sections.map((section) => (
        <section key={section.heading}>
          <h2 style={{ fontSize: '1.2rem', marginTop: 28 }}>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </section>
      ))}
    </div>
  );
}

// File: frontend/app/legal/[doc]/page.tsx
// END OF FILE