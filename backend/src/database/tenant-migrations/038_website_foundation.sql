-- Tenant Schema Website Foundation Module Migration
-- Version: 038
-- Description: Register WEBSITE_VIEW, WEBSITE_UPDATE, WEBSITE_PUBLISH permissions and grant to SALON_ADMIN

INSERT INTO permissions (code, name) VALUES
  ('WEBSITE_VIEW', 'View Salon Website settings, status and preview'),
  ('WEBSITE_UPDATE', 'Update Salon Website details, branding and SEO'),
  ('WEBSITE_PUBLISH', 'Publish or unpublish the Salon Website')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to SALON_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'SALON_ADMIN'
  AND p.code IN (
    'WEBSITE_VIEW',
    'WEBSITE_UPDATE',
    'WEBSITE_PUBLISH'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

