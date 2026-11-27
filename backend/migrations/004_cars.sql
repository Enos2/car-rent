-- Project: Via Nostra
-- File: backend/migrations/004_cars.sql
-- Purpose: Creates the car tables: the cars themselves, their documents (logbook,
--          registration, insurance), photos (listing and inspection) and the hub
--          inspection records.

CREATE TYPE car_status AS ENUM (
  'draft', 'submitted', 'rejected', 'awaiting_dropoff',
  'live', 'paused', 'suspended', 'retired'
);
CREATE TYPE car_transmission AS ENUM ('manual', 'automatic');
CREATE TYPE car_fuel_type AS ENUM ('petrol', 'diesel', 'hybrid', 'electric');
CREATE TYPE car_doc_type AS ENUM ('logbook', 'registration', 'insurance');
CREATE TYPE car_photo_kind AS ENUM ('listing', 'inspection');
CREATE TYPE inspection_result AS ENUM ('passed', 'failed');

CREATE TABLE cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  hub_id uuid REFERENCES hubs(id) ON DELETE RESTRICT,
  status car_status NOT NULL DEFAULT 'draft',
  make text NOT NULL,
  model text NOT NULL,
  year smallint NOT NULL CHECK (year BETWEEN 1990 AND 2100),
  plate_number text NOT NULL,
  vin text,
  color text,
  seats smallint NOT NULL CHECK (seats BETWEEN 1 AND 20),
  transmission car_transmission NOT NULL,
  fuel_type car_fuel_type NOT NULL,
  description text,
  currency char(3) NOT NULL CHECK (currency = upper(currency)),
  daily_price_minor integer NOT NULL CHECK (daily_price_minor > 0),
  deposit_minor integer NOT NULL DEFAULT 0 CHECK (deposit_minor >= 0),
  min_rental_days smallint NOT NULL DEFAULT 1 CHECK (min_rental_days >= 1),
  max_rental_days smallint NOT NULL DEFAULT 30,
  rejection_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  live_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cars_rental_days_valid CHECK (max_rental_days >= min_rental_days),
  CONSTRAINT cars_hub_required CHECK (
    status NOT IN ('submitted', 'awaiting_dropoff', 'live') OR hub_id IS NOT NULL
  )
);

-- The same plate number (ignoring spaces and dashes) or VIN cannot be listed twice.
CREATE UNIQUE INDEX cars_plate_unique
  ON cars (upper(regexp_replace(plate_number, '[^A-Za-z0-9]', '', 'g')))
  WHERE status <> 'retired';
CREATE UNIQUE INDEX cars_vin_unique
  ON cars (upper(vin))
  WHERE vin IS NOT NULL AND status <> 'retired';
CREATE INDEX cars_owner_idx ON cars (owner_id);
CREATE INDEX cars_status_idx ON cars (status, hub_id, live_at DESC);

CREATE TABLE car_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  doc_type car_doc_type NOT NULL,
  storage_key text NOT NULL UNIQUE,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  expires_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (car_id, doc_type)
);

CREATE TABLE car_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  hub_id uuid NOT NULL REFERENCES hubs(id) ON DELETE RESTRICT,
  inspector_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  result inspection_result NOT NULL,
  odometer_km integer NOT NULL CHECK (odometer_km >= 0),
  fuel_level_percent smallint NOT NULL CHECK (fuel_level_percent BETWEEN 0 AND 100),
  condition_notes text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX car_inspections_car_idx ON car_inspections (car_id, created_at DESC);

CREATE TABLE car_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  kind car_photo_kind NOT NULL DEFAULT 'listing',
  inspection_id uuid REFERENCES car_inspections(id) ON DELETE SET NULL,
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  position smallint NOT NULL DEFAULT 0,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX car_photos_car_idx ON car_photos (car_id, kind, position);

-- File: backend/migrations/004_cars.sql
-- END OF FILE