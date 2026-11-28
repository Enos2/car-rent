// Project: Via Nostra
// File: frontend/components/Header.tsx
// Purpose: The top bar shown on every page: the brand name, the main links and the
//          buttons that change with who is logged in (renter, owner or staff).

import Link from 'next/link';
import { logoutAction } from '@/app/actions';
import { getCurrentUser } from '@/lib/session';

export default async function Header() {
  const user = await getCurrentUser();
  const isOwner = user?.roles.includes('owner') ?? false;
  const isRenter = user?.roles.includes('renter') ?? false;
  const isStaff = (user?.permissions.length ?? 0) > 0;

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand">
          Via <span>Nostra</span>
        </Link>
        <nav className="nav">
          <Link href="/cars" className="btn">
            Cars
          </Link>
          {user ? (
            <>
              {isRenter ? (
                <Link href="/bookings" className="btn">
                  My bookings
                </Link>
              ) : null}
              {isOwner ? (
                <Link href="/owner" className="btn">
                  Owner
                </Link>
              ) : null}
              {isStaff ? (
                <Link href="/admin" className="btn">
                  Staff
                </Link>
              ) : null}
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