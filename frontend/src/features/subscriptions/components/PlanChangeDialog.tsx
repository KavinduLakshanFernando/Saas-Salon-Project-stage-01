import { useEffect, useState, useMemo } from 'react';
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  CreditCard,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { billingCycleLabel, formatPrice } from '@/features/plans/lib/plan-utils';
import type { BillingCycle, PublicPlan } from '@/features/plans/types/plan.types';
import {
  tenantSubscriptionsApi,
  type PlanChangeQuoteResult,
} from '@/features/subscriptions/api/tenant-subscriptions.api';
import { formatDate, formatAmount } from '@/features/billing/lib/billing-utils';
import {
  BANK_TRANSFER_DETAILS,
  buildWhatsAppPlanChangeUrl,
} from '@/config/subscription-assistance';
import { toast } from 'sonner';

function WhatsAppIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.66c-.19.53-1.06 1.04-1.49 1.09-.4.05-.92.07-1.49-.11-.36-.12-.83-.28-1.43-.54-2.52-1.09-4.17-3.66-4.3-3.83-.12-.17-1.03-1.37-1.03-2.62 0-1.24.65-1.85.88-2.1.23-.25.5-.31.67-.31.17 0 .34 0 .49.01.15.01.36-.06.56.42.21.5.71 1.74.77 1.87.06.12.1.27.02.43-.08.17-.12.27-.24.41-.12.14-.26.31-.37.42-.12.12-.25.26-.11.5.14.25.64 1.05 1.37 1.7 1 .89 1.84 1.17 2.1 1.3.26.12.41.1.56-.07.15-.17.65-.76.82-1.02.17-.26.34-.22.58-.13.23.09 1.49.7 1.75.83.26.12.43.19.49.3.06.11.06.64-.13 1.17z" />
    </svg>
  );
}

export interface PlanChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId?: string;
  salonName?: string;
  plans: PublicPlan[];
  currentPlanCode: string;
  currentBillingCycle?: BillingCycle;
  initialTargetPlanId?: string | null;
  mode?: 'upgrade' | 'downgrade' | 'change' | null;
  onPayHereCheckout?: (options: { planId: string; planPriceId?: string; billingCycle: BillingCycle }) => void;
  onPlanChanged?: () => void;
}

export function PlanChangeDialog({
  open,
  onOpenChange,
  subscriptionId,
  salonName,
  plans,
  currentPlanCode,
  currentBillingCycle = 'MONTHLY',
  initialTargetPlanId,
  mode = 'change',
  onPayHereCheckout,
  onPlanChanged,
}: PlanChangeDialogProps) {
  const currentPlan = useMemo(
    () => plans.find((p) => p.code === currentPlanCode),
    [plans, currentPlanCode],
  );
  const currentOrder = currentPlan?.displayOrder ?? 0;

  // Filter or prioritize plans based on mode if specified
  const eligiblePlans = useMemo(() => {
    return [...plans].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  }, [plans]);

  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>(currentBillingCycle);
  const [quote, setQuote] = useState<PlanChangeQuoteResult | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Initialize or reset selections when modal opens or initialTargetPlanId changes
  useEffect(() => {
    if (!open) {
      setQuote(null);
      setQuoteError(null);
      setIsLoadingQuote(false);
      return;
    }

    setSelectedCycle(currentBillingCycle);

    if (initialTargetPlanId && plans.some((p) => p.id === initialTargetPlanId)) {
      setSelectedPlanId(initialTargetPlanId);
    } else {
      // Find a sensible default: if mode is upgrade, first higher plan; if downgrade, first lower plan; else first different plan
      if (mode === 'upgrade') {
        const higher = eligiblePlans.find((p) => (p.displayOrder ?? 0) > currentOrder);
        setSelectedPlanId(higher?.id ?? eligiblePlans[0]?.id ?? '');
      } else if (mode === 'downgrade') {
        const lower = [...eligiblePlans]
          .reverse()
          .find((p) => (p.displayOrder ?? 0) < currentOrder);
        setSelectedPlanId(lower?.id ?? eligiblePlans[0]?.id ?? '');
      } else {
        const different = eligiblePlans.find((p) => p.code !== currentPlanCode);
        setSelectedPlanId(different?.id ?? eligiblePlans[0]?.id ?? '');
      }
    }
  }, [open, initialTargetPlanId, mode, currentOrder, currentPlanCode, currentBillingCycle, eligiblePlans, plans]);

  // Fetch prorated quote whenever subscriptionId, selectedPlanId, or selectedCycle changes
  useEffect(() => {
    if (!open || !subscriptionId || !selectedPlanId) return;

    let isCancelled = false;
    setIsLoadingQuote(true);
    setQuoteError(null);

    tenantSubscriptionsApi
      .getPlanChangeQuote(subscriptionId, {
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
  }, [open, subscriptionId, selectedPlanId, selectedCycle]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSelectedPlanId('');
      setQuote(null);
      setQuoteError(null);
    }
    onOpenChange(next);
  };

  const isUpgrade = quote?.tierChange === 'upgrade';
  const isDowngrade = quote?.tierChange === 'downgrade';
  const isSamePlan = quote?.tierChange === 'same';
  const usedPercentage = quote
    ? Math.max(0, Math.min(100, Math.round((100 - quote.remainingPercentage) * 10) / 10))
    : 0;

  const [copied, setCopied] = useState(false);
  const [isSchedulingDowngrade, setIsSchedulingDowngrade] = useState(false);

  const handleCopyAccount = () => {
    navigator.clipboard.writeText(BANK_TRANSFER_DETAILS.accountNumber);
    setCopied(true);
    toast.success('Bank account number copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppClick = () => {
    if (!quote) return;
    const whatsAppUrl = buildWhatsAppPlanChangeUrl({
      salonName: salonName || 'My Salon',
      currentPlan: quote.currentPlan.name,
      targetPlan: quote.targetPlan.name,
      billingCycle: billingCycleLabel(selectedCycle),
      tierChange: quote.tierChange,
      amount: isUpgrade ? quote.additionalAmountPayable : 0,
      downgradeCredit: isDowngrade ? (quote.creditCarriedForward ?? quote.downgradeCredit ?? 0) : 0,
      creditCarriedForward: quote.creditCarriedForward ?? 0,
      nextRenewalPayable: quote.finalNextRenewalPayableAmount ?? quote.expectedNextRenewalTotal,
      currency: quote.currency,
    });
    window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
    toast.success(
      isDowngrade
        ? 'WhatsApp opened with your downgrade and credit adjustment details.'
        : 'WhatsApp opened with your pre-filled plan change request. Please attach your bank transfer slip.'
    );
  };

  const handleScheduleDowngradeOnline = async () => {
    if (!subscriptionId || !quote) return;
    setIsSchedulingDowngrade(true);
    try {
      await tenantSubscriptionsApi.scheduleDowngrade(subscriptionId, {
        planId: selectedPlanId,
        billingCycle: selectedCycle,
      });
      toast.success(
        `Downgrade to ${quote.targetPlan.name} scheduled for your next renewal date (${formatDate(quote.nextRenewalDate)}).`,
      );
      onPlanChanged?.();
      handleOpenChange(false);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to schedule downgrade online.',
      );
    } finally {
      setIsSchedulingDowngrade(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-border shadow-2xl">
        {/* Header with clean gradient accent */}
        <div className="p-6 border-b border-border bg-gradient-to-r from-background via-muted/30 to-background">
          <DialogHeader className="space-y-1.5 text-left">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="w-3.5 h-3.5" />
                Plan Change & Prorated Billing
              </span>
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              Subscription Plan Change
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Review live prorated pricing, feature differences, and select PayHere online or WhatsApp admin assistance.
            </DialogDescription>
          </DialogHeader>

          {/* Plan Selection Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-4 border-t border-border/60">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Target Plan
              </Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger className="h-10 text-sm font-medium">
                  <SelectValue placeholder="Choose a plan" />
                </SelectTrigger>
                <SelectContent>
                  {eligiblePlans.map((plan) => {
                    const priceForCycle = plan.prices.find((p) => p.billingCycle === selectedCycle);
                    const isCur = plan.code === currentPlanCode;
                    const isHigher = (plan.displayOrder ?? 0) > currentOrder;
                    const isLower = (plan.displayOrder ?? 0) < currentOrder;

                    return (
                      <SelectItem key={plan.id} value={plan.id}>
                        <div className="flex items-center justify-between gap-3 w-full">
                          <span>
                            {plan.name} {isCur ? '(Current)' : ''}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {priceForCycle
                              ? formatPrice(priceForCycle.price, priceForCycle.currency)
                              : formatPrice(plan.price, plan.currency)}{' '}
                            / {selectedCycle === 'MONTHLY' ? 'mo' : 'yr'}
                          </span>
                          {isCur ? (
                            <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded font-semibold">
                              CURRENT
                            </span>
                          ) : isHigher ? (
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-semibold">
                              UPGRADE
                            </span>
                          ) : isLower ? (
                            <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded font-semibold">
                              DOWNGRADE
                            </span>
                          ) : null}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Billing Cycle
              </Label>
              <div className="grid grid-cols-2 gap-2 h-10">
                <button
                  type="button"
                  className={`text-xs font-semibold rounded-md border transition-all ${
                    selectedCycle === 'MONTHLY'
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border'
                  }`}
                  onClick={() => setSelectedCycle('MONTHLY')}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={`text-xs font-semibold rounded-md border transition-all ${
                    selectedCycle === 'YEARLY'
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border'
                  }`}
                  onClick={() => setSelectedCycle('YEARLY')}
                >
                  Yearly (Save ~20%)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body: Loading, Error, or Quote Breakdown */}
        <div className="p-6 space-y-6">
          {isLoadingQuote ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Calculating Prorated Quote…
                </p>
                <p className="text-xs text-muted-foreground">
                  Evaluating elapsed billing period, unused credit value, and decimal-exact target plan rates.
                </p>
              </div>
            </div>
          ) : quoteError ? (
            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4" />
                Calculation Error
              </div>
              <p className="text-xs leading-relaxed">{quoteError}</p>
            </div>
          ) : !quote ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Select a target plan to preview the prorated billing quote.
            </div>
          ) : !quote.isEligible ? (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Prorated Quote Unavailable for this Selection
              </div>
              <p className="text-xs leading-relaxed">
                {quote.quoteUnavailableReason || quote.summaryMessage}
              </p>
              <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 p-2.5 rounded-lg">
                💡 Tip: For mid-cycle upgrades, please select the same billing cycle (
                {billingCycleLabel(quote.currentPlan.billingCycle)}) as your current subscription.
              </div>
            </div>
          ) : (
            <>
              {/* Plan Transition Pill Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-muted/30">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Current Plan
                    </span>
                    <div className="text-sm font-bold text-foreground">
                      {quote.currentPlan.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatAmount(quote.currentPlan.price, quote.currency)} /{' '}
                      {billingCycleLabel(quote.currentPlan.billingCycle)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-muted-foreground hidden sm:block" />
                  {isUpgrade && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                      <TrendingUp className="w-3.5 h-3.5" /> UPGRADE
                    </span>
                  )}
                  {isDowngrade && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                      <TrendingDown className="w-3.5 h-3.5" /> DOWNGRADE
                    </span>
                  )}
                  {isSamePlan && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                      <ShieldCheck className="w-3.5 h-3.5" /> SAME PLAN
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto sm:text-right">
                  <div className="space-y-0.5 sm:ml-auto">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Target Plan
                    </span>
                    <div className="text-sm font-bold text-foreground">
                      {quote.targetPlan.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatAmount(quote.targetPlan.price, quote.currency)} /{' '}
                      {billingCycleLabel(quote.targetPlan.billingCycle)}
                    </div>
                  </div>
                </div>
              </div>

              {/* UPGRADE VIEW: Prominent Additional Amount + Prorated Math Grid */}
              {isUpgrade && (
                <div className="space-y-4">
                  {/* Spotlight Card */}
                  <div className="relative overflow-hidden rounded-2xl p-5 border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                          Additional Amount Payable Today
                        </span>
                        <div className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight mt-0.5">
                          {formatAmount(quote.additionalAmountPayable, quote.currency)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Prorated for the remaining {quote.remainingDays} days of your current billing cycle.
                        </p>
                      </div>
                      <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-emerald-500/20 pt-2 sm:pt-0 sm:pl-4">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          Next Regular Renewal
                        </span>
                        <div className="text-base font-bold text-foreground">
                          {formatAmount(quote.expectedNextRenewalTotal, quote.currency)}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          on {formatDate(quote.nextRenewalDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Prorated Math Formula Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl border border-border bg-card">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                        Eligible Paid Amount
                      </span>
                      <div className="text-sm font-bold text-foreground mt-1">
                        {formatAmount(quote.actualEligiblePaidAmount, quote.currency)}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Current plan baseline
                      </span>
                    </div>

                    <div className="p-3 rounded-xl border border-border bg-card">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                        Unused Credit Value
                      </span>
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        - {formatAmount(quote.unusedCurrentPlanValue, quote.currency)}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {quote.remainingPercentage}% period remaining
                      </span>
                    </div>

                    <div className="p-3 rounded-xl border border-border bg-card">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                        New Plan Prorated Cost
                      </span>
                      <div className="text-sm font-bold text-foreground mt-1">
                        {formatAmount(quote.newPlanRemainingCost, quote.currency)}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Cost for {quote.remainingDays} days
                      </span>
                    </div>

                    <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                        Net Prorated Charge
                      </span>
                      <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                        {formatAmount(quote.additionalAmountPayable, quote.currency)}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        New Cost − Unused Credit
                      </span>
                    </div>
                  </div>

                  {/* Billing Timeline Progress Bar */}
                  <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        Billing Cycle ({quote.totalDays} Total Days)
                      </span>
                      <span className="text-muted-foreground font-mono">
                        {formatDate(quote.periodStart)} – {formatDate(quote.periodEnd)}
                      </span>
                    </div>

                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden flex">
                      <div
                        className="bg-primary/50 h-full transition-all duration-300"
                        style={{ width: `${usedPercentage}%` }}
                        title={`Time Used: ${quote.usedDays} days (${usedPercentage}%)`}
                      />
                      <div
                        className="bg-emerald-500 h-full transition-all duration-300"
                        style={{ width: `${quote.remainingPercentage}%` }}
                        title={`Time Remaining: ${quote.remainingDays} days (${quote.remainingPercentage}%)`}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        Elapsed: <strong>{quote.usedDays} days</strong> ({usedPercentage}%)
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        Remaining: <strong>{quote.remainingDays} days</strong> ({quote.remainingPercentage}%)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* DOWNGRADE VIEW: Effective Date & Benefit Retention & Credit Adjustment */}
              {isDowngrade && (
                <div className="space-y-4">
                  <div className="rounded-2xl p-5 border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                          Immediate Additional Charge
                        </span>
                        <div className="text-3xl font-extrabold text-foreground tracking-tight mt-0.5">
                          {formatAmount(0, quote.currency)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          No additional payment is required today for a plan downgrade.
                        </p>
                      </div>

                      <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-amber-500/20 pt-2 sm:pt-0 sm:pl-4">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          Final Next Renewal Payment
                        </span>
                        <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                          {formatAmount(quote.finalNextRenewalPayableAmount ?? quote.expectedNextRenewalTotal, quote.currency)}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          on {formatDate(quote.nextRenewalDate)} (after credit deduction)
                        </span>
                      </div>
                    </div>

                    {/* Downgrade Credit Math Breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                      <div className="p-3 rounded-xl border border-border bg-card">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          Unused Paid Value
                        </span>
                        <div className="text-sm font-bold text-foreground mt-1">
                          {formatAmount(quote.unusedCurrentPlanValue, quote.currency)}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {quote.remainingDays} days of current plan
                        </span>
                      </div>

                      <div className="p-3 rounded-xl border border-border bg-card">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          Target Plan Cost
                        </span>
                        <div className="text-sm font-bold text-foreground mt-1">
                          {formatAmount(quote.newPlanRemainingCost, quote.currency)}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          Remaining {quote.remainingDays} days
                        </span>
                      </div>

                      <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                          Credit Carried Forward
                        </span>
                        <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                          + {formatAmount(quote.creditCarriedForward ?? quote.downgradeCredit ?? 0, quote.currency)}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          Unused − Target cost
                        </span>
                      </div>

                      <div className="p-3 rounded-xl border border-border bg-card">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                          Next Renewal Price
                        </span>
                        <div className="text-sm font-bold text-foreground mt-1">
                          {formatAmount(quote.nextRenewalPrice ?? quote.expectedNextRenewalTotal, quote.currency)}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          Base {billingCycleLabel(quote.targetPlan.billingCycle)} rate
                        </span>
                      </div>
                    </div>

                    {/* Downgrade rules explanation */}
                    <div className="pt-3 border-t border-amber-500/20 space-y-2 text-xs text-foreground/90">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>
                          <strong>Downgrade Credit Protection:</strong> The unused paid value of your current plan (
                          <strong>{formatAmount(quote.unusedCurrentPlanValue, quote.currency)}</strong>) covers your new plan for the remaining {quote.remainingDays} days. The net surplus credit of{' '}
                          <strong>{formatAmount(quote.creditCarriedForward ?? quote.downgradeCredit ?? 0, quote.currency)}</strong> is saved to your subscription billing credit and automatically reduces your next renewal to{' '}
                          <strong>{formatAmount(quote.finalNextRenewalPayableAmount ?? quote.expectedNextRenewalTotal, quote.currency)}</strong>.
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <span>
                          <strong>Renewal Continuity:</strong> Your billing anniversary date (
                          <strong>{formatDate(quote.nextRenewalDate)}</strong>) remains unchanged.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SAME PLAN VIEW */}
              {isSamePlan && (
                <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-blue-900 dark:text-blue-200 text-xs leading-relaxed space-y-1.5">
                  <div className="font-semibold text-sm flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    Currently Active Plan
                  </div>
                  <p>
                    You are already subscribed to the {quote.currentPlan.name} on the{' '}
                    {billingCycleLabel(quote.currentPlan.billingCycle)} billing interval. Your next renewal is
                    scheduled for {formatDate(quote.nextRenewalDate)} for{' '}
                    {formatAmount(quote.expectedNextRenewalTotal, quote.currency)}.
                  </p>
                </div>
              )}

              {/* FEATURES COMPARISON: Gained vs Lost vs Retained */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Feature & Entitlement Changes
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Gained Features */}
                  <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      Features Gained ({quote.featuresDiff.gained.length})
                    </span>
                    {quote.featuresDiff.gained.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No new feature entitlements in this tier change.
                      </p>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-foreground">
                        {quote.featuresDiff.gained.map((feat) => (
                          <li key={feat.code} className="flex items-start gap-2">
                            <span className="text-emerald-600 font-bold shrink-0">+</span>
                            <span>{feat.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Lost Features */}
                  <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" />
                      Features Adjusted / Lost ({quote.featuresDiff.lost.length})
                    </span>
                    {quote.featuresDiff.lost.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        No features lost. All your existing capabilities carry over.
                      </p>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-foreground">
                        {quote.featuresDiff.lost.map((feat) => (
                          <li key={feat.code} className="flex items-start gap-2 text-muted-foreground">
                            <span className="text-amber-600 font-bold shrink-0">−</span>
                            <span>{feat.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* PAYMENT & CHANGE OPTIONS: Option A (Pay Online with PayHere) vs Option B (WhatsApp Admin Assistance) */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Payment & Activation Methods
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    Choose online payment or WhatsApp bank slip verification
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Option A: Pay Online with PayHere / Schedule Online */}
                  <div className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all flex flex-col justify-between space-y-3 relative">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4" />
                          Option A: Pay Online
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          PayHere Gateway
                        </span>
                      </div>
                      <h5 className="text-sm font-semibold text-foreground">
                        {isUpgrade ? 'Instant PayHere Checkout' : 'Schedule Downgrade Online'}
                      </h5>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {isUpgrade
                          ? `Pay ${formatAmount(quote.additionalAmountPayable, quote.currency)} via credit or debit card. Plan and features upgrade immediately upon payment.`
                          : `Confirm your downgrade online today. You retain all ${quote.currentPlan.name} features until ${formatDate(quote.nextRenewalDate)} without extra fee.`}
                      </p>
                    </div>

                    <div className="pt-2">
                      {isUpgrade ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full font-semibold border-primary/30 text-primary hover:bg-primary/5 flex items-center justify-center gap-2"
                          onClick={() => {
                            if (onPayHereCheckout) {
                              onPayHereCheckout({
                                planId: selectedPlanId,
                                billingCycle: selectedCycle,
                              });
                              handleOpenChange(false);
                            } else {
                              toast.info('Please select this plan on your subscription overview to start PayHere checkout.');
                            }
                          }}
                        >
                          <CreditCard className="w-4 h-4" />
                          Pay with PayHere
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isSchedulingDowngrade}
                          className="w-full font-semibold border-border flex items-center justify-center gap-2"
                          onClick={handleScheduleDowngradeOnline}
                        >
                          {isSchedulingDowngrade ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Scheduling...
                            </>
                          ) : (
                            <>
                              <Clock className="w-4 h-4" />
                              Schedule Downgrade Online
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Option B: Contact Admin via WhatsApp */}
                  <div className="p-4 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/70 transition-all flex flex-col justify-between space-y-3 relative">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <WhatsAppIcon className="w-4 h-4" />
                          Option B: WhatsApp Admin
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                          Bank Transfer
                        </span>
                      </div>
                      <h5 className="text-sm font-semibold text-foreground">
                        Contact Admin via WhatsApp
                      </h5>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Prefer offline bank transfer? Send funds to our account, open WhatsApp with your pre-filled plan request, and attach your bank deposit slip.
                      </p>

                      {/* Bank Details Mini Card */}
                      {isUpgrade && quote.additionalAmountPayable > 0 && (
                        <div className="mt-2 p-2.5 rounded-lg border border-emerald-500/20 bg-background/90 text-[11px] space-y-1">
                          <div className="flex items-center justify-between font-semibold text-foreground">
                            <span>{BANK_TRANSFER_DETAILS.bankName}</span>
                            <span className="text-muted-foreground font-normal">{BANK_TRANSFER_DETAILS.branch}</span>
                          </div>
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span className="font-mono text-foreground font-medium">A/C: {BANK_TRANSFER_DETAILS.accountNumber}</span>
                            <button
                              type="button"
                              className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium text-[10px]"
                              onClick={handleCopyAccount}
                              title="Copy account number"
                            >
                              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              {copied ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            A/C Name: {BANK_TRANSFER_DETAILS.accountName}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2">
                      <Button
                        type="button"
                        className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold flex items-center justify-center gap-2 shadow-sm"
                        onClick={handleWhatsAppClick}
                      >
                        <WhatsAppIcon className="w-4 h-4 fill-white" />
                        Contact Admin via WhatsApp
                      </Button>
                      <p className="text-[10px] text-muted-foreground text-center mt-1.5 italic">
                        Attach your slip in chat. Admin verifies and applies the plan update manually.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer: Informative & Read-Only */}
        <div className="p-4 sm:px-6 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground text-center sm:text-left">
            {!quote?.isEligible
              ? 'Select an eligible target plan to view quotes.'
              : isUpgrade
              ? `Estimated additional payment: ${formatAmount(quote.additionalAmountPayable, quote.currency)}`
              : isDowngrade
              ? `Effective at renewal on ${formatDate(quote.nextRenewalDate)}`
              : 'Current active plan.'}
          </div>

          <DialogFooter className="w-full sm:w-auto">
            <Button
              type="button"
              variant="default"
              className="w-full sm:w-auto px-6 font-semibold"
              onClick={() => handleOpenChange(false)}
            >
              Close Preview
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
