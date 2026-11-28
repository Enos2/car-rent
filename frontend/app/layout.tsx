// Project: Via Nostra
// File: frontend/app/layout.tsx
// Purpose: The frame around every page: page title settings, the styles, the header
//          at the top and the footer at the bottom.

import type { Metadata } from 'next';
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
          <div className="container">&copy; {new Date().getFullYear()} Via Nostra. Our road.</div>
        </footer>
      </body>
    </html>
  );
}

// File: frontend/app/layout.tsx
// END OF FILE