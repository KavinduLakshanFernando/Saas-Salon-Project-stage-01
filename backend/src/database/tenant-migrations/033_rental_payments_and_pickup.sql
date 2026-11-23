-- Tenant Schema Rental Management Module Migration — Phase 3: Rental Payments and Pickup / Handover
-- Version: 033
-- Description: Create rental_payments, rental_payment_allocations, sequences, alter rental_bookings and rental_booking_items, indexes, and permissions

-- 1. Ensure payment_method enum exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'payment_method' AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE payment_method AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'OTHER');
  END IF;
END $$;

-- 2. Sequence for auto-generating sequential payment reference codes (RPAY-0001)
CREATE SEQUENCE IF NOT EXISTS rental_payment_code_seq START WITH 1;

-- 3. Rental Payments Table (Transactions)
CREATE TABLE IF NOT EXISTS rental_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  booking_id UUID NOT NULL,
  payment_number VARCHAR(50) NOT NULL,
  idempotency_key VARCHAR(100),
  amount DECIMAL(10, 2) NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'CASH',
  reference_number VARCHAR(100),
  notes TEXT,
  received_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT rental_payments_number_unique UNIQUE (payment_number),
  CONSTRAINT rental_payments_idempotency_unique UNIQUE (idempotency_key),
  CONSTRAINT rental_payments_branch_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT rental_payments_booking_fkey FOREIGN KEY (booking_id) REFERENCES rental_bookings(id) ON DELETE CASCADE,
  CONSTRAINT rental_payments_received_by_fkey FOREIGN KEY (received_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT rental_payments_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS rental_payments_branch_id_idx ON rental_payments(branch_id);
CREATE INDEX IF NOT EXISTS rental_payments_booking_id_idx ON rental_payments(booking_id);
CREATE INDEX IF NOT EXISTS rental_payments_number_idx ON rental_payments(payment_number);
CREATE INDEX IF NOT EXISTS rental_payments_idempotency_key_idx ON rental_payments(idempotency_key);
CREATE INDEX IF NOT EXISTS rental_payments_created_at_idx ON rental_payments(created_at);

-- 4. Rental Payment Allocations Table (Separates Rent revenue from Refundable Security Deposit)
CREATE TABLE IF NOT EXISTS rental_payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL,
  booking_id UUID NOT NULL,
  allocation_type VARCHAR(50) NOT NULL, -- 'RENT', 'SECURITY_DEPOSIT', (Phase 4: 'DAMAGE_CHARGE', 'REFUND')
  amount DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT rental_payment_allocations_payment_fkey FOREIGN KEY (payment_id) REFERENCES rental_payments(id) ON DELETE CASCADE,
  CONSTRAINT rental_payment_allocations_booking_fkey FOREIGN KEY (booking_id) REFERENCES rental_bookings(id) ON DELETE CASCADE,
  CONSTRAINT rental_payment_allocations_amount_positive CHECK (amount > 0),
  CONSTRAINT rental_payment_allocations_type_check CHECK (allocation_type IN ('RENT', 'SECURITY_DEPOSIT', 'DAMAGE_CHARGE', 'REFUND'))
);

CREATE INDEX IF NOT EXISTS rental_payment_allocations_payment_id_idx ON rental_payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS rental_payment_allocations_booking_id_idx ON rental_payment_allocations(booking_id);
CREATE INDEX IF NOT EXISTS rental_payment_allocations_type_idx ON rental_payment_allocations(allocation_type);

-- 5. Extend rental_bookings for Handover / Pickup Management
ALTER TABLE rental_bookings
  ADD COLUMN IF NOT EXISTS actual_pickup_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS picked_up_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS pickup_notes TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.conname = 'rental_bookings_picked_up_by_fkey' AND n.nspname = current_schema()
  ) THEN
    ALTER TABLE rental_bookings
      ADD CONSTRAINT rental_bookings_picked_up_by_fkey
      FOREIGN KEY (picked_up_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS rental_bookings_actual_pickup_at_idx ON rental_bookings(actual_pickup_at);

-- 6. Extend rental_booking_items for physical handover tracking
ALTER TABLE rental_booking_items
  ADD COLUMN IF NOT EXISTS handed_over_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS handed_over_by UUID,
  ADD COLUMN IF NOT EXISTS condition_out TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE c.conname = 'rental_booking_items_handed_over_by_fkey' AND n.nspname = current_schema()
  ) THEN
    ALTER TABLE rental_booking_items
      ADD CONSTRAINT rental_booking_items_handed_over_by_fkey
      FOREIGN KEY (handed_over_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7. Trigger for updated_at on rental_payments
DROP TRIGGER IF EXISTS rental_payments_updated_at ON rental_payments;
CREATE TRIGGER rental_payments_updated_at BEFORE UPDATE ON rental_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Granular RBAC Permissions for Payments and Pickup
INSERT INTO permissions (code, name) VALUES
  ('RENTAL_PAYMENT_VIEW', 'View Rental Payments and Receipts'),
  ('RENTAL_PAYMENT_CREATE', 'Collect Rental Payments'),
  ('RENTAL_BOOKING_PICKUP', 'Confirm Rental Pickup and Handover')
ON CONFLICT (code) DO NOTHING;

-- 9. Grant permissions to SALON_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SALON_ADMIN'
  AND p.code IN ('RENTAL_PAYMENT_VIEW', 'RENTAL_PAYMENT_CREATE', 'RENTAL_BOOKING_PICKUP')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 10. Grant permissions to CASHIER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'CASHIER'
  AND p.code IN ('RENTAL_PAYMENT_VIEW', 'RENTAL_PAYMENT_CREATE', 'RENTAL_BOOKING_PICKUP')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 11. Grant permissions to STOCK_KEEPER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'STOCK_KEEPER'
  AND p.code IN ('RENTAL_PAYMENT_VIEW', 'RENTAL_BOOKING_PICKUP')
ON CONFLICT (role_id, permission_id) DO NOTHING;

