-- Tenant Schema Rental Management Module Migration
-- Version: 031
-- Description: Create rental_items and rental_units tables, types, indexes, permissions, and role grants

-- 1. Create Enums
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'rental_item_category' AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE rental_item_category AS ENUM (
      'Saree',
      'Frock',
      'Jewellery',
      'Veil',
      'Crown',
      'Jacket',
      'Accessory',
      'Other'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'rental_item_status' AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE rental_item_status AS ENUM (
      'ACTIVE',
      'INACTIVE'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'rental_unit_status' AND n.nspname = current_schema()
  ) THEN
    CREATE TYPE rental_unit_status AS ENUM (
      'AVAILABLE',
      'RESERVED',
      'RENTED',
      'CLEANING',
      'MAINTENANCE',
      'INACTIVE'
    );
  END IF;
END $$;

-- 2. Sequence for auto-generating sequential item codes (RENT-0001)
CREATE SEQUENCE IF NOT EXISTS rental_item_code_seq START WITH 1;

-- 3. Rental Items Master Table
CREATE TABLE IF NOT EXISTS rental_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category rental_item_category NOT NULL,
  size VARCHAR(50),
  color VARCHAR(50),
  rent_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  deposit DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  status rental_item_status NOT NULL DEFAULT 'ACTIVE',
  notes TEXT,
  image_url VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT rental_items_code_unique UNIQUE (code),
  CONSTRAINT rental_items_branch_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT,
  CONSTRAINT rental_items_rent_price_positive CHECK (rent_price >= 0),
  CONSTRAINT rental_items_deposit_positive CHECK (deposit >= 0)
);

CREATE INDEX IF NOT EXISTS rental_items_branch_id_idx ON rental_items(branch_id);
CREATE INDEX IF NOT EXISTS rental_items_category_idx ON rental_items(category);
CREATE INDEX IF NOT EXISTS rental_items_status_idx ON rental_items(status);
CREATE INDEX IF NOT EXISTS rental_items_code_idx ON rental_items(code);
CREATE INDEX IF NOT EXISTS rental_items_created_at_idx ON rental_items(created_at);

-- 4. Rental Units (Physical trackable items)
CREATE TABLE IF NOT EXISTS rental_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_item_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  unit_number INT NOT NULL,
  unit_code VARCHAR(50) NOT NULL,
  status rental_unit_status NOT NULL DEFAULT 'AVAILABLE',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT rental_units_code_unique UNIQUE (unit_code),
  CONSTRAINT rental_units_item_unit_number_unique UNIQUE (rental_item_id, unit_number),
  CONSTRAINT rental_units_rental_item_fkey FOREIGN KEY (rental_item_id) REFERENCES rental_items(id) ON DELETE CASCADE,
  CONSTRAINT rental_units_branch_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS rental_units_rental_item_id_idx ON rental_units(rental_item_id);
CREATE INDEX IF NOT EXISTS rental_units_branch_id_idx ON rental_units(branch_id);
CREATE INDEX IF NOT EXISTS rental_units_status_idx ON rental_units(status);
CREATE INDEX IF NOT EXISTS rental_units_unit_code_idx ON rental_units(unit_code);

-- 5. Updated At Triggers
DROP TRIGGER IF EXISTS rental_items_updated_at ON rental_items;
CREATE TRIGGER rental_items_updated_at BEFORE UPDATE ON rental_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS rental_units_updated_at ON rental_units;
CREATE TRIGGER rental_units_updated_at BEFORE UPDATE ON rental_units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Insert permissions idempotently
INSERT INTO permissions (code, name) VALUES
  ('RENTAL_VIEW', 'View Rental Items'),
  ('RENTAL_CREATE', 'Create Rental Items'),
  ('RENTAL_UPDATE', 'Update Rental Items'),
  ('RENTAL_DELETE', 'Deactivate / Delete Rental Items')
ON CONFLICT (code) DO NOTHING;

-- 7. Grant permissions to SALON_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SALON_ADMIN'
  AND p.code IN ('RENTAL_VIEW', 'RENTAL_CREATE', 'RENTAL_UPDATE', 'RENTAL_DELETE')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 8. Grant permissions to STOCK_KEEPER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'STOCK_KEEPER'
  AND p.code IN ('RENTAL_VIEW', 'RENTAL_CREATE', 'RENTAL_UPDATE')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 9. Grant permissions to CASHIER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'CASHIER'
  AND p.code IN ('RENTAL_VIEW')
ON CONFLICT (role_id, permission_id) DO NOTHING;
