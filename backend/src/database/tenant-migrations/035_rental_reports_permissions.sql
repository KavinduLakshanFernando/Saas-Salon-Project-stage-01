-- Tenant Schema Rental Management Module Migration — Phase 5: Rental Reports & Analytics Permissions
-- Version: 035
-- Description: Register RENTAL_REPORT_VIEW permission and grant to salon roles

INSERT INTO permissions (code, name) VALUES
  ('RENTAL_REPORT_VIEW', 'View Rental Dashboard, Operational Analytics & Financial Reports')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to SALON_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SALON_ADMIN'
  AND p.code IN ('RENTAL_REPORT_VIEW')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant permissions to CASHIER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'CASHIER'
  AND p.code IN ('RENTAL_REPORT_VIEW')
ON CONFLICT (role_id, permission_id) DO NOTHING;

