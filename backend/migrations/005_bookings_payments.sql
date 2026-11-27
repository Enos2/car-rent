-- Project: Via Nostra
-- File: backend/migrations/005_bookings_payments.sql
-- Purpose: Creates the booking and money tables: bookings, payment records, payouts
--          to owners, and the ledger (a permanent, balanced record of every movement
--          of money). Ledger rows can never be changed or deleted.
-- Ledger rule: debit-positive. Cash is positive; what the platform owes to people
--          and its own income are negative. Every transaction adds up to zero.

CREATE TYPE booking_status AS ENUM (
  'pending_payment', 'confirmed', 'handed_over', 'in_progress',
  'completed', 'cancelled', 'expired'
);
CREATE TYPE ledger_account AS ENUM (
  'platform_cash', 'booking_escrow', 'deposit_held',
  'owner_payable', 'payout_pending', 'platform_revenue'
);
CREATE TYPE payout_status AS ENUM ('requested', 'paid', 'rejected');
CREATE TYPE payment_kind AS ENUM ('charge', 'refund');

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES cars(id) ON DELETE RESTRICT,
  renter_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  hub_id uuid NOT NULL REFERENCES hubs(id) ON DELETE RESTRICT,
  status booking_status NOT NULL DEFAULT 'pending_payment',
  start_date date NOT NULL,
  end_date date NOT NULL,
  days smallint NOT NULL CHECK (days >= 1),
  currency char(3) NOT NULL,
  daily_price_minor integer NOT NULL CHECK (daily_price_minor > 0),
  subtotal_minor integer NOT NULL CHECK (subtotal_minor > 0),
  deposit_minor integer NOT NULL CHECK (deposit_minor >= 0),
  commission_bps smallint NOT NULL CHECK (commission_bps BETWEEN 0 AND 10000),
  commission_minor integer NOT NULL CHECK (commission_minor >= 0),
  owner_share_minor integer NOT NULL CHECK (owner_share_minor >= 0),
  expires_at timestamptz,
  paid_at timestamptz,
  handed_over_at timestamptz,
  receipt_confirmed_at timestamptz,
  returned_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES users(id) ON DELETE SET NULL,
  cancellation_reason text,
  refund_minor integer,
  deposit_deduction_minor integer NOT NULL DEFAULT 0 CHECK (deposit_deduction_minor >= 0),
  deduction_reason text,
  handover_odometer_km integer,
  handover_fuel_percent smallint,
  handover_notes text,
  handover_by uuid REFERENCES users(id) ON DELETE SET NULL,
  return_odometer_km integer,
  return_fuel_percent smallint,
  return_notes text,
  return_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_dates_valid CHECK (end_date > start_date),
  CONSTRAINT bookings_days_match CHECK (days = end_date - start_date),
  CONSTRAINT bookings_amounts_valid CHECK (commission_minor + owner_share_minor = subtotal_minor),
  CONSTRAINT bookings_not_self CHECK (renter_id <> owner_id)
);

CREATE INDEX bookings_car_dates_idx ON bookings (car_id, start_date, end_date);
CREATE INDEX bookings_renter_idx ON bookings (renter_id, created_at DESC);
CREATE INDEX bookings_owner_idx ON bookings (owner_id, created_at DESC);
CREATE INDEX bookings_status_idx ON bookings (status, hub_id, start_date);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  kind payment_kind NOT NULL,
  provider text NOT NULL,
  provider_reference text NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency char(3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payments_booking_idx ON payments (booking_id);

CREATE TABLE payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency char(3) NOT NULL,
  status payout_status NOT NULL DEFAULT 'requested',
  destination text NOT NULL,
  provider_reference text,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payouts_owner_idx ON payouts (owner_id, created_at DESC);
CREATE INDEX payouts_status_idx ON payouts (status, created_at);

CREATE TABLE ledger_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE RESTRICT,
  payout_id uuid REFERENCES payouts(id) ON DELETE RESTRICT,
  currency char(3) NOT NULL,
  note text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ledger_transactions_booking_idx ON ledger_transactions (booking_id);

CREATE TABLE ledger_entries (
  id bigserial PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  account ledger_account NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  currency char(3) NOT NULL,
  amount_minor integer NOT NULL CHECK (amount_minor <> 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ledger_entries_tx_idx ON ledger_entries (transaction_id);
CREATE INDEX ledger_entries_user_idx ON ledger_entries (user_id, account, currency);

-- Every ledger transaction must add up to zero when it is saved.
CREATE FUNCTION ledger_transaction_is_balanced() RETURNS trigger AS $$
BEGIN
  IF (SELECT COALESCE(SUM(amount_minor), 0) FROM ledger_entries
      WHERE transaction_id = NEW.transaction_id) <> 0 THEN
    RAISE EXCEPTION 'Ledger transaction % does not balance', NEW.transaction_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_entries_balanced
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_transaction_is_balanced();

-- Ledger entries can never be changed or deleted.
CREATE FUNCTION ledger_entries_are_permanent() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries cannot be changed or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_no_change
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_are_permanent();

-- File: backend/migrations/005_bookings_payments.sql
-- END OF FILE