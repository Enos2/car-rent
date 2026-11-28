// Project: Via Nostra
// File: frontend/app/layout.tsx
// Purpose: The frame around every page: page title settings, the styles, the header
//          at the top and the footer (with the blog and legal links) at the bottom.

import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import Header from '@/components/Header';
import './globals.css';
import './cars.css';
import './dashboard.css';

export const metadata: Metadata = {
  title: {
    default: 'Via Nostra - Rent and share cars you can trust',
    template: '%s | Via Nostra',
  },
  description:
    'A verified car-rental marketplace: cars are checked at a hub and payments are held safely until you confirm the car was received.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
        <footer className="site-footer">
          <div
            className="container"
            style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}
          >
            <span>&copy; {new Date().getFullYear()} Via Nostra. Our road.</span>
            <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <Link href="/blog">Blog</Link>
              <Link href="/legal/terms">Terms</Link>
              <Link href="/legal/rules">Rental rules</Link>
              <Link href="/legal/privacy">Privacy</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}

// File: frontend/app/layout.tsx
// END OF FILE