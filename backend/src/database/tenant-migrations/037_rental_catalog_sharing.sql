-- Tenant Schema Rental Management Module Migration — Rental Catalog Sharing
-- Version: 037
-- Description: Register RENTAL_CATALOG_SHARE permission and grant to salon roles

INSERT INTO permissions (code, name) VALUES
  ('RENTAL_CATALOG_SHARE', 'Generate, Share and Revoke Public Rental Catalogs via WhatsApp')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to SALON_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SALON_ADMIN'
  AND p.code IN ('RENTAL_CATALOG_SHARE')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant permissions to STOCK_KEEPER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'STOCK_KEEPER'
  AND p.code IN ('RENTAL_CATALOG_SHARE')
ON CONFLICT (role_id, permission_id) DO NOTHING;

