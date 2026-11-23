import {
  AlertCircle,
  ArrowRight,
  Clock,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSalonWriteAccess } from '@/hooks/useSalonWriteAccess';
import { cn } from '@/lib/utils';

/**
 * Top header pill integrated directly into SalonAdminHeader
 * Matches the official Purple & White design system (#7C3AED & #FFFFFF)
 */
export function HeaderSubscriptionPill() {
  const navigate = useNavigate();
  const {
    isSuspended,
    isTrial,
    isExpired,
    isPaidActive,
    subscription,
    daysRemaining,
    trialPhase,
    formattedTrialEnd,
  } = useSalonWriteAccess();

  if (isSuspended || isExpired) {
    return (
      <div className="flex items-center">
        {/* Desktop / Tablet: Sleek multi-element pill matching the Free Trial pill design */}
        <button
          type="button"
          onClick={() => navigate('/salon/subscription')}
          className="group hidden sm:inline-flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50/95 hover:bg-rose-100 hover:border-rose-400 px-3 py-1 text-xs shadow-xs transition-all cursor-pointer"
          title={isExpired ? 'Trial Expired — Click to choose a plan' : 'Subscription Suspended — Click to renew'}
        >
          {/* Solid Red Badge with pure white text */}
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold tracking-wider text-white shadow-xs">
            <Lock className="h-2.5 w-2.5 text-white" />
            <span>{isExpired ? 'TRIAL EXPIRED' : 'SUSPENDED'}</span>
          </span>

          {/* High-contrast crisp text */}
          <span className="inline-flex items-center gap-1.5 font-bold text-xs text-rose-950">
            <span className="flex h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
            <span>Read-Only Mode</span>
          </span>

          <span className="hidden md:inline text-rose-300">•</span>

          {/* Solid action button with pure white text */}
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 group-hover:bg-rose-700 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs transition-all">
            <span>Pay Now</span>
            <ArrowRight className="h-3 w-3 text-white transition-transform group-hover:translate-x-0.5" />
          </span>
        </button>

        {/* Mobile: Compact high-visibility badge */}
        <button
          type="button"
          onClick={() => navigate('/salon/subscription')}
          className="sm:hidden inline-flex items-center gap-1.5 rounded-full bg-rose-600 hover:bg-rose-700 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs transition-all"
          title="Renew Subscription"
        >
          <Lock className="h-3 w-3 text-white" />
          <span>Expired • Pay Now</span>
          <ArrowRight className="h-3 w-3 text-white" />
        </button>
      </div>
    );
  }

  if (isTrial && subscription) {
    const planName = (subscription.plan || subscription.planCode || 'Standard').toUpperCase();
    const isUrgent = trialPhase === 'urgent';
    const isWarning = trialPhase === 'warning';

    const pillStyle = isUrgent
      ? 'border-rose-300 bg-rose-50 text-rose-950'
      : isWarning
        ? 'border-amber-300 bg-amber-50 text-amber-950'
        : 'border-purple-200 bg-purple-50 text-purple-950';

    const badgeBg = isUrgent ? 'bg-rose-600' : isWarning ? 'bg-amber-600' : 'bg-purple-600';

    return (
      <div className="flex items-center">
        {/* Desktop / Tablet: Full sleek pill */}
        <div
          className={cn(
            'hidden sm:inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs shadow-xs transition-all',
            pillStyle,
          )}
        >
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider text-white shadow-xs',
              badgeBg,
            )}
          >
            <Sparkles className="h-2.5 w-2.5" />
            <span>FREE TRIAL</span>
          </span>

          <span className="inline-flex items-center gap-1 font-semibold text-xs">
            <Clock
              className={cn(
                'h-3 w-3',
                isUrgent ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-purple-600',
              )}
            />
            <span>
              {daysRemaining !== null ? (
                <>
                  <strong>{daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}</strong> left
                </>
              ) : (
                'Active'
              )}
            </span>
          </span>

          {formattedTrialEnd && (
            <span className="hidden xl:inline text-[11px] text-slate-500 font-normal">
              • Ends {formattedTrialEnd}
            </span>
          )}

          <span
            className={cn(
              'hidden md:inline rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide',
              isUrgent ? 'bg-rose-100 text-rose-900' : isWarning ? 'bg-amber-100 text-amber-900' : 'bg-purple-100 text-purple-900',
            )}
          >
            {planName}
          </span>

          <button
            type="button"
            onClick={() => navigate('/salon/subscription')}
            className={cn(
              'group inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white transition-all shadow-xs hover:scale-[1.02] active:scale-[0.98]',
              badgeBg,
            )}
          >
            <span>{isUrgent || isWarning ? 'Upgrade' : 'Plans'}</span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Mobile: Compact badge */}
        <button
          type="button"
          onClick={() => navigate('/salon/subscription')}
          className={cn(
            'sm:hidden inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-xs transition-all',
            pillStyle,
          )}
          title="Manage Subscription"
        >
          <Sparkles className="h-3 w-3 text-purple-600" />
          <span>{daysRemaining !== null ? `${daysRemaining}d left` : 'Trial'}</span>
        </button>
      </div>
    );
  }

  // Active paid plan indicator (hide trial indicators completely)
  if (isPaidActive && subscription) {
    const planName = (subscription.plan || subscription.planCode || '').toUpperCase();
    if (!planName) return null;
    return (
      <div className="hidden lg:flex items-center">
        <button
          type="button"
          onClick={() => navigate('/salon/subscription')}
          className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50/80 hover:bg-purple-100 px-2.5 py-1 text-[11px] font-medium text-purple-700 transition-all shadow-xs"
          title="View Subscription"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="font-semibold">{planName}</span>
        </button>
      </div>
    );
  }

  return null;
}

/**
 * Phase 1 — Complete 21-Day Trial Countdown Banner
 * Renders dynamically below header across dashboard and salon pages:
 * 1. Days 1–13: Informational trial countdown with "View Plans" CTA.
 * 2. Days 14–19: Trial ending soon warning with "Upgrade Now" CTA.
 * 3. Day 20 onward: Urgent payment reminder while active with "Upgrade Now" CTA.
 * 4. Expired trial: Subscription expired message with "Choose Plan & Pay Now" CTA.
 * 5. Hidden when subscription is ACTIVE (paid).
 */
export function SubscriptionBanner() {
  const navigate = useNavigate();
  const {
    isSuspended,
    isTrial,
    isExpired,
    isPaidActive,
    subscription,
    daysRemaining,
    trialPhase,
    formattedTrialEnd,
  } = useSalonWriteAccess();

  // Minute-by-minute timer so countdown automatically updates without reload
  const [, setClock] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setClock((prev) => prev + 1);
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Requirement 7: Hide the trial banner after the subscription is successfully activated
  if (isPaidActive) {
    return null;
  }

  // State 4: Expired trial / Suspended (Read-only mode warning)
  if (isSuspended || isExpired || (isTrial && daysRemaining === 0)) {
    return (
      <div
        role="alert"
        className="relative z-10 w-full border-b border-rose-300 bg-gradient-to-r from-rose-100 via-red-50 to-rose-100 px-4 py-2.5 text-rose-950 shadow-sm"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-0.5 text-xs font-bold text-white shadow-xs">
              <Lock className="h-3 w-3" />
              <span>{isExpired ? 'TRIAL EXPIRED' : 'SUBSCRIPTION SUSPENDED'}</span>
            </span>
            <span className="text-xs sm:text-sm font-medium text-rose-950 leading-snug">
              Your 21-day free trial {formattedTrialEnd ? `expired on ${formattedTrialEnd}` : 'has ended'}. Your salon data is preserved in <strong className="font-bold text-rose-950">read-only mode</strong>.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <Button
              type="button"
              size="sm"
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs text-xs h-8 px-4 transition-all w-full sm:w-auto justify-center"
              onClick={() => navigate('/salon/subscription')}
            >
              <span>Choose Plan & Pay Now</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Active Trial Subscriptions
  if (isTrial && subscription) {
    // State 3: Day 20 onward (1 day or <24h remaining) — Urgent payment reminder
    if (trialPhase === 'urgent' || (daysRemaining !== null && daysRemaining <= 1)) {
      const isLastDay = daysRemaining === 0 || daysRemaining === 1;
      return (
        <div
          role="alert"
          className="relative z-10 w-full border-b border-rose-300 bg-gradient-to-r from-rose-50 via-red-50/70 to-rose-50 px-4 py-2.5 text-rose-950 shadow-sm"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                <AlertCircle className="h-3 w-3" />
                <span>URGENT REMINDER</span>
              </span>
              <span className="text-xs sm:text-sm font-medium text-rose-950 leading-snug">
                Your free trial ends <strong className="font-bold underline decoration-rose-400">{isLastDay ? (daysRemaining === 1 ? 'tomorrow' : 'today') : `${daysRemaining} days`}</strong>
                {formattedTrialEnd ? ` (${formattedTrialEnd})` : ''}. Upgrade now to prevent account suspension.
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              <Button
                type="button"
                size="sm"
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold shadow-xs text-xs h-8 px-4 transition-all w-full sm:w-auto justify-center"
                onClick={() => navigate('/salon/subscription')}
              >
                <span>Upgrade Now</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // State 2: Days 14–19 (2 to 7 days remaining) — Trial ending soon warning
    if (trialPhase === 'warning' || (daysRemaining !== null && daysRemaining <= 7)) {
      return (
        <div
          role="status"
          className="relative z-10 w-full border-b border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-50 px-4 py-2.5 text-amber-950 shadow-sm"
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
                <Clock className="h-3 w-3" />
                <span>TRIAL ENDING SOON</span>
              </span>
              <span className="text-xs sm:text-sm font-medium text-amber-950 leading-snug">
                <strong className="font-bold text-amber-950">{daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} remaining</strong> in your 21-day trial
                {formattedTrialEnd ? ` (expires on ${formattedTrialEnd})` : ''}. Choose a plan to maintain uninterrupted access.
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              <Button
                type="button"
                size="sm"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-xs text-xs h-8 px-4 transition-all w-full sm:w-auto justify-center"
                onClick={() => navigate('/salon/subscription')}
              >
                <span>Upgrade Now</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // State 1: Days 1–13 (8+ days remaining) — Informational trial countdown
    return (
      <div
        role="status"
        className="relative z-10 w-full border-b border-purple-200 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-purple-50 px-4 py-2.5 text-purple-950 shadow-xs"
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
              <Sparkles className="h-3 w-3" />
              <span>21-DAY FREE TRIAL</span>
            </span>
            <span className="text-xs sm:text-sm font-medium text-purple-950 leading-snug">
              You have <strong className="font-bold text-purple-950">{daysRemaining} days left</strong> in your free trial. All features unlocked until <strong className="font-semibold text-purple-950">{formattedTrialEnd || 'expiration'}</strong>.
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="inline-flex items-center gap-1.5 rounded-lg border-purple-300 bg-white hover:bg-purple-50 text-purple-700 font-semibold shadow-xs text-xs h-8 px-3.5 transition-all w-full sm:w-auto justify-center"
              onClick={() => navigate('/salon/subscription')}
            >
              <span>View Plans</span>
              <ArrowRight className="h-3.5 w-3.5 text-purple-600" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
