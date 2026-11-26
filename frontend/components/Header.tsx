// File: frontend/components/Header.tsx
// Purpose: The top bar shown on every page: the brand name and the links that
//          change depending on whether the visitor is logged in.

import Link from 'next/link';
import { logoutAction } from '@/app/actions';
import { getToken } from '@/lib/session';

export default async function Header() {
  const signedIn = (await getToken()) !== null;

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand">
          Via <span>Nostra</span>
        </Link>
        <nav className="nav">
          {signedIn ? (
            <>
              <Link href="/account" className="btn btn-ghost">
                My account
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="btn">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn">
                Log in
              </Link>
              <Link href="/register" className="btn btn-primary">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

// File: frontend/components/Header.tsx
// END OF FILE
