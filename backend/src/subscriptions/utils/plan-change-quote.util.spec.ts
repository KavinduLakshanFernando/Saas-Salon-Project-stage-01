import { BillingCycle, SubscriptionStatus } from '@prisma/client';
import {
  calculatePlanChangeQuote,
  computePlanFeaturesDiff,
  parseAmountToCents,
  resolveTierChange,
} from './plan-change-quote.util';

describe('plan-change-quote.util', () => {
  const silverPlan = {
    id: 'plan-silver-id',
    code: 'SILVER',
    name: 'Silver Plan',
    displayOrder: 1,
    status: 'ACTIVE',
    features: [
      { code: 'APPOINTMENTS', name: 'Appointments' },
      { code: 'CUSTOMERS', name: 'Customers' },
      { code: 'POS', name: 'Point of Sale' },
    ],
  };

  const goldPlan = {
    id: 'plan-gold-id',
    code: 'GOLD',
    name: 'Gold Plan',
    displayOrder: 2,
    status: 'ACTIVE',
    features: [
      { code: 'APPOINTMENTS', name: 'Appointments' },
      { code: 'CUSTOMERS', name: 'Customers' },
      { code: 'POS', name: 'Point of Sale' },
      { code: 'INVENTORY', name: 'Inventory' },
      { code: 'STAFF_MANAGEMENT', name: 'Staff Management' },
    ],
  };

  const platinumPlan = {
    id: 'plan-platinum-id',
    code: 'PLATINUM',
    name: 'Platinum Plan',
    displayOrder: 3,
    status: 'ACTIVE',
    features: [
      { code: 'APPOINTMENTS', name: 'Appointments' },
      { code: 'CUSTOMERS', name: 'Customers' },
      { code: 'POS', name: 'Point of Sale' },
      { code: 'INVENTORY', name: 'Inventory' },
      { code: 'STAFF_MANAGEMENT', name: 'Staff Management' },
      { code: 'MULTI_BRANCH', name: 'Multi Branch' },
      { code: 'ANALYTICS', name: 'Analytics' },
    ],
  };

  describe('parseAmountToCents', () => {
    it('accurately parses float numbers and prevents floating point drift', () => {
      expect(parseAmountToCents(4800.5)).toBe(480050);
      expect(parseAmountToCents('4800.50')).toBe(480050);
      expect(parseAmountToCents({ toNumber: () => 9600 })).toBe(960000);
      expect(parseAmountToCents(null)).toBe(0);
      expect(parseAmountToCents(undefined)).toBe(0);
    });
  });

  describe('resolveTierChange', () => {
    it('correctly identifies upgrades based on displayOrder', () => {
      expect(resolveTierChange(silverPlan, goldPlan, 480000, 960000)).toBe('upgrade');
    });

    it('correctly identifies downgrades based on displayOrder', () => {
      expect(resolveTierChange(platinumPlan, goldPlan, 2500000, 960000)).toBe('downgrade');
    });

    it('identifies same plan', () => {
      expect(resolveTierChange(goldPlan, goldPlan, 960000, 960000)).toBe('same');
    });
  });

  describe('computePlanFeaturesDiff', () => {
    it('accurately categorizes gained, lost, and retained features', () => {
      const diff = computePlanFeaturesDiff(silverPlan.features, goldPlan.features);
      expect(diff.retained.map((f) => f.code)).toEqual(['APPOINTMENTS', 'CUSTOMERS', 'POS']);
      expect(diff.gained.map((f) => f.code)).toEqual(['INVENTORY', 'STAFF_MANAGEMENT']);
      expect(diff.lost).toEqual([]);

      const reverseDiff = computePlanFeaturesDiff(goldPlan.features, silverPlan.features);
      expect(reverseDiff.lost.map((f) => f.code)).toEqual(['INVENTORY', 'STAFF_MANAGEMENT']);
      expect(reverseDiff.gained).toEqual([]);
    });
  });

  describe('calculatePlanChangeQuote: Upgrades', () => {
    const periodStart = new Date('2026-10-01T00:00:00.000Z');
    const periodEnd = new Date('2026-10-31T00:00:00.000Z'); // 30 days total = 2,592,000,000 ms

    it('calculates upgrade at the beginning of a billing cycle (100% remaining)', () => {
      const result = calculatePlanChangeQuote({
        currentPlan: silverPlan,
        currentSubscription: {
          id: 'sub-1',
          status: SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.MONTHLY,
          price: 4800,
          currency: 'LKR',
          startDate: periodStart,
          endDate: periodEnd,
        },
        targetPlan: goldPlan,
        targetPlanPrice: {
          id: 'price-gold-monthly',
          price: 9600,
          currency: 'LKR',
          billingCycle: BillingCycle.MONTHLY,
          isActive: true,
        },
        asOf: periodStart, // Day 0
      });

      expect(result.isEligible).toBe(true);
      expect(result.tierChange).toBe('upgrade');
      expect(result.actionType).toBe('UPGRADE_PAYMENT_REQUIRED');
      expect(result.actualEligiblePaidAmount).toBe(4800);
      expect(result.unusedCurrentPlanValue).toBe(4800);
      expect(result.newPlanRemainingCost).toBe(9600);
      expect(result.additionalAmountPayable).toBe(4800); // 9600 - 4800
      expect(result.remainingDays).toBe(30);
      expect(result.nextRenewalDate).toBe(periodEnd.toISOString());
      expect(result.expectedNextRenewalTotal).toBe(9600);
      expect(result.featuresDiff.gained.map((f) => f.code)).toContain('INVENTORY');
    });

    it('calculates upgrade in the middle of a billing cycle (exactly 50% remaining)', () => {
      const totalMs = periodEnd.getTime() - periodStart.getTime();
      const halfWay = new Date(periodStart.getTime() + totalMs / 2);

      const result = calculatePlanChangeQuote({
        currentPlan: silverPlan,
        currentSubscription: {
          id: 'sub-1',
          status: SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.MONTHLY,
          price: 4800,
          currency: 'LKR',
          startDate: periodStart,
          endDate: periodEnd,
        },
        targetPlan: goldPlan,
        targetPlanPrice: {
          id: 'price-gold-monthly',
          price: 9600,
          currency: 'LKR',
          billingCycle: BillingCycle.MONTHLY,
          isActive: true,
        },
        asOf: halfWay,
      });

      expect(result.isEligible).toBe(true);
      expect(result.remainingRatio).toBe(0.5);
      expect(result.remainingPercentage).toBe(50);
      expect(result.unusedCurrentPlanValue).toBe(2400); // 4800 * 0.5
      expect(result.newPlanRemainingCost).toBe(4800); // 9600 * 0.5
      expect(result.additionalAmountPayable).toBe(2400); // 4800 - 2400
    });

    it('calculates upgrade near the end of a billing cycle (10 days remaining out of 30 days)', () => {
      // 20 days used, 10 days remaining
      const asOf = new Date(periodStart.getTime() + 20 * 86400000);

      const result = calculatePlanChangeQuote({
        currentPlan: silverPlan,
        currentSubscription: {
          id: 'sub-1',
          status: SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.MONTHLY,
          price: 3000,
          currency: 'LKR',
          startDate: periodStart,
          endDate: periodEnd,
        },
        targetPlan: goldPlan,
        targetPlanPrice: {
          id: 'price-gold-monthly',
          price: 6000,
          currency: 'LKR',
          billingCycle: BillingCycle.MONTHLY,
          isActive: true,
        },
        asOf,
      });

      expect(result.isEligible).toBe(true);
      expect(result.remainingDays).toBe(10);
      // ratio: 10 / 30 = 1/3
      expect(result.unusedCurrentPlanValue).toBe(1000);
      expect(result.newPlanRemainingCost).toBe(2000);
      expect(result.additionalAmountPayable).toBe(1000);
    });

    it('handles yearly subscription upgrades accurately', () => {
      const yearStart = new Date('2026-01-01T00:00:00.000Z');
      const yearEnd = new Date('2027-01-01T00:00:00.000Z');
      const totalMs = yearEnd.getTime() - yearStart.getTime();
      const midYear = new Date(yearStart.getTime() + totalMs / 2);

      const result = calculatePlanChangeQuote({
        currentPlan: silverPlan,
        currentSubscription: {
          id: 'sub-1',
          status: SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.YEARLY,
          price: 48000,
          currency: 'LKR',
          startDate: yearStart,
          endDate: yearEnd,
        },
        targetPlan: goldPlan,
        targetPlanPrice: {
          id: 'price-gold-yearly',
          price: 96000,
          currency: 'LKR',
          billingCycle: BillingCycle.YEARLY,
          isActive: true,
        },
        asOf: midYear,
      });

      expect(result.isEligible).toBe(true);
      expect(result.remainingRatio).toBe(0.5);
      expect(result.unusedCurrentPlanValue).toBe(24000);
      expect(result.newPlanRemainingCost).toBe(48000);
      expect(result.additionalAmountPayable).toBe(24000);
    });

    it('respects previous discounts on current plan (actualEligiblePaidAmount)', () => {
      const totalMs = periodEnd.getTime() - periodStart.getTime();
      const halfWay = new Date(periodStart.getTime() + totalMs / 2);

      // Customer base plan catalog price is 4800, but they paid 3000 due to a discount
      const result = calculatePlanChangeQuote({
        currentPlan: silverPlan,
        currentSubscription: {
          id: 'sub-1',
          status: SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.MONTHLY,
          price: 4800,
          actualEligiblePaidAmount: 3000, // discounted actual paid amount
          currency: 'LKR',
          startDate: periodStart,
          endDate: periodEnd,
        },
        targetPlan: goldPlan,
        targetPlanPrice: {
          id: 'price-gold-monthly',
          price: 9600,
          currency: 'LKR',
          billingCycle: BillingCycle.MONTHLY,
          isActive: true,
        },
        asOf: halfWay,
      });

      expect(result.isEligible).toBe(true);
      expect(result.actualEligiblePaidAmount).toBe(3000);
      expect(result.unusedCurrentPlanValue).toBe(1500); // 3000 * 0.5
      expect(result.newPlanRemainingCost).toBe(4800); // 9600 * 0.5
      expect(result.additionalAmountPayable).toBe(3300); // 4800 - 1500
    });

    it('accounts for continuing active add-ons in expected next renewal total', () => {
      const result = calculatePlanChangeQuote({
        currentPlan: silverPlan,
        currentSubscription: {
          id: 'sub-1',
          status: SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.MONTHLY,
          price: 4800,
          currency: 'LKR',
          startDate: periodStart,
          endDate: periodEnd,
          addOns: [
            // Addon for SMS_NOTIFICATIONS which is NOT included in goldPlan
            {
              id: 'addon-1',
              featureId: 'feat-sms',
              featureCode: 'SMS_NOTIFICATIONS',
              status: 'ACTIVE',
              recurringAmount: 1500,
              cancelAtPeriodEnd: false,
            },
            // Addon for INVENTORY which IS included in goldPlan (should be excluded from renewal)
            {
              id: 'addon-2',
              featureId: 'feat-inv',
              featureCode: 'INVENTORY',
              status: 'ACTIVE',
              recurringAmount: 1000,
              cancelAtPeriodEnd: false,
            },
            // Addon scheduled for cancellation (should be excluded from renewal)
            {
              id: 'addon-3',
              featureId: 'feat-other',
              featureCode: 'CUSTOM_BRANDING',
              status: 'ACTIVE',
              recurringAmount: 500,
              cancelAtPeriodEnd: true,
            },
          ],
        },
        targetPlan: goldPlan,
        targetPlanPrice: {
          id: 'price-gold-monthly',
          price: 9600,
          currency: 'LKR',
          billingCycle: BillingCycle.MONTHLY,
          isActive: true,
        },
        asOf: periodStart,
      });

      expect(result.isEligible).toBe(true);
      expect(result.expectedNextRenewalBasePrice).toBe(9600);
      expect(result.expectedNextRenewalAddonsTotal).toBe(1500); // only SMS_NOTIFICATIONS continues
      expect(result.expectedNextRenewalTotal).toBe(11100); // 9600 + 1500
    });
  });

  describe('calculatePlanChangeQuote: Downgrades', () => {
    const periodStart = new Date('2026-10-01T00:00:00.000Z');
    const periodEnd = new Date('2026-10-31T00:00:00.000Z');
    const halfWay = new Date('2026-10-16T00:00:00.000Z');

    it('previews a downgrade without immediate payment or refund', () => {
      const result = calculatePlanChangeQuote({
        currentPlan: goldPlan,
        currentSubscription: {
          id: 'sub-gold',
          status: SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.MONTHLY,
          price: 9600,
          currency: 'LKR',
          startDate: periodStart,
          endDate: periodEnd,
        },
        targetPlan: silverPlan,
        targetPlanPrice: {
          id: 'price-silver-monthly',
          price: 4800,
          currency: 'LKR',
          billingCycle: BillingCycle.MONTHLY,
          isActive: true,
        },
        asOf: halfWay,
      });

      expect(result.isEligible).toBe(true);
      expect(result.tierChange).toBe('downgrade');
      expect(result.actionType).toBe('DOWNGRADE_SCHEDULED_ON_RENEWAL');
      expect(result.additionalAmountPayable).toBe(0); // No immediate charge
      expect(result.nextRenewalDate).toBe(periodEnd.toISOString());
      expect(result.expectedNextRenewalTotal).toBe(4800);
      expect(result.featuresDiff.lost.map((f) => f.code)).toEqual(['INVENTORY', 'STAFF_MANAGEMENT']);
      expect(result.effectiveDateExplanation).toContain('No immediate payment or refund is issued');
    });
  });

  describe('calculatePlanChangeQuote: Edge Cases & Guards', () => {
    const periodStart = new Date('2026-10-01T00:00:00.000Z');
    const periodEnd = new Date('2026-10-31T00:00:00.000Z');

    it('rejects same plan selection with clean explanation', () => {
      const result = calculatePlanChangeQuote({
        currentPlan: goldPlan,
        currentSubscription: {
          id: 'sub-gold',
          status: SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.MONTHLY,
          price: 9600,
          currency: 'LKR',
          startDate: periodStart,
          endDate: periodEnd,
        },
        targetPlan: goldPlan,
        targetPlanPrice: {
          id: 'price-gold-monthly',
          price: 9600,
          currency: 'LKR',
          billingCycle: BillingCycle.MONTHLY,
          isActive: true,
        },
      });

      expect(result.isEligible).toBe(false);
      expect(result.actionType).toBe('SAME_PLAN');
      expect(result.quoteUnavailableReason).toContain('subscribed to this plan');
    });

    it('safely handles expired subscriptions', () => {
      const pastEnd = new Date('2026-09-01T00:00:00.000Z');
      const result = calculatePlanChangeQuote({
        currentPlan: silverPlan,
        currentSubscription: {
          id: 'sub-expired',
          status: SubscriptionStatus.EXPIRED,
          billingCycle: BillingCycle.MONTHLY,
          price: 4800,
          currency: 'LKR',
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          endDate: pastEnd,
        },
        targetPlan: goldPlan,
        targetPlanPrice: {
          id: 'price-gold-monthly',
          price: 9600,
          currency: 'LKR',
          billingCycle: BillingCycle.MONTHLY,
          isActive: true,
        },
      });

      expect(result.isEligible).toBe(false);
      expect(result.actionType).toBe('RENEWAL_REQUIRED');
      expect(result.quoteUnavailableReason).toContain('expired or suspended');
    });

    it('safely handles pending unpaid subscriptions', () => {
      const result = calculatePlanChangeQuote({
        currentPlan: silverPlan,
        currentSubscription: {
          id: 'sub-pending',
          status: SubscriptionStatus.PENDING,
          billingCycle: BillingCycle.MONTHLY,
          price: 4800,
          currency: 'LKR',
        },
        targetPlan: goldPlan,
        targetPlanPrice: {
          id: 'price-gold-monthly',
          price: 9600,
          currency: 'LKR',
          billingCycle: BillingCycle.MONTHLY,
          isActive: true,
        },
      });

      expect(result.isEligible).toBe(false);
      expect(result.quoteUnavailableReason).toContain('pending payment');
    });

    it('safely handles subscriptions scheduled for cancellation', () => {
      const result = calculatePlanChangeQuote({
        currentPlan: silverPlan,
        currentSubscription: {
          id: 'sub-cancelling',
          status: SubscriptionStatus.ACTIVE,
          cancelAtPeriodEnd: true,
          billingCycle: BillingCycle.MONTHLY,
          price: 4800,
          currency: 'LKR',
          startDate: periodStart,
          endDate: periodEnd,
        },
        targetPlan: goldPlan,
        targetPlanPrice: {
          id: 'price-gold-monthly',
          price: 9600,
          currency: 'LKR',
          billingCycle: BillingCycle.MONTHLY,
          isActive: true,
        },
      });

      expect(result.isEligible).toBe(false);
      expect(result.quoteUnavailableReason).toContain('scheduled for cancellation');
    });

    it('rejects incompatible billing cycles (e.g. Monthly to Yearly mid-cycle) with clear explanation', () => {
      const result = calculatePlanChangeQuote({
        currentPlan: silverPlan,
        currentSubscription: {
          id: 'sub-monthly',
          status: SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.MONTHLY,
          price: 4800,
          currency: 'LKR',
          startDate: periodStart,
          endDate: periodEnd,
        },
        targetPlan: goldPlan,
        targetPlanPrice: {
          id: 'price-gold-yearly',
          price: 96000,
          currency: 'LKR',
          billingCycle: BillingCycle.YEARLY, // Incompatible with MONTHLY mid-cycle
          isActive: true,
        },
      });

      expect(result.isEligible).toBe(false);
      expect(result.quoteUnavailableReason).toContain('Incompatible billing cycle');
    });

    it('handles inactive target plans', () => {
      const result = calculatePlanChangeQuote({
        currentPlan: silverPlan,
        currentSubscription: {
          id: 'sub-active',
          status: SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.MONTHLY,
          price: 4800,
          currency: 'LKR',
          startDate: periodStart,
          endDate: periodEnd,
        },
        targetPlan: {
          ...goldPlan,
          status: 'INACTIVE',
        },
        targetPlanPrice: {
          id: 'price-gold-monthly',
          price: 9600,
          currency: 'LKR',
          billingCycle: BillingCycle.MONTHLY,
          isActive: false,
        },
      });

      expect(result.isEligible).toBe(false);
      expect(result.quoteUnavailableReason).toContain('inactive');
    });

    it('handles missing billing end dates gracefully', () => {
      const result = calculatePlanChangeQuote({
        currentPlan: silverPlan,
        currentSubscription: {
          id: 'sub-corrupt',
          status: SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.MONTHLY,
          price: 4800,
          currency: 'LKR',
          startDate: periodStart,
          endDate: null,
        },
        targetPlan: goldPlan,
        targetPlanPrice: {
          id: 'price-gold-monthly',
          price: 9600,
          currency: 'LKR',
          billingCycle: BillingCycle.MONTHLY,
          isActive: true,
        },
      });

      expect(result.isEligible).toBe(false);
      expect(result.quoteUnavailableReason).toContain('Missing subscription billing end date');
    });
  });

  describe('calculatePlanChangeQuote: Downgrade Credit Adjustments', () => {
    const periodStart = new Date('2026-10-01T00:00:00.000Z');
    const periodEnd = new Date('2026-10-31T00:00:00.000Z'); // 30 days total
    const halfWay = new Date('2026-10-16T00:00:00.000Z'); // Exactly 15 days remaining (ratio = 0.5)

    it('calculates Gold to Silver downgrade with 15 days remaining and generates LKR 2400 credit', () => {
      const result = calculatePlanChangeQuote({
        currentPlan: goldPlan,
        currentSubscription: {
          id: 'sub-gold-15d',
          status: SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.MONTHLY,
          price: 9600,
          currency: 'LKR',
          startDate: periodStart,
          endDate: periodEnd,
        },
        targetPlan: silverPlan,
        targetPlanPrice: {
          id: 'price-silver-monthly',
          price: 4800,
          currency: 'LKR',
          billingCycle: BillingCycle.MONTHLY,
          isActive: true,
        },
        asOf: halfWay,
      });

      expect(result.isEligible).toBe(true);
      expect(result.tierChange).toBe('downgrade');
      expect(result.remainingDays).toBe(15);
      expect(result.remainingRatio).toBe(0.5);
      expect(result.unusedCurrentPlanValue).toBe(4800);
      expect(result.newPlanRemainingCost).toBe(2400);
      expect(result.downgradeCredit).toBe(2400);
      expect(result.creditCarriedForward).toBe(2400);
      expect(result.expectedNextRenewalTotal).toBe(4800);
      expect(result.nextRenewalPrice).toBe(4800);
      expect(result.finalNextRenewalPayableAmount).toBe(2400); // 4800 - 2400 credit
      expect(result.additionalAmountPayable).toBe(0);
    });

    it('handles credit exceeding next renewal amount and carries forward remainder', () => {
      const result = calculatePlanChangeQuote({
        currentPlan: goldPlan,
        currentSubscription: {
          id: 'sub-gold-excess-credit',
          status: SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.MONTHLY,
          price: 9600,
          currency: 'LKR',
          startDate: periodStart,
          endDate: periodEnd,
          billingCreditBalance: 3000, // existing credit
        },
        targetPlan: silverPlan,
        targetPlanPrice: {
          id: 'price-silver-monthly',
          price: 4800,
          currency: 'LKR',
          billingCycle: BillingCycle.MONTHLY,
          isActive: true,
        },
        asOf: halfWay,
      });

      expect(result.isEligible).toBe(true);
      expect(result.downgradeCredit).toBe(2400);
      // Total credit = 3000 (existing) + 2400 (new downgrade credit) = 5400
      expect(result.creditCarriedForward).toBe(5400);
      expect(result.nextRenewalPrice).toBe(4800);
      // Next renewal is fully covered by credit, payable is 0
      expect(result.finalNextRenewalPayableAmount).toBe(0);
    });

    it('does not issue downgrade credits for unpaid trial subscriptions', () => {
      const result = calculatePlanChangeQuote({
        currentPlan: goldPlan,
        currentSubscription: {
          id: 'sub-gold-trial',
          status: SubscriptionStatus.TRIAL,
          billingCycle: BillingCycle.MONTHLY,
          price: 9600,
          currency: 'LKR',
          startDate: periodStart,
          endDate: periodEnd,
        },
        targetPlan: silverPlan,
        targetPlanPrice: {
          id: 'price-silver-monthly',
          price: 4800,
          currency: 'LKR',
          billingCycle: BillingCycle.MONTHLY,
          isActive: true,
        },
        asOf: halfWay,
      });

      expect(result.isEligible).toBe(true);
      expect(result.actualEligiblePaidAmount).toBe(0);
      expect(result.unusedCurrentPlanValue).toBe(0);
      expect(result.downgradeCredit).toBe(0);
      expect(result.creditCarriedForward).toBe(0);
      expect(result.finalNextRenewalPayableAmount).toBe(4800);
    });

    it('allows accumulated credit from earlier downgrade to offset subsequent upgrade', () => {
      // Salon is on Silver (4800), has 2400 billingCreditBalance from a previous downgrade
      const result = calculatePlanChangeQuote({
        currentPlan: silverPlan,
        currentSubscription: {
          id: 'sub-silver-upgrading',
          status: SubscriptionStatus.ACTIVE,
          billingCycle: BillingCycle.MONTHLY,
          price: 4800,
          currency: 'LKR',
          startDate: periodStart,
          endDate: periodEnd,
          billingCreditBalance: 2400,
        },
        targetPlan: goldPlan,
        targetPlanPrice: {
          id: 'price-gold-monthly',
          price: 9600,
          currency: 'LKR',
          billingCycle: BillingCycle.MONTHLY,
          isActive: true,
        },
        asOf: halfWay,
      });

      expect(result.isEligible).toBe(true);
      expect(result.tierChange).toBe('upgrade');
      expect(result.unusedCurrentPlanValue).toBe(2400); // 4800 * 0.5
      expect(result.newPlanRemainingCost).toBe(4800); // 9600 * 0.5
      // Raw upgrade amount = 4800 - 2400 = 2400
      // Offset by 2400 credit -> additional payable is 0!
      expect(result.additionalAmountPayable).toBe(0);
      expect(result.creditCarriedForward).toBe(0);
    });
  });
});
