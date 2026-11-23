-- Tenant Schema Rental Management Module Migration — Phase 4: Rental Returns, Inspection & Deposit Settlement
-- Version: 034
-- Description: Create rental_returns, rental_return_items, rental_deposit_settlements, rental_refunds, sequences, alter rental_bookings/items, indexes, and permissions

-- 1. Sequences for auto-generating sequential reference codes
CREATE SEQUENCE IF NOT EXISTS rental_return_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS rental_settlement_code_seq START WITH 1;
CREATE SEQUENCE IF NOT EXISTS rental_refund_code_seq START WITH 1;

-- 2. Rental Returns Table (Header for return transactions; multiple returns per booking supported)
CREATE TABLE IF NOT EXISTS rental_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  booking_id UUID NOT NULL,
  return_number VARCHAR(50) NOT NULL,
  actual_return_at TIMESTAMP NOT NULL DEFAULT NOW(),
  returned_to_user_id UUID,
  return_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT rental_returns_number_unique UNIQUE (return_number),
  CONSTRAINT rental_returns_branch_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT rental_returns_booking_fkey FOREIGN KEY (booking_id) REFERENCES rental_bookings(id) ON DELETE CASCADE,
  CONSTRAINT rental_returns_user_fkey FOREIGN KEY (returned_to_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS rental_returns_branch_id_idx ON rental_returns(branch_id);
CREATE INDEX IF NOT EXISTS rental_returns_booking_id_idx ON rental_returns(booking_id);
CREATE INDEX IF NOT EXISTS rental_returns_number_idx ON rental_returns(return_number);
CREATE INDEX IF NOT EXISTS rental_returns_actual_return_at_idx ON rental_returns(actual_return_at);

-- 3. Rental Return Items Table (Tracks individual returned physical units, condition, and charges)
CREATE TABLE IF NOT EXISTS rental_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL,
  booking_item_id UUID NOT NULL,
  rental_unit_id UUID NOT NULL,
  condition_in VARCHAR(50) NOT NULL DEFAULT 'GOOD',
  inspection_notes TEXT,
  late_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  damage_charge DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  requires_maintenance BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT rental_return_items_return_fkey FOREIGN KEY (return_id) REFERENCES rental_returns(id) ON DELETE CASCADE,
  CONSTRAINT rental_return_items_booking_item_fkey FOREIGN KEY (booking_item_id) REFERENCES rental_booking_items(id) ON DELETE RESTRICT,
  CONSTRAINT rental_return_items_unit_fkey FOREIGN KEY (rental_unit_id) REFERENCES rental_units(id) ON DELETE RESTRICT,
  CONSTRAINT rental_return_items_booking_item_unique UNIQUE (booking_item_id),
  CONSTRAINT rental_return_items_late_fee_non_negative CHECK (late_fee >= 0),
  CONSTRAINT rental_return_items_damage_charge_non_negative CHECK (damage_charge >= 0),
  CONSTRAINT rental_return_items_condition_check CHECK (condition_in IN ('GOOD', 'MINOR_DAMAGE', 'DAMAGED', 'REQUIRES_REPAIR'))
);

CREATE INDEX IF NOT EXISTS rental_return_items_return_id_idx ON rental_return_items(return_id);
CREATE INDEX IF NOT EXISTS rental_return_items_booking_item_id_idx ON rental_return_items(booking_item_id);
CREATE INDEX IF NOT EXISTS rental_return_items_unit_id_idx ON rental_return_items(rental_unit_id);

-- 4. Rental Deposit Settlements Table (Final financial settlement of deposits vs fees/charges)
CREATE TABLE IF NOT EXISTS rental_deposit_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_number VARCHAR(50) NOT NULL,
  branch_id UUID NOT NULL,
  booking_id UUID NOT NULL,
  deposit_collected DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_late_fees DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  total_damage_charges DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  deposit_deducted DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  deposit_refunded DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  additional_amount_due DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  settlement_status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
  settled_by_user_id UUID,
  settled_at TIMESTAMP NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT rental_settlements_number_unique UNIQUE (settlement_number),
  CONSTRAINT rental_settlements_branch_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT rental_settlements_booking_fkey FOREIGN KEY (booking_id) REFERENCES rental_bookings(id) ON DELETE CASCADE,
  CONSTRAINT rental_settlements_user_fkey FOREIGN KEY (settled_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS rental_settlements_booking_id_idx ON rental_deposit_settlements(booking_id);
CREATE INDEX IF NOT EXISTS rental_settlements_branch_id_idx ON rental_deposit_settlements(branch_id);
CREATE INDEX IF NOT EXISTS rental_settlements_number_idx ON rental_deposit_settlements(settlement_number);

-- 5. Rental Refunds Table (Explicit outgoing refund transaction history)
CREATE TABLE IF NOT EXISTS rental_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number VARCHAR(50) NOT NULL,
  booking_id UUID NOT NULL,
  settlement_id UUID,
  branch_id UUID NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'CASH',
  refund_status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
  refunded_by_user_id UUID,
  refunded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  notes TEXT,
  idempotency_key VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT rental_refunds_number_unique UNIQUE (refund_number),
  CONSTRAINT rental_refunds_idempotency_unique UNIQUE (idempotency_key),
  CONSTRAINT rental_refunds_booking_fkey FOREIGN KEY (booking_id) REFERENCES rental_bookings(id) ON DELETE CASCADE,
  CONSTRAINT rental_refunds_settlement_fkey FOREIGN KEY (settlement_id) REFERENCES rental_deposit_settlements(id) ON DELETE SET NULL,
  CONSTRAINT rental_refunds_branch_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT rental_refunds_user_fkey FOREIGN KEY (refunded_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT rental_refunds_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS rental_refunds_booking_id_idx ON rental_refunds(booking_id);
CREATE INDEX IF NOT EXISTS rental_refunds_settlement_id_idx ON rental_refunds(settlement_id);
CREATE INDEX IF NOT EXISTS rental_refunds_branch_id_idx ON rental_refunds(branch_id);
CREATE INDEX IF NOT EXISTS rental_refunds_number_idx ON rental_refunds(refund_number);

-- 6. Extend rental_bookings for Settlement Status & Accrued Charges
ALTER TABLE rental_bookings
  ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(50) NOT NULL DEFAULT 'UNSETTLED',
  ADD COLUMN IF NOT EXISTS total_late_fees DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS total_damage_charges DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

CREATE INDEX IF NOT EXISTS rental_bookings_settlement_status_idx ON rental_bookings(settlement_status);

-- 7. Extend rental_booking_items for individual return lifecycle
ALTER TABLE rental_booking_items
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS condition_in VARCHAR(50),
  ADD COLUMN IF NOT EXISTS return_status VARCHAR(50) NOT NULL DEFAULT 'PENDING';

CREATE INDEX IF NOT EXISTS rental_booking_items_return_status_idx ON rental_booking_items(return_status);

-- 8. Triggers for updated_at
DROP TRIGGER IF EXISTS rental_returns_updated_at ON rental_returns;
CREATE TRIGGER rental_returns_updated_at BEFORE UPDATE ON rental_returns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS rental_deposit_settlements_updated_at ON rental_deposit_settlements;
CREATE TRIGGER rental_deposit_settlements_updated_at BEFORE UPDATE ON rental_deposit_settlements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS rental_refunds_updated_at ON rental_refunds;
CREATE TRIGGER rental_refunds_updated_at BEFORE UPDATE ON rental_refunds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Granular RBAC Permissions for Returns, Settlement, Refunds & Unit Clearance
INSERT INTO permissions (code, name) VALUES
  ('RENTAL_RETURN_VIEW', 'View Rental Returns and Settlement Details'),
  ('RENTAL_RETURN_CREATE', 'Process Rental Returns and Inspect Condition'),
  ('RENTAL_RETURN_SETTLE', 'Settle Rental Security Deposits and Fees'),
  ('RENTAL_DEPOSIT_REFUND', 'Process Security Deposit Refunds'),
  ('RENTAL_UNIT_CLEARANCE', 'Update Rental Unit Clearance Status (Cleaning/Maintenance)')
ON CONFLICT (code) DO NOTHING;

-- 10. Grant permissions to SALON_ADMIN (Full return management, fees, settlement, refund, clearance)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SALON_ADMIN'
  AND p.code IN (
    'RENTAL_RETURN_VIEW',
    'RENTAL_RETURN_CREATE',
    'RENTAL_RETURN_SETTLE',
    'RENTAL_DEPOSIT_REFUND',
    'RENTAL_UNIT_CLEARANCE'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 11. Grant permissions to CASHIER (View returns, settle deposits, process refunds)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'CASHIER'
  AND p.code IN (
    'RENTAL_RETURN_VIEW',
    'RENTAL_RETURN_SETTLE',
    'RENTAL_DEPOSIT_REFUND'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 12. Grant permissions to STOCK_KEEPER (View returns, inspect/process returns, unit clearance)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'STOCK_KEEPER'
  AND p.code IN (
    'RENTAL_RETURN_VIEW',
    'RENTAL_RETURN_CREATE',
    'RENTAL_UNIT_CLEARANCE'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

