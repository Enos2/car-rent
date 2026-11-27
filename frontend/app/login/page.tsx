// Project: Via Nostra
// File: frontend/app/login/page.tsx
// Purpose: The login page: email and password form that logs the person in through
//          the backend and sends them to their account page.

'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { loginAction } from '@/app/actions';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <div className="form-wrap">
      <form className="form-card" action={formAction}>
        <h1>Welcome back</h1>
        <p className="sub">Log in to your Via Nostra account.</p>

        {state?.message ? <div className="alert">{state.message}</div> : null}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state?.values?.email ?? ''}
            required
          />
          {state?.fieldErrors?.email ? (
            <p className="field-error">{state.fieldErrors.email}</p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Logging in...' : 'Log in'}
        </button>

        <p className="form-footer">
          New here? <Link href="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}

// File: frontend/app/login/page.tsx
// END OF FILE
