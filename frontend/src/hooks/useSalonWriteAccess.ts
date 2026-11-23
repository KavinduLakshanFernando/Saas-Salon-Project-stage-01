import { useMemo } from 'react';
import { useTenantSubscription } from '@/features/subscriptions/hooks/useTenantSubscription';

export type TrialPhase = 'info' | 'warning' | 'urgent' | 'expired' | null;

export function useSalonWriteAccess() {
  const { data, isLoading, refetch } = useTenantSubscription();
  const sub = data?.subscription;
  const status = sub?.status;

  return useMemo(() => {
    const isSuspended = status === 'SUSPENDED';
    const isExplicitExpired = status === 'EXPIRED';
    const isCancelled = status === 'CANCELLED';
    const isPaidActive = status === 'ACTIVE';

    const rawTrialEnd = sub?.trialEnd ? new Date(sub.trialEnd) : null;
    const now = Date.now();
    const isTrialTimeExpired = Boolean(rawTrialEnd && rawTrialEnd.getTime() <= now);
    const isTrial = status === 'TRIAL';

    const isTrialExpired = (isTrial && isTrialTimeExpired) || (isSuspended && Boolean(sub?.trialEnd));
    const isExpired = isExplicitExpired || isTrialExpired;

    // Days remaining in trial (0 if past)
    let daysRemaining: number | null = null;
    if (isTrial && rawTrialEnd) {
      const diff = rawTrialEnd.getTime() - now;
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    // Backend authoritative canWrite takes precedence if provided, otherwise client logic
    let canWrite = false;
    if (data?.canWrite !== undefined) {
      canWrite = Boolean(data.canWrite);
    } else {
      canWrite = isPaidActive || (isTrial && !isTrialTimeExpired);
    }

    // Determine Trial Phase according to business rules:
    // - Days 1–13: Informational trial countdown (8+ days left of 21)
    // - Days 14–19: Trial ending soon warning (2–7 days left)
    // - Day 20 onward: Urgent payment reminder (1 or 0 days left while still active)
    // - Expired: Trial has expired
    let trialPhase: TrialPhase = null;
    if (isExpired || isSuspended) {
      trialPhase = 'expired';
    } else if (isTrial && daysRemaining !== null) {
      if (daysRemaining <= 1) {
        trialPhase = 'urgent';
      } else if (daysRemaining <= 7) {
        trialPhase = 'warning';
      } else {
        trialPhase = 'info';
      }
    }

    const formattedTrialEnd = rawTrialEnd
      ? rawTrialEnd.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '';

    const tooltipMessage = !canWrite
      ? isExpired || isSuspended
        ? 'Subscription expired or suspended. Choose a plan to modify salon records.'
        : 'Active subscription required to modify salon records.'
      : undefined;

    return {
      isSuspended,
      isTrial,
      isTrialExpired,
      isExpired,
      isCancelled,
      isPaidActive,
      canWrite,
      status,
      subscription: sub,
      daysRemaining,
      trialPhase,
      formattedTrialEnd,
      tooltipMessage,
      isLoading,
      refetch,
    };
  }, [data, status, sub, isLoading, refetch]);
}
