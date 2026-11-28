-- Project: Via Nostra
-- File: backend/migrations/006_trust_and_content.sql
-- Purpose: Adds the trust and content tables: which version of the terms each person
--          accepted, reviews (ratings) of finished rentals, reports of cars, people,
--          reviews and posts, and blog posts.

ALTER TABLE users
  ADD COLUMN terms_version text,
  ADD COLUMN terms_accepted_at timestamptz;

CREATE TYPE review_direction AS ENUM ('renter_to_owner', 'owner_to_renter');

CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  car_id uuid NOT NULL REFERENCES cars(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  direction review_direction NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR char_length(comment) <= 1000),
  is_hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, direction),
  CONSTRAINT reviews_not_self CHECK (author_id <> subject_id)
);

CREATE INDEX reviews_car_idx ON reviews (car_id, direction, created_at DESC);
CREATE INDEX reviews_subject_idx ON reviews (subject_id, direction);

CREATE TYPE post_status AS ENUM ('draft', 'published', 'hidden');

CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  body text NOT NULL,
  status post_status NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX posts_published_idx ON posts (status, published_at DESC);

CREATE TYPE report_target AS ENUM ('car', 'user', 'review', 'post');
CREATE TYPE report_reason AS ENUM (
  'scam_or_fake', 'unsafe_or_damaged', 'misleading_listing',
  'abusive_behaviour', 'inappropriate_content', 'other'
);
CREATE TYPE report_status AS ENUM ('open', 'resolved', 'dismissed');

CREATE TABLE reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type report_target NOT NULL,
  target_id uuid NOT NULL,
  reason report_reason NOT NULL,
  details text NOT NULL,
  status report_status NOT NULL DEFAULT 'open',
  resolution_note text,
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One person can have only one open report about the same thing.
CREATE UNIQUE INDEX reports_one_open_per_reporter
  ON reports (reporter_id, target_type, target_id)
  WHERE status = 'open';

CREATE INDEX reports_queue_idx ON reports (status, created_at);

-- File: backend/migrations/006_trust_and_content.sql
-- END OF FILE