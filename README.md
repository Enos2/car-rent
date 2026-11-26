<!--
File: README.md
Purpose: Project overview for Via Nostra and instructions for running it locally.
-->

# Via Nostra

A verified car-rental marketplace where companies and individuals offer their cars,
cars are checked at a designated hub, and payments are held safely until the renter
confirms the car was received.

## Structure

- `backend/` - Fastify API (TypeScript, PostgreSQL)
- `frontend/` - Next.js website (TypeScript)

## Run it (two terminal tabs)

Backend, on http://localhost:3001:

    cd backend
    npm install
    npm run dev

Frontend, on http://localhost:3000:

    cd frontend
    npm install
    npm run dev

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to
`frontend/.env.local`, and fill in the values, before starting.

## First staff member

Sign up on the website, then give that account the super admin rank:

    cd backend
    npm run make-admin -- you@example.com

## Backend features so far

- Accounts: sign-up (individual or company), login, GET /auth/me
- Staff ranks with permissions: support, verification officer, hub manager,
  finance, content moderator, super admin
- Admin: search users, change staff ranks, suspend or reactivate, audit log
- Hubs: public list; staff create, edit and assign staff
- Identity verification: upload documents, submit, staff review queue, approve
  or reject (nobody can review their own account)

All routes are under /api/v1.

<!--
File: README.md
END OF FILE
-->
