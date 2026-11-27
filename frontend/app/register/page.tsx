// Project: Via Nostra
// File: frontend/app/register/page.tsx
// Purpose: The sign-up page: a person chooses individual or company, whether they
//          want to rent, list cars or both, and creates their account.

'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { registerAction } from '@/app/actions';

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerAction, undefined);
  const [accountType, setAccountType] = useState<'individual' | 'company'>('individual');
  const [roles, setRoles] = useState<string[]>(['renter']);

  function toggleRole(role: string) {
    setRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role],
    );
  }

  return (
    <div className="form-wrap">
      <form className="form-card" action={formAction}>
        <h1>Create your account</h1>
        <p className="sub">Join Via Nostra as a renter, an owner, or both.</p>

        {state?.message ? <div className="alert">{state.message}</div> : null}

        <div className="field">
          <span className="label">I am signing up as</span>
          <div className="choice-row">
            <label className="choice">
              <input
                type="radio"
                name="accountType"
                value="individual"
                checked={accountType === 'individual'}
                onChange={() => setAccountType('individual')}
              />
              An individual
            </label>
            <label className="choice">
              <input
                type="radio"
                name="accountType"
                value="company"
                checked={accountType === 'company'}
                onChange={() => setAccountType('company')}
              />
              A company
            </label>
          </div>
        </div>

        <div className="field">
          <label htmlFor="fullName">
            {accountType === 'company' ? 'Your full name (account holder)' : 'Full name'}
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            defaultValue={state?.values?.fullName ?? ''}
            required
          />
          {state?.fieldErrors?.fullName ? (
            <p className="field-error">{state.fieldErrors.fullName}</p>
          ) : null}
        </div>

        {accountType === 'company' ? (
          <div className="field">
            <label htmlFor="companyName">Company name</label>
            <input
              id="companyName"
              name="companyName"
              type="text"
              autoComplete="organization"
              defaultValue={state?.values?.companyName ?? ''}
              required
            />
            {state?.fieldErrors?.companyName ? (
              <p className="field-error">{state.fieldErrors.companyName}</p>
            ) : null}
          </div>
        ) : null}

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
            autoComplete="new-password"
            minLength={8}
            maxLength={64}
            required
          />
          <p className="hint">8 to 64 characters, with at least one letter and one number.</p>
          {state?.fieldErrors?.password ? (
            <p className="field-error">{state.fieldErrors.password}</p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
          {state?.fieldErrors?.confirmPassword ? (
            <p className="field-error">{state.fieldErrors.confirmPassword}</p>
          ) : null}
        </div>

        <div className="field">
          <span className="label">I want to</span>
          <div className="choice-row">
            <label className="choice">
              <input
                type="checkbox"
                name="roles"
                value="renter"
                checked={roles.includes('renter')}
                onChange={() => toggleRole('renter')}
              />
              Rent cars
            </label>
            <label className="choice">
              <input
                type="checkbox"
                name="roles"
                value="owner"
                checked={roles.includes('owner')}
                onChange={() => toggleRole('owner')}
              />
              List my cars
            </label>
          </div>
          {state?.fieldErrors?.roles ? (
            <p className="field-error">Choose at least one option.</p>
          ) : null}
        </div>

        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Creating account...' : 'Create account'}
        </button>

        <p className="form-footer">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}

// File: frontend/app/register/page.tsx
// END OF FILE
