import { useEffect, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Layers3,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Wallet,
  CreditCard,
  Calendar,
  Zap,
  Info,
  Bell,
  Check,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useAdminPlans } from '@/features/plans/hooks/usePlans';
import { billingCycleLabel, formatPrice } from '@/features/plans/lib/plan-utils';
import type { BillingCycle } from '@/features/plans/types/plan.types';
import { subscriptionsApi } from '@/features/subscriptions/api/subscriptions.api';
import type { PlanChangeQuoteResult } from '@/features/subscriptions/api/tenant-subscriptions.api';
import { formatAmount, formatDate } from '@/features/billing/lib/billing-utils';
import { toast } from 'sonner';

export interface ManageSubscriptionPlanSectionProps {
  tenantId: string;
  salonName: string;
  subscription: {
    id: string;
    planId?: string;
    planCode?: string;
    planName?: string;
    status: string;
    billingCycle?: string;
    price: number | string;
    currency: string;
    startDate?: string | null;
    endDate?: string | null;
    nextBillingDate?: string | null;
    billingCreditBalance?: number | string | null;
    pendingPlanId?: string | null;
    pendingPlan?: {
      id: string;
      code: string;
      name: string;
    } | null;
  } | null;
  onSuccess?: () => void;
}

export function ManageSubscriptionPlanSection({
  tenantId,
  salonName,
  subscription,
  onSuccess,
}: ManageSubscriptionPlanSectionProps) {
  const qc = useQueryClient();
  const { data: plans = [], isLoading: isLoadingPlans } = useAdminPlans();

  const activePlans = useMemo(
    () =>
      plans
        .filter((plan) => plan.status === 'ACTIVE' && plan.code !== 'CUSTOM')
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    [plans],
  );

  const currentPlan = useMemo(
    () => activePlans.find((p) => p.code === subscription?.planCode || p.id === subscription?.planId),
    [activePlans, subscription],
  );

  const currentCycle = ((subscription?.billingCycle as BillingCycle) || 'MONTHLY');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>(currentCycle);

  // Quote state
  const [quote, setQuote] = useState<PlanChangeQuoteResult | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Modal dialog states
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [downgradeDialogOpen, setDowngradeDialogOpen] = useState(false);
  const [verifiedPayment, setVerifiedPayment] = useState(false);
  const [verifiedDowngrade, setVerifiedDowngrade] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancellingDowngrade, setIsCancellingDowngrade] = useState(false);

  // Initialize selected plan to something other than current plan if possible
  useEffect(() => {
    if (activePlans.length === 0) return;
    if (!selectedPlanId) {
      const otherPlan = activePlans.find((p) => p.id !== currentPlan?.id);
      setSelectedPlanId(otherPlan?.id ?? activePlans[0]?.id ?? '');
    }
  }, [activePlans, currentPlan?.id, selectedPlanId]);

  useEffect(() => {
    if (subscription?.billingCycle) {
      setSelectedCycle(subscription.billingCycle as BillingCycle);
    }
  }, [subscription?.billingCycle]);

  // Fetch plan change quote from backend quote engine
  useEffect(() => {
    if (!subscription?.id || !selectedPlanId) {
      setQuote(null);
      return;
    }

    let isCancelled = false;
    setIsLoadingQuote(true);
    setQuoteError(null);

    subscriptionsApi
      .getPlanChangeQuote(subscription.id, {
        targetPlanId: selectedPlanId,
        billingCycle: selectedCycle,
      })
      .then((data) => {
        if (!isCancelled) {
          setQuote(data);
          setIsLoadingQuote(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          const msg =
            err?.response?.data?.message ||
            err?.message ||
            'Failed to calculate prorated plan-change quote.';
          setQuoteError(msg);
          setIsLoadingQuote(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [subscription?.id, selectedPlanId, selectedCycle]);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['salon', tenantId] });
    qc.invalidateQueries({ queryKey: ['salons'] });
    qc.invalidateQueries({ queryKey: ['subscription', tenantId] });
    qc.invalidateQueries({ queryKey: ['subscriptions'] });
    onSuccess?.();
  };

  const handleApplyUpgrade = async () => {
    if (!subscription?.id || !selectedPlanId || !verifiedPayment) return;
    setIsSubmitting(true);
    try {
      await subscriptionsApi.manualUpgrade(subscription.id, {
        tenantId,
        planId: selectedPlanId,
        billingCycle: selectedCycle,
      });
      toast.success(
        `Subscription upgraded to ${quote?.targetPlan.name} successfully. Entitlements refreshed.`,
      );
      setUpgradeDialogOpen(false);
      setVerifiedPayment(false);
      refreshAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to apply upgrade.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyDowngrade = async () => {
    if (!subscription?.id || !selectedPlanId || !verifiedDowngrade) return;
    setIsSubmitting(true);
    try {
      await subscriptionsApi.scheduleDowngrade(subscription.id, {
        tenantId,
        planId: selectedPlanId,
        billingCycle: selectedCycle,
        immediate: true,
      });
      const creditVal = quote?.creditCarriedForward ?? quote?.downgradeCredit ?? 0;
      toast.success(
        `Subscription downgraded to ${quote?.targetPlan.name} immediately. Credit carried forward: ${formatAmount(creditVal, quote?.currency)}.`,
      );
      setDowngradeDialogOpen(false);
      setVerifiedDowngrade(false);
      refreshAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to apply manual downgrade.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelPendingDowngrade = async () => {
    if (!subscription?.id) return;
    setIsCancellingDowngrade(true);
    try {
      await subscriptionsApi.cancelPendingDowngrade(subscription.id, tenantId);
      toast.success('Scheduled downgrade cancelled. Current plan will renew normally.');
      refreshAll();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to cancel scheduled downgrade.',
      );
    } finally {
      setIsCancellingDowngrade(false);
    }
  };

  const handleQuickImmediateDowngrade = () => {
    if (subscription?.pendingPlan?.id) {
      setSelectedPlanId(subscription.pendingPlan.id);
    }
    setVerifiedDowngrade(false);
    setDowngradeDialogOpen(true);
  };

  if (!subscription) {
    return (
      <section className="sd-panel" id="manage-subscription-plan-section" aria-label="Manage Subscription Plan">
        <div className="sd-panel-head">
          <h2 className="sd-panel-title">Manage Subscription Plan</h2>
          <p className="sd-panel-desc">Salon subscription upgrade and downgrade control</p>
        </div>
        <div className="sd-panel-body">
          <div className="sd-empty">
            No active subscription found for this salon. Assign an initial subscription plan first.
          </div>
        </div>
      </section>
    );
  }

  const isUpgrade = quote?.tierChange === 'upgrade';
  const isDowngrade = quote?.tierChange === 'downgrade';
  const isSamePlan = quote?.tierChange === 'same';
  const creditCarriedForward = quote?.creditCarriedForward ?? quote?.downgradeCredit ?? 0;

  return (
    <section className="sd-panel" id="manage-subscription-plan-section" aria-label="Manage Subscription Plan">
      {/* HEADER */}
      <div className="sd-panel-head flex items-center justify-between">
        <div>
          <h2 className="sd-panel-title flex items-center gap-2">
            <Layers3 className="w-5 h-5 text-primary" />
            Manage Subscription Plan
          </h2>
          <p className="sd-panel-desc">
            Administrative plan change console with prorated settlement calculation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              subscription.status === 'ACTIVE'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
            }`}
          >
            {subscription.status}
          </span>
        </div>
      </div>

      <div className="sd-panel-body space-y-6">
        {/* HIGH-PRIORITY ACTION REQUIRED: SCHEDULED DOWNGRADE PENDING BANNER */}
        {subscription.pendingPlan && (
          <div className="p-4 rounded-xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-card flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Action Required · Scheduled Downgrade Pending
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/20 text-amber-800 dark:text-amber-300">
                    Target: {subscription.pendingPlan.name}
                  </span>
                </div>
                <div className="text-sm font-semibold text-foreground">
                  Salon Owner scheduled downgrade to {subscription.pendingPlan.name}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Scheduled for next renewal cycle on{' '}
                  <span className="font-semibold text-foreground">
                    {formatDate(subscription.nextBillingDate || subscription.endDate)}
                  </span>
                  . As Super Admin, you can authorize it immediately with prorated billing credit carryover, or cancel the request.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0">
              <Button
                type="button"
                variant="default"
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm flex items-center gap-1.5"
                onClick={handleQuickImmediateDowngrade}
              >
                <Zap className="w-3.5 h-3.5" />
                Authorize Immediately
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isCancellingDowngrade}
                className="border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-xs font-medium"
                onClick={handleCancelPendingDowngrade}
              >
                {isCancellingDowngrade ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Cancelling...
                  </>
                ) : (
                  'Cancel Request'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* 1. CURRENT SUBSCRIPTION OVERVIEW */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Current Subscription Status
            </div>
            {subscription.billingCreditBalance !== undefined && Number(subscription.billingCreditBalance) > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Billing Credit: {formatAmount(subscription.billingCreditBalance ?? 0, subscription.currency)}
              </span>
            )}
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <dt className="text-muted-foreground">Salon Name</dt>
              <dd className="font-semibold text-foreground mt-0.5 truncate">{salonName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Current Plan</dt>
              <dd className="font-bold text-foreground mt-0.5 flex items-center gap-1.5">
                {subscription.planName || subscription.planCode || '—'}
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-semibold">
                  Active Tier
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Billing Cycle</dt>
              <dd className="font-semibold text-foreground mt-0.5">
                {billingCycleLabel((subscription.billingCycle as BillingCycle) || 'MONTHLY')}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Base Plan Price</dt>
              <dd className="font-semibold text-foreground mt-0.5">
                {formatPrice(subscription.price, subscription.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Start Date</dt>
              <dd className="text-foreground mt-0.5">{formatDate(subscription.startDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Current Cycle Expiry</dt>
              <dd className="text-foreground mt-0.5">{formatDate(subscription.endDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Next Renewal</dt>
              <dd className="text-foreground font-semibold mt-0.5">
                {formatDate(subscription.nextBillingDate || subscription.endDate)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Available Credit Balance</dt>
              <dd className="mt-0.5 font-bold text-emerald-600 dark:text-emerald-400">
                {subscription.billingCreditBalance && Number(subscription.billingCreditBalance) > 0
                  ? formatAmount(subscription.billingCreditBalance ?? 0, subscription.currency)
                  : `${subscription.currency} 0.00`}
              </dd>
            </div>
          </dl>
        </div>

        {/* 2. TARGET PLAN & BILLING CYCLE SELECTOR */}
        <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Select Target Plan &amp; Billing Cycle for Prorated Quote
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-target-plan" className="text-xs font-semibold text-foreground">
                Target Subscription Plan
              </Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId} disabled={isLoadingPlans}>
                <SelectTrigger id="admin-target-plan" className="bg-card">
                  <SelectValue placeholder="Select target plan" />
                </SelectTrigger>
                <SelectContent>
                  {activePlans.map((p) => {
                    const isCur = p.id === currentPlan?.id;
                    const priceObj = p.planPrices?.find((pr) => pr.billingCycle === selectedCycle);
                    const priceStr = priceObj
                      ? formatPrice(priceObj.price, priceObj.currency)
                      : '—';

                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({priceStr}) {isCur ? '— Current' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admin-target-cycle" className="text-xs font-semibold text-foreground">
                Billing Cycle
              </Label>
              <Select
                value={selectedCycle}
                onValueChange={(val) => setSelectedCycle(val as BillingCycle)}
              >
                <SelectTrigger id="admin-target-cycle" className="bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* 3. DYNAMIC PRORATED QUOTE / CLASSIFICATION */}
        {isLoadingQuote && (
          <div className="p-8 rounded-xl border border-dashed border-border flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/10">
            <RefreshCw className="w-5 h-5 animate-spin text-primary" />
            <span>Calculating live prorated plan change quote...</span>
          </div>
        )}

        {quoteError && !isLoadingQuote && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <div className="font-semibold text-red-700 dark:text-red-400">
                Plan Change Ineligible
              </div>
              <p className="text-red-600/90 leading-relaxed">{quoteError}</p>
            </div>
          </div>
        )}

        {quote && !isLoadingQuote && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* ACTION READY NOTIFICATION BANNER */}
            <div
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${
                isUpgrade
                  ? 'border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-card'
                  : isDowngrade
                  ? 'border-blue-500/40 bg-gradient-to-r from-blue-500/15 via-blue-500/5 to-card'
                  : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      isUpgrade ? 'bg-emerald-400' : isDowngrade ? 'bg-blue-400' : 'bg-muted'
                    }`}
                  ></span>
                  <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${
                      isUpgrade ? 'bg-emerald-500' : isDowngrade ? 'bg-blue-500' : 'bg-muted-foreground'
                    }`}
                  ></span>
                </span>
                <div>
                  <div className="text-xs font-bold text-foreground flex items-center gap-2 flex-wrap">
                    Administrative Action Ready
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isUpgrade
                          ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                          : isDowngrade
                          ? 'bg-blue-500/20 text-blue-800 dark:text-blue-300'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isUpgrade ? 'Immediate Upgrade' : isDowngrade ? 'Immediate Downgrade + Credit' : 'Plan Sync'}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {isUpgrade
                      ? 'Prorated upgrade quote calculated. Verify customer bank transfer slip and click below to process.'
                      : isDowngrade
                      ? 'Prorated credit calculated. Click "Process Manual Downgrade" to review ledger & authorize.'
                      : 'Selected plan matches current active subscription.'}
                  </div>
                </div>
              </div>

              {/* QUICK CALL TO ACTION BUTTON */}
              <div className="shrink-0">
                {isUpgrade && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="w-full sm:w-auto font-semibold px-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5"
                    onClick={() => {
                      setVerifiedPayment(false);
                      setUpgradeDialogOpen(true);
                    }}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    Process Manual Upgrade
                  </Button>
                )}

                {isDowngrade && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="w-full sm:w-auto font-semibold px-4 bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5"
                    onClick={() => {
                      setVerifiedDowngrade(false);
                      setDowngradeDialogOpen(true);
                    }}
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    Process Manual Downgrade
                  </Button>
                )}
              </div>
            </div>

            {/* ADMIN PRORATED SETTLEMENT PREVIEW CARD */}
            <div
              className={`rounded-2xl border p-5 transition-all shadow-sm ${
                isUpgrade
                  ? 'border-emerald-500/30 bg-card'
                  : isDowngrade
                  ? 'border-blue-500/30 bg-card'
                  : 'border-border bg-card'
              }`}
            >
              {/* Top Banner: Plan Transition */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {isUpgrade && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 border border-emerald-500/30">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Plan Upgrade
                    </span>
                  )}
                  {isDowngrade && (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 flex items-center gap-1.5 border border-blue-500/30">
                      <TrendingDown className="w-3.5 h-3.5" />
                      Plan Downgrade
                    </span>
                  )}
                  {isSamePlan && (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                      Same Plan Tier
                    </span>
                  )}

                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <span className="px-2 py-0.5 rounded bg-muted font-semibold">{quote.currentPlan.name}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        isUpgrade
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : isDowngrade
                          ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                          : 'bg-muted'
                      }`}
                    >
                      {quote.targetPlan.name}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-muted-foreground font-medium">
                    {isUpgrade ? 'Prorated Amount Payable' : isDowngrade ? 'Credit Carried Forward' : 'Settlement Total'}
                  </div>
                  <div
                    className={`text-base font-extrabold ${
                      isUpgrade
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isDowngrade
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-foreground'
                    }`}
                  >
                    {isUpgrade
                      ? formatAmount(quote.additionalAmountPayable, quote.currency)
                      : isDowngrade
                      ? `+${formatAmount(creditCarriedForward, quote.currency)}`
                      : `${quote.currency} 0.00`}
                  </div>
                </div>
              </div>

              {/* Cycle Timeline Progress Bar */}
              <div className="py-3 border-b border-border/60">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    Billing Cycle Progress
                  </span>
                  <span className="font-semibold text-foreground">
                    {quote.remainingDays} of {quote.totalDays} days remaining ({quote.remainingPercentage}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isUpgrade ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.max(5, Math.min(100, quote.remainingPercentage))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                  <span>Cycle Start: {formatDate(subscription.startDate)}</span>
                  <span>
                    Preserved Renewal Date: <strong className="text-foreground">{formatDate(quote.nextRenewalDate)}</strong>
                  </span>
                </div>
              </div>

              {/* 4 HIGH-IMPACT KPI METRIC CARDS FOR DOWNGRADE */}
              {isDowngrade && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
                  <div className="p-3 rounded-xl bg-card border border-border shadow-xs">
                    <div className="text-muted-foreground text-[11px] font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      Unused Paid Value
                    </div>
                    <div className="text-sm font-bold text-foreground mt-1">
                      {formatAmount(quote.unusedCurrentPlanValue, quote.currency)}
                    </div>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {quote.remainingDays} days of {quote.currentPlan.name}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border shadow-xs">
                    <div className="text-muted-foreground text-[11px] font-medium flex items-center gap-1">
                      <Layers3 className="w-3 h-3 text-muted-foreground" />
                      Target Plan Period Cost
                    </div>
                    <div className="text-sm font-bold text-foreground mt-1">
                      {formatAmount(quote.newPlanRemainingCost, quote.currency)}
                    </div>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      {quote.remainingDays} days of {quote.targetPlan.name}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30 shadow-xs">
                    <div className="text-emerald-700 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Credit Carried Forward
                    </div>
                    <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
                      +{formatAmount(creditCarriedForward, quote.currency)}
                    </div>
                    <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 block mt-0.5">
                      Stored in tenant billing balance
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border shadow-xs">
                    <div className="text-muted-foreground text-[11px] font-medium flex items-center gap-1">
                      <CreditCard className="w-3 h-3 text-muted-foreground" />
                      Final Next Renewal Payable
                    </div>
                    <div className="text-sm font-bold text-foreground mt-1">
                      {formatAmount(quote.finalNextRenewalPayableAmount ?? quote.expectedNextRenewalTotal, quote.currency)}
                    </div>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Base {formatAmount(quote.nextRenewalPrice ?? quote.expectedNextRenewalTotal, quote.currency)} minus credit
                    </span>
                  </div>
                </div>
              )}

              {/* 4 HIGH-IMPACT KPI METRIC CARDS FOR UPGRADE */}
              {isUpgrade && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
                  <div className="p-3 rounded-xl bg-card border border-border shadow-xs">
                    <div className="text-muted-foreground text-[11px] font-medium">Unused Current Plan Value</div>
                    <div className="text-sm font-bold text-foreground mt-1">
                      {formatAmount(quote.unusedCurrentPlanValue, quote.currency)}
                    </div>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">Credit offset applied</span>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border shadow-xs">
                    <div className="text-muted-foreground text-[11px] font-medium">Target Plan Remaining Cost</div>
                    <div className="text-sm font-bold text-foreground mt-1">
                      {formatAmount(quote.newPlanRemainingCost, quote.currency)}
                    </div>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">{quote.remainingDays} days of {quote.targetPlan.name}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30 shadow-xs">
                    <div className="text-emerald-700 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Prorated Amount Payable
                    </div>
                    <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
                      {formatAmount(quote.additionalAmountPayable, quote.currency)}
                    </div>
                    <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 block mt-0.5">
                      Verify on WhatsApp bank slip
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border shadow-xs">
                    <div className="text-muted-foreground text-[11px] font-medium">Next Renewal Date</div>
                    <div className="text-sm font-bold text-foreground mt-1">
                      {formatDate(quote.nextRenewalDate)}
                    </div>
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Rate: {formatAmount(quote.nextRenewalPrice ?? quote.expectedNextRenewalTotal, quote.currency)} / {billingCycleLabel(quote.targetPlan.billingCycle as BillingCycle)}
                    </span>
                  </div>
                </div>
              )}

              {/* FEATURES IMPACT NOTICE */}
              {quote.featuresDiff && (quote.featuresDiff.gained.length > 0 || quote.featuresDiff.lost.length > 0) && (
                <div className="mt-4 pt-3 border-t border-border/50 text-xs">
                  {quote.featuresDiff.gained.length > 0 && (
                    <div className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
                      <Check className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>Features Unlocked:</strong>{' '}
                        {quote.featuresDiff.gained.map((f) => f.name).join(', ')}
                      </span>
                    </div>
                  )}
                  {quote.featuresDiff.lost.length > 0 && (
                    <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400 mt-1">
                      <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>Features Restricted on Downgrade:</strong>{' '}
                        {quote.featuresDiff.lost.map((f) => f.name).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ADMIN LEDGER NOTICE */}
              <div className="mt-4 p-3 rounded-xl bg-muted/40 border border-border/60 text-xs flex items-start gap-2.5">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Administrative Ledger Impact: </span>
                  {quote.effectiveDateExplanation}
                </div>
              </div>

              {/* ACTION EXECUTION BUTTONS */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 mt-4 border-t border-border">
                <div className="text-xs text-muted-foreground">
                  Changes take effect immediately upon independent Super Admin confirmation.
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {isUpgrade && (
                    <Button
                      type="button"
                      variant="default"
                      className="w-full sm:w-auto font-semibold px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md flex items-center justify-center gap-2"
                      onClick={() => {
                        setVerifiedPayment(false);
                        setUpgradeDialogOpen(true);
                      }}
                    >
                      <TrendingUp className="w-4 h-4" />
                      Process Manual Upgrade
                    </Button>
                  )}

                  {isDowngrade && (
                    <Button
                      type="button"
                      variant="default"
                      className="w-full sm:w-auto font-semibold px-6 bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center justify-center gap-2"
                      onClick={() => {
                        setVerifiedDowngrade(false);
                        setDowngradeDialogOpen(true);
                      }}
                    >
                      <TrendingDown className="w-4 h-4" />
                      Process Manual Downgrade
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. UPGRADE CONFIRMATION DIALOG (REDESIGNED EXECUTIVE UI) */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col border-border bg-card p-0 shadow-2xl overflow-hidden gap-0">
          <DialogHeader className="text-left space-y-1.5 px-6 pt-5 pb-3 pr-10 border-b border-border shrink-0 bg-card">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Administrative Settlement Engine
              </span>
            </div>
            <DialogTitle className="text-xl font-bold text-foreground">
              Authorize Manual Plan Upgrade
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Confirm that you have independently verified the customer&apos;s WhatsApp bank transfer slip
              before applying this immediate upgrade for <strong className="text-foreground">{salonName}</strong>.
            </DialogDescription>
          </DialogHeader>

          {quote && (
            <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1 overscroll-contain">
              {/* Visual Transition Bar */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Plan</div>
                  <div className="text-sm font-bold text-foreground">{quote.currentPlan.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatAmount(quote.currentPlan.price, quote.currency)} / {billingCycleLabel(quote.currentPlan.billingCycle as BillingCycle)}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center px-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    Immediate Upgrade
                  </span>
                  <ArrowRight className="w-4 h-4 text-emerald-600 mt-1" />
                </div>

                <div className="space-y-0.5 text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target Plan</div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{quote.targetPlan.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatAmount(quote.targetPlan.price, quote.currency)} / {billingCycleLabel(quote.targetPlan.billingCycle as BillingCycle)}
                  </div>
                </div>
              </div>

              {/* Two Hero Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Prorated Amount Payable
                  </div>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                    {formatAmount(quote.additionalAmountPayable, quote.currency)}
                  </div>
                  <div className="text-[11px] text-emerald-600/90 dark:text-emerald-400/90 mt-0.5">
                    Customer payment verified on bank transfer slip
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-card border border-border">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    Preserved Renewal Date
                  </div>
                  <div className="text-2xl font-black text-foreground mt-1">
                    {formatDate(quote.nextRenewalDate)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Current billing period end date unchanged
                  </div>
                </div>
              </div>

              {/* Detailed Settlement Ledger */}
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-2 text-xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Prorated Calculation Ledger
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Tenant / Salon:</span>
                    <span className="font-semibold text-foreground">{salonName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Remaining Period Days:</span>
                    <span className="font-semibold text-foreground">
                      {quote.remainingDays} of {quote.totalDays} days ({quote.remainingPercentage}%)
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Unused Current Plan Value:</span>
                    <span className="font-semibold text-foreground">
                      {formatAmount(quote.unusedCurrentPlanValue, quote.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Target Plan Remaining Cost:</span>
                    <span className="font-semibold text-foreground">
                      {formatAmount(quote.newPlanRemainingCost, quote.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Net Prorated Due:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatAmount(quote.additionalAmountPayable, quote.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Effective Date:</span>
                    <span className="font-semibold text-foreground">
                      Immediate ({formatDate(new Date().toISOString())})
                    </span>
                  </div>
                </div>
              </div>

              {/* REQUIRED CONFIRMATION CHECKBOX */}
              <div className="p-4 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 space-y-2.5">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="admin-verify-check"
                    checked={verifiedPayment}
                    onCheckedChange={(checked) => setVerifiedPayment(!!checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <Label
                    htmlFor="admin-verify-check"
                    className="text-xs font-semibold leading-relaxed text-foreground cursor-pointer select-none"
                  >
                    I confirm that I have independently verified the customer&apos;s bank transfer slip
                    payment of {formatAmount(quote.additionalAmountPayable, quote.currency)} and authorize this immediate upgrade.
                  </Label>
                </div>
                <p className="text-[11px] text-muted-foreground pl-7 leading-relaxed">
                  This action records an immutable audit log with your Super Admin ID, immediately activates
                  all features of {quote.targetPlan.name}, and preserves the renewal date ({formatDate(quote.nextRenewalDate)}).
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 px-6 py-3.5 border-t border-border shrink-0 bg-card flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setUpgradeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={!verifiedPayment || isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 shadow-sm"
              onClick={handleApplyUpgrade}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                  Applying Upgrade...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Authorize &amp; Apply Upgrade
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. DOWNGRADE CONFIRMATION DIALOG (REDESIGNED EXECUTIVE UI) */}
      <Dialog open={downgradeDialogOpen} onOpenChange={setDowngradeDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col border-border bg-card p-0 shadow-2xl overflow-hidden gap-0">
          <DialogHeader className="text-left space-y-1.5 px-6 pt-5 pb-3 pr-10 border-b border-border shrink-0 bg-card">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Administrative Settlement Engine
              </span>
            </div>
            <DialogTitle className="text-xl font-bold text-foreground">
              Authorize Manual Plan Downgrade
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Review calculated credit carryover and independently confirm the salon owner&apos;s request before
              applying this immediate downgrade for <strong className="text-foreground">{salonName}</strong>.
            </DialogDescription>
          </DialogHeader>

          {quote && (
            <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1 overscroll-contain">
              {/* Visual Transition Bar */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current Plan</div>
                  <div className="text-sm font-bold text-foreground">{quote.currentPlan.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatAmount(quote.currentPlan.price, quote.currency)} / {billingCycleLabel(quote.currentPlan.billingCycle as BillingCycle)}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center px-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                    Immediate Downgrade
                  </span>
                  <ArrowRight className="w-4 h-4 text-blue-600 mt-1" />
                </div>

                <div className="space-y-0.5 text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target Plan</div>
                  <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{quote.targetPlan.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatAmount(quote.targetPlan.price, quote.currency)} / {billingCycleLabel(quote.targetPlan.billingCycle as BillingCycle)}
                  </div>
                </div>
              </div>

              {/* Two Hero Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" />
                    Credit Carried Forward
                  </div>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                    +{formatAmount(creditCarriedForward, quote.currency)}
                  </div>
                  <div className="text-[11px] text-emerald-600/90 dark:text-emerald-400/90 mt-0.5">
                    Stored in salon billing balance for next renewal
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-card border border-border">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-primary" />
                    Final Next Renewal Payable
                  </div>
                  <div className="text-2xl font-black text-foreground mt-1">
                    {formatAmount(quote.finalNextRenewalPayableAmount ?? quote.expectedNextRenewalTotal, quote.currency)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Base {formatAmount(quote.nextRenewalPrice ?? quote.expectedNextRenewalTotal, quote.currency)} minus credit
                  </div>
                </div>
              </div>

              {/* Detailed Settlement Ledger */}
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-2 text-xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Credit Carryover Settlement Ledger
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Tenant / Salon:</span>
                    <span className="font-semibold text-foreground">{salonName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Remaining Subscription Days:</span>
                    <span className="font-semibold text-foreground">
                      {quote.remainingDays} of {quote.totalDays} days ({quote.remainingPercentage}%)
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Unused Paid Value:</span>
                    <span className="font-semibold text-foreground">
                      {formatAmount(quote.unusedCurrentPlanValue, quote.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Target Plan Remaining-Period Cost:</span>
                    <span className="font-semibold text-foreground">
                      {formatAmount(quote.newPlanRemainingCost, quote.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Activation Date:</span>
                    <span className="font-semibold text-foreground">
                      Immediate ({formatDate(new Date().toISOString())})
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">Preserved Renewal Date:</span>
                    <span className="font-semibold text-foreground">{formatDate(quote.nextRenewalDate)}</span>
                  </div>
                </div>
              </div>

              {/* REQUIRED CONFIRMATION CHECKBOX */}
              <div className="p-4 rounded-xl border-2 border-blue-500/40 bg-blue-500/5 space-y-2.5">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="admin-downgrade-verify-check"
                    checked={verifiedDowngrade}
                    onCheckedChange={(checked) => setVerifiedDowngrade(!!checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <Label
                    htmlFor="admin-downgrade-verify-check"
                    className="text-xs font-semibold leading-relaxed text-foreground cursor-pointer select-none"
                  >
                    I confirm that I have independently verified the customer&apos;s request and
                    authorize this manual plan change.
                  </Label>
                </div>
                <p className="text-[11px] text-muted-foreground pl-7 leading-relaxed">
                  {quote.targetPlan.name} activates immediately. The net unused credit of{' '}
                  <strong className="text-foreground">{formatAmount(creditCarriedForward, quote.currency)}</strong> is stored as subscription billing credit to reduce future renewals, and the current billing cycle end date ({formatDate(quote.nextRenewalDate)}) is strictly preserved.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 px-6 py-3.5 border-t border-border shrink-0 bg-card flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setDowngradeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="default"
              disabled={!verifiedDowngrade || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2 shadow-sm"
              onClick={handleApplyDowngrade}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                  Applying Downgrade...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Authorize &amp; Apply Immediate Downgrade
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

