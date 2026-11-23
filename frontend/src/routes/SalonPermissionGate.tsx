import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tenantApi } from '@/api/tenant.api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  firstAllowedSalonPath,
  resolveRouteAccess,
} from '@/lib/salon-access';

/**
 * Blocks deep-links to pages outside the user's role permissions.
 * Salon Admin / plans without Role Management stay unrestricted (plan features still apply).
 */
export default function SalonPermissionGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: features = [], isLoading } = useQuery({
    queryKey: ['tenant-features'],
    queryFn: tenantApi.features,
  });

  if (isLoading || !user) {
    return <>{children}</>;
  }

  const roles = user.roles ?? [];
  const permissions = user.permissions ?? [];
  const access = resolveRouteAccess(location.pathname, features, roles, permissions);

  if (access === 'allowed') {
    return <>{children}</>;
  }

  if (access === 'hidden') {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <div className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h1 className="text-lg font-bold text-amber-950">Upgrade Plan</h1>
          <p className="mt-2 text-sm text-amber-900">
            This feature is not included in your current subscription. View available plans to enable it.
          </p>
          <Button className="mt-5" onClick={() => navigate('/salon/subscription')}>
            View plans
          </Button>
        </div>
      </div>
    );
  }

  const fallback = firstAllowedSalonPath(features, roles, permissions);
  if (fallback === location.pathname) {
    return <>{children}</>;
  }

  return <Navigate to={fallback} replace />;
}
