-- Tenant Schema Rental Management Module Migration — Phase 2: Rental Bookings
-- Version: 032
-- Description: Create rental_booking_status enum, rental_bookings and rental_booking_items tables, sequences, indexes, triggers, and permissions

-- 1. Create Booking Status Enum
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'rental_booking_status' AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE rental_booking_status AS ENUM (
      'RESERVED',
      'PICKED_UP',
      'PARTIALLY_RETURNED',
      'RETURNED',
      'CANCELLED'
    );
  END IF;
END $$;

-- 2. Sequence for auto-generating sequential booking reference numbers (RENT-BK-0001)
CREATE SEQUENCE IF NOT EXISTS rental_booking_code_seq START WITH 1;

-- 3. Rental Bookings Table
CREATE TABLE IF NOT EXISTS rental_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  booking_reference VARCHAR(50) NOT NULL,
  pickup_date DATE NOT NULL,
  return_date DATE NOT NULL,
  status rental_booking_status NOT NULL DEFAULT 'RESERVED',
  total_rent DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_deposit DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  cancelled_at TIMESTAMP,
  cancelled_by UUID,
  cancellation_reason TEXT,
  created_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT rental_bookings_reference_unique UNIQUE (booking_reference),
  CONSTRAINT rental_bookings_branch_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT rental_bookings_customer_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT rental_bookings_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT rental_bookings_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT rental_bookings_dates_check CHECK (return_date >= pickup_date),
  CONSTRAINT rental_bookings_total_rent_positive CHECK (total_rent >= 0),
  CONSTRAINT rental_bookings_total_deposit_positive CHECK (total_deposit >= 0)
);

CREATE INDEX IF NOT EXISTS rental_bookings_branch_id_idx ON rental_bookings(branch_id);
CREATE INDEX IF NOT EXISTS rental_bookings_customer_id_idx ON rental_bookings(customer_id);
CREATE INDEX IF NOT EXISTS rental_bookings_status_idx ON rental_bookings(status);
CREATE INDEX IF NOT EXISTS rental_bookings_pickup_date_idx ON rental_bookings(pickup_date);
CREATE INDEX IF NOT EXISTS rental_bookings_return_date_idx ON rental_bookings(return_date);
CREATE INDEX IF NOT EXISTS rental_bookings_reference_idx ON rental_bookings(booking_reference);
CREATE INDEX IF NOT EXISTS rental_bookings_created_at_idx ON rental_bookings(created_at);

-- 4. Rental Booking Items (Specific physical units reserved in this booking with price snapshots)
CREATE TABLE IF NOT EXISTS rental_booking_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  rental_item_id UUID NOT NULL,
  rental_unit_id UUID NOT NULL,
  rent_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  deposit DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT rental_booking_items_booking_unit_unique UNIQUE (booking_id, rental_unit_id),
  CONSTRAINT rental_booking_items_booking_fkey FOREIGN KEY (booking_id) REFERENCES rental_bookings(id) ON DELETE CASCADE,
  CONSTRAINT rental_booking_items_item_fkey FOREIGN KEY (rental_item_id) REFERENCES rental_items(id) ON DELETE RESTRICT,
  CONSTRAINT rental_booking_items_unit_fkey FOREIGN KEY (rental_unit_id) REFERENCES rental_units(id) ON DELETE RESTRICT,
  CONSTRAINT rental_booking_items_rent_price_positive CHECK (rent_price >= 0),
  CONSTRAINT rental_booking_items_deposit_positive CHECK (deposit >= 0)
);

CREATE INDEX IF NOT EXISTS rental_booking_items_booking_id_idx ON rental_booking_items(booking_id);
CREATE INDEX IF NOT EXISTS rental_booking_items_item_id_idx ON rental_booking_items(rental_item_id);
CREATE INDEX IF NOT EXISTS rental_booking_items_unit_id_idx ON rental_booking_items(rental_unit_id);

-- 5. Updated At Triggers
DROP TRIGGER IF EXISTS rental_bookings_updated_at ON rental_bookings;
CREATE TRIGGER rental_bookings_updated_at BEFORE UPDATE ON rental_bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS rental_booking_items_updated_at ON rental_booking_items;
CREATE TRIGGER rental_booking_items_updated_at BEFORE UPDATE ON rental_booking_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Insert permissions idempotently
INSERT INTO permissions (code, name) VALUES
  ('RENTAL_BOOKING_VIEW', 'View Rental Bookings'),
  ('RENTAL_BOOKING_CREATE', 'Create Rental Bookings'),
  ('RENTAL_BOOKING_CANCEL', 'Cancel Rental Bookings')
ON CONFLICT (code) DO NOTHING;

-- 7. Grant permissions to SALON_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SALON_ADMIN'
  AND p.code IN ('RENTAL_BOOKING_VIEW', 'RENTAL_BOOKING_CREATE', 'RENTAL_BOOKING_CANCEL')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 8. Grant permissions to CASHIER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'CASHIER'
  AND p.code IN ('RENTAL_BOOKING_VIEW', 'RENTAL_BOOKING_CREATE', 'RENTAL_BOOKING_CANCEL')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 9. Grant permissions to STOCK_KEEPER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'STOCK_KEEPER'
  AND p.code IN ('RENTAL_BOOKING_VIEW')
ON CONFLICT (role_id, permission_id) DO NOTHING;

