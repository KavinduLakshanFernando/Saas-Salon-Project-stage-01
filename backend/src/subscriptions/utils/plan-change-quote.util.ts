import { BillingCycle, SubscriptionStatus } from '@prisma/client';
import { getCurrentPeriodStart } from './subscription-billing.util';

export type PlanChangeTierType = 'upgrade' | 'downgrade' | 'same';

export interface PlanFeatureItem {
  code: string;
  name: string;
}

export interface PlanFeatureDiff {
  gained: PlanFeatureItem[];
  lost: PlanFeatureItem[];
  retained: PlanFeatureItem[];
}

export interface PlanChangeQuoteInput {
  currentPlan: {
    id: string;
    code: string;
    name: string;
    displayOrder: number;
    features?: PlanFeatureItem[];
  };
  currentSubscription: {
    id: string;
    status: SubscriptionStatus | string;
    billingCycle: BillingCycle | 'MONTHLY' | 'YEARLY';
    price: number | string | { toNumber?: () => number };
    currency: string;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    trialStart?: Date | string | null;
    trialEnd?: Date | string | null;
    nextBillingDate?: Date | string | null;
    cancelAtPeriodEnd?: boolean;
    cancelledAt?: Date | string | null;
    addOns?: Array<{
      id: string;
      featureId: string;
      name?: string;
      featureCode?: string;
      status: string;
      recurringAmount: number | string | { toNumber?: () => number };
      cancelAtPeriodEnd?: boolean;
    }>;
    actualEligiblePaidAmount?: number | null;
    billingCreditBalance?: number | string | { toNumber?: () => number };
  };
  targetPlan: {
    id: string;
    code: string;
    name: string;
    displayOrder: number;
    status: string;
    description?: string | null;
    features?: PlanFeatureItem[];
  };
  targetPlanPrice: {
    id: string;
    price: number | string | { toNumber?: () => number };
    currency: string;
    billingCycle: BillingCycle | 'MONTHLY' | 'YEARLY';
    compareAtPrice?: number | null;
    trialDays?: number;
    isActive: boolean;
  };
  asOf?: Date;
}

export interface PlanChangeQuoteResult {
  isEligible: boolean;
  quoteUnavailableReason?: string;
  tierChange: PlanChangeTierType;
  actionType:
    | 'UPGRADE_PAYMENT_REQUIRED'
    | 'DOWNGRADE_SCHEDULED_ON_RENEWAL'
    | 'DOWNGRADE_IMMEDIATE_WITH_CREDIT'
    | 'SAME_PLAN'
    | 'RENEWAL_REQUIRED'
    | 'UNAVAILABLE';

  // Plan Details
  currentPlan: {
    id: string;
    code: string;
    name: string;
    displayOrder: number;
    price: number;
    currency: string;
    billingCycle: string;
  };
  targetPlan: {
    id: string;
    code: string;
    name: string;
    displayOrder: number;
    price: number;
    currency: string;
    billingCycle: string;
  };

  // Billing Cycle Breakdown
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  totalDurationMs: number;
  totalDays: number;
  usedDurationMs: number;
  usedDays: number;
  remainingDurationMs: number;
  remainingDays: number;
  remainingRatio: number;
  remainingPercentage: number;

  // Prorated Amounts & Credit Adjustment
  actualEligiblePaidAmount: number;
  unusedCurrentPlanValue: number;
  newPlanRemainingCost: number;
  additionalAmountPayable: number;
  downgradeCredit: number;
  creditCarriedForward: number;
  existingCreditBalance: number;

  // Future Renewal
  nextRenewalDate: string | null;
  expectedNextRenewalBasePrice: number;
  expectedNextRenewalAddonsTotal: number;
  expectedNextRenewalTotal: number;
  nextRenewalPrice: number;
  finalNextRenewalPayableAmount: number;

  // Features Comparison
  featuresDiff: PlanFeatureDiff;

  // Informative UX Messages
  summaryMessage: string;
  effectiveDateExplanation: string;
}

/**
 * Safely converts numbers or decimal-like values into integer cents.
 */
export function parseAmountToCents(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return Math.round(val * 100);
  if (typeof val.toNumber === 'function') return Math.round(val.toNumber() * 100);
  const parsed = parseFloat(String(val));
  return isNaN(parsed) ? 0 : Math.round(parsed * 100);
}

/**
 * Formats integer cents into 2-decimal rounded number.
 */
export function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Compares two plan tiers using displayOrder, falling back to pricing if orders are identical.
 */
export function resolveTierChange(
  currentPlan: { id: string; displayOrder: number },
  targetPlan: { id: string; displayOrder: number },
  currentPriceCents: number,
  targetPriceCents: number,
): PlanChangeTierType {
  if (targetPlan.id === currentPlan.id) {
    return 'same';
  }
  if (targetPlan.displayOrder > currentPlan.displayOrder) {
    return 'upgrade';
  }
  if (targetPlan.displayOrder < currentPlan.displayOrder) {
    return 'downgrade';
  }
  if (targetPriceCents > currentPriceCents) {
    return 'upgrade';
  }
  if (targetPriceCents < currentPriceCents) {
    return 'downgrade';
  }
  return 'same';
}

/**
 * Computes feature differences (gained, lost, retained) between two plans.
 */
export function computePlanFeaturesDiff(
  currentFeatures: PlanFeatureItem[] = [],
  targetFeatures: PlanFeatureItem[] = [],
): PlanFeatureDiff {
  const currentMap = new Map(currentFeatures.map((f) => [f.code, f]));
  const targetMap = new Map(targetFeatures.map((f) => [f.code, f]));

  const gained: PlanFeatureItem[] = [];
  const lost: PlanFeatureItem[] = [];
  const retained: PlanFeatureItem[] = [];

  for (const [code, item] of targetMap.entries()) {
    if (currentMap.has(code)) {
      retained.push(item);
    } else {
      gained.push(item);
    }
  }

  for (const [code, item] of currentMap.entries()) {
    if (!targetMap.has(code)) {
      lost.push(item);
    }
  }

  return { gained, lost, retained };
}

/**
 * Pure calculation engine for subscription plan-change quote and prorated billing preview.
 * Strictly read-only, decimal-safe integer cent arithmetic, and timestamp accurate.
 */
export function calculatePlanChangeQuote(input: PlanChangeQuoteInput): PlanChangeQuoteResult {
  const { currentPlan, currentSubscription, targetPlan, targetPlanPrice } = input;
  const asOf = input.asOf ? new Date(input.asOf) : new Date();

  const currentPriceCents = parseAmountToCents(currentSubscription.price);
  const targetPriceCents = parseAmountToCents(targetPlanPrice.price);
  const currency = targetPlanPrice.currency || currentSubscription.currency || 'LKR';

  const tierChange = resolveTierChange(
    currentPlan,
    targetPlan,
    currentPriceCents,
    targetPriceCents,
  );

  const featuresDiff = computePlanFeaturesDiff(currentPlan.features, targetPlan.features);

  const existingCreditCents = parseAmountToCents(currentSubscription.billingCreditBalance ?? 0);
  const existingCreditAmount = centsToAmount(existingCreditCents);

  const baseResult: Omit<
    PlanChangeQuoteResult,
    | 'isEligible'
    | 'quoteUnavailableReason'
    | 'actionType'
    | 'periodStart'
    | 'periodEnd'
    | 'totalDurationMs'
    | 'totalDays'
    | 'usedDurationMs'
    | 'usedDays'
    | 'remainingDurationMs'
    | 'remainingDays'
    | 'remainingRatio'
    | 'remainingPercentage'
    | 'actualEligiblePaidAmount'
    | 'unusedCurrentPlanValue'
    | 'newPlanRemainingCost'
    | 'additionalAmountPayable'
    | 'nextRenewalDate'
    | 'expectedNextRenewalBasePrice'
    | 'expectedNextRenewalAddonsTotal'
    | 'expectedNextRenewalTotal'
    | 'summaryMessage'
    | 'effectiveDateExplanation'
  > = {
    tierChange,
    currentPlan: {
      id: currentPlan.id,
      code: currentPlan.code,
      name: currentPlan.name,
      displayOrder: currentPlan.displayOrder,
      price: centsToAmount(currentPriceCents),
      currency: currentSubscription.currency || currency,
      billingCycle: String(currentSubscription.billingCycle),
    },
    targetPlan: {
      id: targetPlan.id,
      code: targetPlan.code,
      name: targetPlan.name,
      displayOrder: targetPlan.displayOrder,
      price: centsToAmount(targetPriceCents),
      currency,
      billingCycle: String(targetPlanPrice.billingCycle),
    },
    currency,
    featuresDiff,
    downgradeCredit: 0,
    creditCarriedForward: existingCreditAmount,
    existingCreditBalance: existingCreditAmount,
    nextRenewalPrice: centsToAmount(targetPriceCents),
    finalNextRenewalPayableAmount: Math.max(0, centsToAmount(targetPriceCents - existingCreditCents)),
  };

  // 1. Target Plan Active Check
  if (targetPlan.status !== 'ACTIVE' || !targetPlanPrice.isActive) {
    return {
      ...baseResult,
      isEligible: false,
      quoteUnavailableReason: 'The selected target plan or pricing tier is currently inactive.',
      actionType: 'UNAVAILABLE',
      periodStart: null,
      periodEnd: null,
      totalDurationMs: 0,
      totalDays: 0,
      usedDurationMs: 0,
      usedDays: 0,
      remainingDurationMs: 0,
      remainingDays: 0,
      remainingRatio: 0,
      remainingPercentage: 0,
      actualEligiblePaidAmount: 0,
      unusedCurrentPlanValue: 0,
      newPlanRemainingCost: 0,
      additionalAmountPayable: 0,
      nextRenewalDate: null,
      expectedNextRenewalBasePrice: centsToAmount(targetPriceCents),
      expectedNextRenewalAddonsTotal: 0,
      expectedNextRenewalTotal: centsToAmount(targetPriceCents),
      summaryMessage: 'Target plan is unavailable.',
      effectiveDateExplanation: 'Cannot quote an inactive plan.',
    };
  }

  // 2. Same Plan Check
  if (tierChange === 'same' && currentSubscription.billingCycle === targetPlanPrice.billingCycle) {
    return {
      ...baseResult,
      isEligible: false,
      quoteUnavailableReason: 'You are currently subscribed to this plan with the same billing cycle.',
      actionType: 'SAME_PLAN',
      periodStart: currentSubscription.startDate ? new Date(currentSubscription.startDate).toISOString() : null,
      periodEnd: currentSubscription.endDate ? new Date(currentSubscription.endDate).toISOString() : null,
      totalDurationMs: 0,
      totalDays: 0,
      usedDurationMs: 0,
      usedDays: 0,
      remainingDurationMs: 0,
      remainingDays: 0,
      remainingRatio: 0,
      remainingPercentage: 0,
      actualEligiblePaidAmount: centsToAmount(currentPriceCents),
      unusedCurrentPlanValue: 0,
      newPlanRemainingCost: 0,
      additionalAmountPayable: 0,
      nextRenewalDate: currentSubscription.endDate ? new Date(currentSubscription.endDate).toISOString() : null,
      expectedNextRenewalBasePrice: centsToAmount(currentPriceCents),
      expectedNextRenewalAddonsTotal: 0,
      expectedNextRenewalTotal: centsToAmount(currentPriceCents),
      summaryMessage: 'Selected plan matches your current active plan.',
      effectiveDateExplanation: 'No changes required.',
    };
  }

  // 3. Subscription Status Checks
  const status = currentSubscription.status;
  if (status === SubscriptionStatus.PENDING) {
    return {
      ...baseResult,
      isEligible: false,
      quoteUnavailableReason:
        'Your current subscription is pending payment. Please complete initial activation before changing plans.',
      actionType: 'UNAVAILABLE',
      periodStart: null,
      periodEnd: null,
      totalDurationMs: 0,
      totalDays: 0,
      usedDurationMs: 0,
      usedDays: 0,
      remainingDurationMs: 0,
      remainingDays: 0,
      remainingRatio: 0,
      remainingPercentage: 0,
      actualEligiblePaidAmount: 0,
      unusedCurrentPlanValue: 0,
      newPlanRemainingCost: 0,
      additionalAmountPayable: 0,
      nextRenewalDate: null,
      expectedNextRenewalBasePrice: centsToAmount(targetPriceCents),
      expectedNextRenewalAddonsTotal: 0,
      expectedNextRenewalTotal: centsToAmount(targetPriceCents),
      summaryMessage: 'Subscription is pending initial payment.',
      effectiveDateExplanation: 'Initial payment is required before changing plans.',
    };
  }

  if (
    status === SubscriptionStatus.EXPIRED ||
    status === SubscriptionStatus.SUSPENDED ||
    status === SubscriptionStatus.PAST_DUE
  ) {
    return {
      ...baseResult,
      isEligible: false,
      quoteUnavailableReason:
        'Your subscription is currently expired or suspended. Prorated mid-cycle changes are unavailable. Please select your desired plan when renewing.',
      actionType: 'RENEWAL_REQUIRED',
      periodStart: currentSubscription.startDate ? new Date(currentSubscription.startDate).toISOString() : null,
      periodEnd: currentSubscription.endDate ? new Date(currentSubscription.endDate).toISOString() : null,
      totalDurationMs: 0,
      totalDays: 0,
      usedDurationMs: 0,
      usedDays: 0,
      remainingDurationMs: 0,
      remainingDays: 0,
      remainingRatio: 0,
      remainingPercentage: 0,
      actualEligiblePaidAmount: 0,
      unusedCurrentPlanValue: 0,
      newPlanRemainingCost: 0,
      additionalAmountPayable: 0,
      nextRenewalDate: null,
      expectedNextRenewalBasePrice: centsToAmount(targetPriceCents),
      expectedNextRenewalAddonsTotal: 0,
      expectedNextRenewalTotal: centsToAmount(targetPriceCents),
      summaryMessage: 'Subscription has expired or is suspended.',
      effectiveDateExplanation: 'Switching plans requires subscription renewal.',
    };
  }

  if (status === SubscriptionStatus.CANCELLED) {
    return {
      ...baseResult,
      isEligible: false,
      quoteUnavailableReason: 'This subscription has been permanently cancelled.',
      actionType: 'UNAVAILABLE',
      periodStart: null,
      periodEnd: null,
      totalDurationMs: 0,
      totalDays: 0,
      usedDurationMs: 0,
      usedDays: 0,
      remainingDurationMs: 0,
      remainingDays: 0,
      remainingRatio: 0,
      remainingPercentage: 0,
      actualEligiblePaidAmount: 0,
      unusedCurrentPlanValue: 0,
      newPlanRemainingCost: 0,
      additionalAmountPayable: 0,
      nextRenewalDate: null,
      expectedNextRenewalBasePrice: centsToAmount(targetPriceCents),
      expectedNextRenewalAddonsTotal: 0,
      expectedNextRenewalTotal: centsToAmount(targetPriceCents),
      summaryMessage: 'Subscription is cancelled.',
      effectiveDateExplanation: 'Cancelled subscriptions cannot be modified.',
    };
  }

  if (currentSubscription.cancelAtPeriodEnd) {
    return {
      ...baseResult,
      isEligible: false,
      quoteUnavailableReason:
        'Your subscription is scheduled for cancellation at the end of the billing period. To change plans, please undo cancellation first.',
      actionType: 'UNAVAILABLE',
      periodStart: currentSubscription.startDate ? new Date(currentSubscription.startDate).toISOString() : null,
      periodEnd: currentSubscription.endDate ? new Date(currentSubscription.endDate).toISOString() : null,
      totalDurationMs: 0,
      totalDays: 0,
      usedDurationMs: 0,
      usedDays: 0,
      remainingDurationMs: 0,
      remainingDays: 0,
      remainingRatio: 0,
      remainingPercentage: 0,
      actualEligiblePaidAmount: centsToAmount(currentPriceCents),
      unusedCurrentPlanValue: 0,
      newPlanRemainingCost: 0,
      additionalAmountPayable: 0,
      nextRenewalDate: currentSubscription.endDate ? new Date(currentSubscription.endDate).toISOString() : null,
      expectedNextRenewalBasePrice: centsToAmount(targetPriceCents),
      expectedNextRenewalAddonsTotal: 0,
      expectedNextRenewalTotal: centsToAmount(targetPriceCents),
      summaryMessage: 'Subscription is scheduled for cancellation.',
      effectiveDateExplanation: 'Undo scheduled cancellation to change plans.',
    };
  }

  // 4. Incompatible Billing Cycles Check
  if (currentSubscription.billingCycle !== targetPlanPrice.billingCycle) {
    return {
      ...baseResult,
      isEligible: false,
      quoteUnavailableReason: `Incompatible billing cycle: Mid-cycle change between ${currentSubscription.billingCycle} and ${targetPlanPrice.billingCycle} cannot be prorated automatically. Cycle changes can be made upon renewal.`,
      actionType: 'UNAVAILABLE',
      periodStart: currentSubscription.startDate ? new Date(currentSubscription.startDate).toISOString() : null,
      periodEnd: currentSubscription.endDate ? new Date(currentSubscription.endDate).toISOString() : null,
      totalDurationMs: 0,
      totalDays: 0,
      usedDurationMs: 0,
      usedDays: 0,
      remainingDurationMs: 0,
      remainingDays: 0,
      remainingRatio: 0,
      remainingPercentage: 0,
      actualEligiblePaidAmount: centsToAmount(currentPriceCents),
      unusedCurrentPlanValue: 0,
      newPlanRemainingCost: 0,
      additionalAmountPayable: 0,
      nextRenewalDate: currentSubscription.endDate ? new Date(currentSubscription.endDate).toISOString() : null,
      expectedNextRenewalBasePrice: centsToAmount(targetPriceCents),
      expectedNextRenewalAddonsTotal: 0,
      expectedNextRenewalTotal: centsToAmount(targetPriceCents),
      summaryMessage: 'Billing cycle mismatch. Incompatible for mid-cycle proration.',
      effectiveDateExplanation: `Select ${currentSubscription.billingCycle} to preview mid-cycle plan changes, or change cycles at renewal.`,
    };
  }

  // 5. Billing Period Dates Validation
  const rawEnd = currentSubscription.endDate ? new Date(currentSubscription.endDate) : null;
  if (!rawEnd || isNaN(rawEnd.getTime())) {
    return {
      ...baseResult,
      isEligible: false,
      quoteUnavailableReason: 'Missing subscription billing end date. A reliable prorated quote cannot be calculated.',
      actionType: 'UNAVAILABLE',
      periodStart: null,
      periodEnd: null,
      totalDurationMs: 0,
      totalDays: 0,
      usedDurationMs: 0,
      usedDays: 0,
      remainingDurationMs: 0,
      remainingDays: 0,
      remainingRatio: 0,
      remainingPercentage: 0,
      actualEligiblePaidAmount: 0,
      unusedCurrentPlanValue: 0,
      newPlanRemainingCost: 0,
      additionalAmountPayable: 0,
      nextRenewalDate: null,
      expectedNextRenewalBasePrice: centsToAmount(targetPriceCents),
      expectedNextRenewalAddonsTotal: 0,
      expectedNextRenewalTotal: centsToAmount(targetPriceCents),
      summaryMessage: 'Billing dates missing.',
      effectiveDateExplanation: 'Billing period end date is required.',
    };
  }

  const periodEnd = rawEnd;
  const cycle = currentSubscription.billingCycle as BillingCycle;
  const standardPeriodStart = getCurrentPeriodStart(periodEnd, cycle);

  let periodStart = standardPeriodStart;
  if (currentSubscription.startDate) {
    const rawStart = new Date(currentSubscription.startDate);
    if (!isNaN(rawStart.getTime()) && rawStart < periodEnd) {
      if (rawStart.getTime() > standardPeriodStart.getTime()) {
        periodStart = rawStart;
      }
    }
  }

  const totalDurationMs = periodEnd.getTime() - periodStart.getTime();
  if (totalDurationMs <= 0) {
    return {
      ...baseResult,
      isEligible: false,
      quoteUnavailableReason: 'Invalid billing period duration: Period end is not strictly after period start.',
      actionType: 'UNAVAILABLE',
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalDurationMs: 0,
      totalDays: 0,
      usedDurationMs: 0,
      usedDays: 0,
      remainingDurationMs: 0,
      remainingDays: 0,
      remainingRatio: 0,
      remainingPercentage: 0,
      actualEligiblePaidAmount: 0,
      unusedCurrentPlanValue: 0,
      newPlanRemainingCost: 0,
      additionalAmountPayable: 0,
      nextRenewalDate: null,
      expectedNextRenewalBasePrice: centsToAmount(targetPriceCents),
      expectedNextRenewalAddonsTotal: 0,
      expectedNextRenewalTotal: centsToAmount(targetPriceCents),
      summaryMessage: 'Invalid billing period duration.',
      effectiveDateExplanation: 'Billing period dates are corrupt.',
    };
  }

  // Check if period has already expired relative to asOf
  if (asOf.getTime() >= periodEnd.getTime()) {
    return {
      ...baseResult,
      isEligible: false,
      quoteUnavailableReason: 'Current billing period has already ended. Plan change must occur via subscription renewal.',
      actionType: 'RENEWAL_REQUIRED',
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalDurationMs,
      totalDays: Math.round(totalDurationMs / 86400000),
      usedDurationMs: totalDurationMs,
      usedDays: Math.round(totalDurationMs / 86400000),
      remainingDurationMs: 0,
      remainingDays: 0,
      remainingRatio: 0,
      remainingPercentage: 0,
      actualEligiblePaidAmount: centsToAmount(currentPriceCents),
      unusedCurrentPlanValue: 0,
      newPlanRemainingCost: 0,
      additionalAmountPayable: 0,
      nextRenewalDate: periodEnd.toISOString(),
      expectedNextRenewalBasePrice: centsToAmount(targetPriceCents),
      expectedNextRenewalAddonsTotal: 0,
      expectedNextRenewalTotal: centsToAmount(targetPriceCents),
      summaryMessage: 'Current billing period has elapsed.',
      effectiveDateExplanation: 'Please renew to activate a new plan.',
    };
  }

  // 6. Calculate exact timestamps, durations, and remaining ratio
  const usedDurationMs = Math.max(0, Math.min(totalDurationMs, asOf.getTime() - periodStart.getTime()));
  const remainingDurationMs = Math.max(0, Math.min(totalDurationMs, periodEnd.getTime() - asOf.getTime()));

  const totalDays = Math.round(totalDurationMs / 86400000);
  const usedDays = Math.floor(usedDurationMs / 86400000);
  const remainingDays = Math.ceil(remainingDurationMs / 86400000);

  const remainingRatio = remainingDurationMs / totalDurationMs;
  const remainingPercentage = Math.round(remainingRatio * 10000) / 100;

  // 7. Calculate Monetary Values using Decimal-Safe Integer Cents
  // Eligible paid amount: Respects custom actual paid amount if provided (e.g. promo/discounts),
  // falling back to the current plan base subscription price.
  // For TRIAL subscriptions, paid amount is 0.
  const isTrial = currentSubscription.status === SubscriptionStatus.TRIAL;
  const eligiblePaidCents = isTrial
    ? 0
    : parseAmountToCents(
        currentSubscription.actualEligiblePaidAmount !== undefined &&
          currentSubscription.actualEligiblePaidAmount !== null
          ? currentSubscription.actualEligiblePaidAmount
          : currentSubscription.price,
      );

  // Exact formulas:
  // Unused Current Plan Value = Actual Eligible Paid Amount × Remaining Time / Total Billing Period
  // New Plan Remaining Cost = Applicable New Plan Price × Remaining Time / Total Billing Period
  // Additional Payment = MAX(0, New Plan Remaining Cost − Unused Current Plan Value)
  const unusedCurrentPlanValueCents = Math.round(eligiblePaidCents * remainingRatio);
  const newPlanRemainingCostCents = Math.round(targetPriceCents * remainingRatio);

  let additionalPaymentCents = 0;
  let downgradeCreditCents = 0;
  let creditCarriedForwardCents = existingCreditCents;

  if (tierChange === 'upgrade') {
    const rawUpgradePayableCents = Math.max(0, newPlanRemainingCostCents - unusedCurrentPlanValueCents);
    const creditOffsetCents = Math.min(existingCreditCents, rawUpgradePayableCents);
    additionalPaymentCents = rawUpgradePayableCents - creditOffsetCents;
    creditCarriedForwardCents = existingCreditCents - creditOffsetCents;
  } else if (tierChange === 'downgrade') {
    downgradeCreditCents = Math.max(0, unusedCurrentPlanValueCents - newPlanRemainingCostCents);
    creditCarriedForwardCents = existingCreditCents + downgradeCreditCents;
    additionalPaymentCents = 0;
  }

  // 8. Expected Next Renewal Amount Calculation (including continuing active add-ons)
  const targetFeatureCodes = new Set((targetPlan.features ?? []).map((f) => f.code));
  let continuingAddonsCents = 0;

  if (currentSubscription.addOns && currentSubscription.addOns.length > 0) {
    for (const addon of currentSubscription.addOns) {
      if (addon.status === 'ACTIVE' && !addon.cancelAtPeriodEnd) {
        // If the new plan includes this feature, the add-on is absorbed and excluded from renewal
        if (addon.featureCode && targetFeatureCodes.has(addon.featureCode)) {
          continue;
        }
        continuingAddonsCents += parseAmountToCents(addon.recurringAmount);
      }
    }
  }

  const expectedNextRenewalBasePriceCents = targetPriceCents;
  const expectedNextRenewalTotalCents = expectedNextRenewalBasePriceCents + continuingAddonsCents;
  const renewalCreditDeductionCents = Math.min(expectedNextRenewalTotalCents, creditCarriedForwardCents);
  const finalNextRenewalPayableCents = Math.max(0, expectedNextRenewalTotalCents - renewalCreditDeductionCents);

  // 9. Format Summary and Explanations
  let summaryMessage = '';
  let effectiveDateExplanation = '';
  let actionType: PlanChangeQuoteResult['actionType'] = 'UPGRADE_PAYMENT_REQUIRED';

  if (tierChange === 'upgrade') {
    actionType = 'UPGRADE_PAYMENT_REQUIRED';
    summaryMessage = `Upgrade to ${targetPlan.name} for the remaining ${remainingDays} days of your current billing period.`;
    effectiveDateExplanation = `Upgrades take effect immediately upon payment confirmation. An additional prorated payment of ${currency} ${centsToAmount(
      additionalPaymentCents,
    ).toFixed(2)} is required for the remaining ${remainingDays} days.`;
  } else if (tierChange === 'downgrade') {
    actionType = 'DOWNGRADE_SCHEDULED_ON_RENEWAL';
    summaryMessage = `Downgrade to ${targetPlan.name} with ${currency} ${centsToAmount(
      creditCarriedForwardCents,
    ).toFixed(2)} billing credit.`;
    effectiveDateExplanation = `Your plan switches to ${targetPlan.name} immediately while preserving your renewal date (${periodEnd.toLocaleDateString()}). Unused paid value (${currency} ${centsToAmount(
      unusedCurrentPlanValueCents,
    ).toFixed(2)}) minus ${targetPlan.name} cost for the remaining ${remainingDays} days (${currency} ${centsToAmount(
      newPlanRemainingCostCents,
    ).toFixed(2)}) leaves ${currency} ${centsToAmount(
      creditCarriedForwardCents,
    ).toFixed(2)} in subscription billing credit. No immediate payment or refund is issued. This credit will reduce your next renewal payment from ${currency} ${centsToAmount(
      expectedNextRenewalTotalCents,
    ).toFixed(2)} to ${currency} ${centsToAmount(
      finalNextRenewalPayableCents,
    ).toFixed(2)}.`;
  } else {
    actionType = 'SAME_PLAN';
    summaryMessage = `You are already on the ${currentPlan.name} plan.`;
    effectiveDateExplanation = 'No changes required.';
  }

  return {
    ...baseResult,
    isEligible: true,
    actionType,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalDurationMs,
    totalDays,
    usedDurationMs,
    usedDays,
    remainingDurationMs,
    remainingDays,
    remainingRatio: Math.round(remainingRatio * 1000000) / 1000000,
    remainingPercentage,
    actualEligiblePaidAmount: centsToAmount(eligiblePaidCents),
    unusedCurrentPlanValue: centsToAmount(unusedCurrentPlanValueCents),
    newPlanRemainingCost: centsToAmount(newPlanRemainingCostCents),
    additionalAmountPayable: centsToAmount(additionalPaymentCents),
    downgradeCredit: centsToAmount(downgradeCreditCents),
    creditCarriedForward: centsToAmount(creditCarriedForwardCents),
    existingCreditBalance: centsToAmount(existingCreditCents),
    nextRenewalDate: periodEnd.toISOString(),
    expectedNextRenewalBasePrice: centsToAmount(expectedNextRenewalBasePriceCents),
    expectedNextRenewalAddonsTotal: centsToAmount(continuingAddonsCents),
    expectedNextRenewalTotal: centsToAmount(expectedNextRenewalTotalCents),
    nextRenewalPrice: centsToAmount(expectedNextRenewalTotalCents),
    finalNextRenewalPayableAmount: centsToAmount(finalNextRenewalPayableCents),
    summaryMessage,
    effectiveDateExplanation,
  };
}
