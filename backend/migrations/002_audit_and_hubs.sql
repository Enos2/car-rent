-- Project: Via Nostra
-- File: backend/migrations/002_audit_and_hubs.sql
-- Purpose: Creates the audit log (a permanent record of staff actions), the hubs
--          (drop-off and inspection locations) and the link between hubs and staff.

CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id);
CREATE INDEX audit_log_actor_idx ON audit_log (actor_id, created_at DESC);

CREATE TABLE hubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  country_code char(2) NOT NULL,
  address text NOT NULL,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  opening_hours text,
  contact_phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hubs_country_code_upper CHECK (country_code = upper(country_code)),
  CONSTRAINT hubs_latitude_range CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT hubs_longitude_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE INDEX hubs_city_idx ON hubs (country_code, city);

CREATE TABLE hub_staff (
  hub_id uuid NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hub_id, user_id)
);

-- File: backend/migrations/002_audit_and_hubs.sql
-- END OF FILE
