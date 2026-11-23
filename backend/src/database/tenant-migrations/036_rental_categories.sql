-- Migration 036: Rental Categories Management and Dynamic Categories
-- Create rental_categories table if not exists

CREATE TABLE IF NOT EXISTS rental_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT rental_categories_code_unique UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS rental_categories_code_idx ON rental_categories(code);
CREATE INDEX IF NOT EXISTS rental_categories_name_idx ON rental_categories(name);
CREATE INDEX IF NOT EXISTS rental_categories_is_active_idx ON rental_categories(is_active);

-- Convert rental_items.category from ENUM to VARCHAR(100)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'rental_items'
      AND column_name = 'category'
      AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE rental_items ALTER COLUMN category TYPE VARCHAR(100) USING category::text;
  END IF;
END $$;

-- Seed initial standard categories if table is empty
INSERT INTO rental_categories (code, name, description)
SELECT code, name, description
FROM (VALUES
  ('RCAT-0001', 'Saree', 'Bridal sarees, reception sarees, and traditional wear'),
  ('RCAT-0002', 'Frock', 'Bridal frocks, evening gowns, and party dresses'),
  ('RCAT-0003', 'Jewellery', 'Bridal jewellery sets, necklaces, bangles, and earrings'),
  ('RCAT-0004', 'Veil', 'Bridal veils and hair nets'),
  ('RCAT-0005', 'Crown', 'Tiara, crowns, and hair headpieces'),
  ('RCAT-0006', 'Jacket', 'Bridal jackets, boleros, and formal jackets'),
  ('RCAT-0007', 'Shoes', 'Bridal shoes and evening footwear'),
  ('RCAT-0008', 'Accessories', 'Handbags, clutches, sashes, and floral accessories'),
  ('RCAT-0009', 'Suit', 'Groom suits, tuxedos, and blazers'),
  ('RCAT-0010', 'Other', 'Other specialty rental items')
) AS default_cats(code, name, description)
WHERE NOT EXISTS (SELECT 1 FROM rental_categories);

