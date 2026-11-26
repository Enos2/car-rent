-- File: backend/migrations/003_verification.sql
-- Purpose: Creates the tables for identity verification: a verification request
--          per person and the documents (ID, licence, selfie, company papers) in it.

CREATE TYPE verification_kind AS ENUM ('renter', 'owner', 'company');
CREATE TYPE verification_request_status AS ENUM ('draft', 'pending', 'approved', 'rejected');
CREATE TYPE verification_doc_type AS ENUM (
  'national_id',
  'passport',
  'driving_licence',
  'selfie',
  'business_registration',
  'tax_certificate',
  'proof_of_address'
);

CREATE TABLE verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind verification_kind NOT NULL,
  status verification_request_status NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- A person can have only one open (draft or in-review) request at a time.
CREATE UNIQUE INDEX verification_one_open_request
  ON verification_requests (user_id)
  WHERE status IN ('draft', 'pending');

CREATE INDEX verification_requests_queue_idx
  ON verification_requests (status, submitted_at);

CREATE TABLE verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES verification_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doc_type verification_doc_type NOT NULL,
  storage_key text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One document of each type per request; uploading again replaces the old one.
CREATE UNIQUE INDEX verification_documents_one_per_type
  ON verification_documents (request_id, doc_type);

-- File: backend/migrations/003_verification.sql
-- END OF FILE
