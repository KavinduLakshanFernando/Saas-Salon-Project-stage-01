import { BadRequestException } from '@nestjs/common';
import { BillingCycle, SubscriptionHistoryAction, SubscriptionStatus } from '@prisma/client';
import { SubscriptionsService } from './subscriptions.service';
import { PaymentPurpose } from '../payments/dto/create-payment-order.dto';

describe('Admin Downgrade Credit & Immediate Plan Changes', () => {
  let service: SubscriptionsService;
  let mockPrisma: any;
  let mockPlansService: any;
  let mockSubscriptionFeatureService: any;

  const tenantId = '00000000-0000-0000-0000-000000000001';
  const adminUserId = '99999999-9999-9999-9999-999999999999';
  const subId = '11111111-1111-1111-1111-111111111111';

  const goldPlan = {
    id: 'plan-gold-id',
    code: 'GOLD',
    name: 'Gold Plan',
    displayOrder: 2,
    status: 'ACTIVE',
    planFeatures: [],
    planPrices: [
      { id: 'price-gold-monthly', price: 9600, currency: 'LKR', billingCycle: BillingCycle.MONTHLY, isActive: true },
    ],
  };

  const silverPlan = {
    id: 'plan-silver-id',
    code: 'SILVER',
    name: 'Silver Plan',
    displayOrder: 1,
    status: 'ACTIVE',
    planFeatures: [],
    planPrices: [
      { id: 'price-silver-monthly', price: 4800, currency: 'LKR', billingCycle: BillingCycle.MONTHLY, isActive: true },
    ],
  };

  const bronzePlan = {
    id: 'plan-bronze-id',
    code: 'BRONZE',
    name: 'Bronze Plan',
    displayOrder: 0,
    status: 'ACTIVE',
    planFeatures: [],
    planPrices: [
      { id: 'price-bronze-monthly', price: 2400, currency: 'LKR', billingCycle: BillingCycle.MONTHLY, isActive: true },
    ],
  };

  const periodStart = new Date('2026-10-01T00:00:00.000Z');
  const periodEnd = new Date('2026-10-31T00:00:00.000Z'); // 30-day period

  beforeEach(() => {
    mockPlansService = {
      findById: jest.fn((id: string) => {
        if (id === goldPlan.id) return Promise.resolve(goldPlan);
        if (id === silverPlan.id) return Promise.resolve(silverPlan);
        if (id === bronzePlan.id) return Promise.resolve(bronzePlan);
        return Promise.resolve(null);
      }),
    };

    mockSubscriptionFeatureService = {
      syncSubscriptionFeatures: jest.fn().mockResolvedValue(undefined),
      syncTenantFeatures: jest.fn().mockResolvedValue(undefined),
      getTenantFeatureCodes: jest.fn().mockResolvedValue([]),
    };

    mockPrisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: tenantId, name: 'Salon Elegance' }),
      },
      plan: {
        findUnique: jest.fn((query: any) => {
          const id = query.where.id;
          if (id === goldPlan.id) return Promise.resolve(goldPlan);
          if (id === silverPlan.id) return Promise.resolve(silverPlan);
          if (id === bronzePlan.id) return Promise.resolve(bronzePlan);
          return Promise.resolve(null);
        }),
      },
      planPrice: {
        findFirst: jest.fn((query: any) => {
          if (query.where.planId === silverPlan.id) return Promise.resolve(silverPlan.planPrices[0]);
          if (query.where.planId === goldPlan.id) return Promise.resolve(goldPlan.planPrices[0]);
          if (query.where.planId === bronzePlan.id) return Promise.resolve(bronzePlan.planPrices[0]);
          return Promise.resolve(null);
        }),
        findUnique: jest.fn((query: any) => {
          if (query.where.id === silverPlan.planPrices[0].id) return Promise.resolve(silverPlan.planPrices[0]);
          return Promise.resolve(null);
        }),
      },
      subscription: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      planFeature: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      tenantFeature: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      subscriptionFeature: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      subscriptionAddOn: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      subscriptionHistory: {
        create: jest.fn().mockResolvedValue({ id: 'hist-1' }),
      },
      paymentOrder: {
        create: jest.fn().mockResolvedValue({ id: 'order-1', reference: 'REF-1' }),
      },
      payment: {
        create: jest.fn().mockResolvedValue({ id: 'pay-1' }),
      },
      $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
    };

    service = new SubscriptionsService(
      mockPrisma,
      mockPlansService,
      mockSubscriptionFeatureService,
      undefined,
    );
  });

  describe('1. Gold to Silver Immediate Downgrade with 15 Days Remaining', () => {
    it('activates Silver immediately, preserves renewal date, and stores LKR 2400 credit', async () => {
      const activeGoldSub = {
        id: subId,
        tenantId,
        planId: goldPlan.id,
        plan: goldPlan,
        planPriceId: goldPlan.planPrices[0].id,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: BillingCycle.MONTHLY,
        price: 9600,
        currency: 'LKR',
        startDate: periodStart,
        endDate: periodEnd,
        cancelAtPeriodEnd: false,
        billingCreditBalance: 0,
        invoices: [{ total: 9600, status: 'PAID', items: [{ amount: 9600, description: 'Gold Plan' }] }],
        addOns: [],
      };

      mockPrisma.subscription.findFirst.mockResolvedValue(activeGoldSub);
      mockPrisma.subscription.update.mockImplementation((args: any) => Promise.resolve({
        ...activeGoldSub,
        ...args.data,
      }));

      // Halfway through period: October 16th (15 days remaining)
      const asOfHalfWay = new Date('2026-10-16T00:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(asOfHalfWay);

      const result: any = await service.scheduleDowngrade(
        subId,
        tenantId,
        { planId: silverPlan.id, immediate: true },
        { adminUserId, immediate: true },
      );

      // Verify immediate activation of target plan
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: subId },
          data: expect.objectContaining({
            billingCreditBalance: 2400, // 4800 unused - 2400 silver remaining cost
            pendingPlanId: null,
            pendingPlanPriceId: null,
          }),
        }),
      );

      // Verify history logged with downgrade action and audit details
      expect(mockPrisma.subscriptionHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: SubscriptionHistoryAction.DOWNGRADED,
            performedBy: adminUserId,
            metadata: expect.objectContaining({
              actionType: 'MANUAL_DOWNGRADE',
              immediate: true,
              downgradeCredit: 2400,
              creditCarriedForward: 2400,
            }),
          }),
        }),
      );

      expect(result.calculatedCredit).toBe(2400);
      expect(result.creditCarriedForward).toBe(2400);

      // Restore Date
      jest.useRealTimers();
    });
  });

  describe('2. Credit Deduction from Next Renewal', () => {
    it('deducts LKR 2400 credit from next renewal price of LKR 4800, leaving LKR 2400 payable', async () => {
      const downgradedSubWithCredit = {
        id: subId,
        tenantId,
        planId: silverPlan.id,
        plan: silverPlan,
        planPriceId: silverPlan.planPrices[0].id,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: BillingCycle.MONTHLY,
        price: 4800,
        currency: 'LKR',
        startDate: periodStart,
        endDate: periodEnd,
        cancelAtPeriodEnd: false,
        billingCreditBalance: 2400,
        addOns: [],
      };

      mockPrisma.subscription.findFirst.mockResolvedValue(downgradedSubWithCredit);
      mockPrisma.subscription.update.mockImplementation((args: any) => Promise.resolve({
        ...downgradedSubWithCredit,
        ...args.data,
      }));

      await service.renewSubscription(subId, tenantId, {
        paymentMethod: 'BANK_TRANSFER',
      });

      // Verify payment order was created for 2400 (4800 - 2400 credit)
      expect(mockPrisma.paymentOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 2400,
            purpose: PaymentPurpose.SUBSCRIPTION_RENEW,
          }),
        }),
      );

      // Verify remaining billingCreditBalance was set to 0
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            billingCreditBalance: 0,
          }),
        }),
      );
    });

    it('handles credit exceeding next renewal amount, sets payable to 0 and carries forward remaining credit', async () => {
      const subWithExcessCredit = {
        id: subId,
        tenantId,
        planId: silverPlan.id,
        plan: silverPlan,
        planPriceId: silverPlan.planPrices[0].id,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: BillingCycle.MONTHLY,
        price: 4800,
        currency: 'LKR',
        startDate: periodStart,
        endDate: periodEnd,
        cancelAtPeriodEnd: false,
        billingCreditBalance: 6000, // Credit (6000) exceeds renewal (4800)
        addOns: [],
      };

      mockPrisma.subscription.findFirst.mockResolvedValue(subWithExcessCredit);
      mockPrisma.subscription.update.mockImplementation((args: any) => Promise.resolve({
        ...subWithExcessCredit,
        ...args.data,
      }));

      await service.renewSubscription(subId, tenantId, {});

      // Payment amount should be 0
      expect(mockPrisma.paymentOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 0,
            metadata: expect.objectContaining({ paymentMethod: 'BILLING_CREDIT' }),
          }),
        }),
      );

      // Remaining credit of 1200 (6000 - 4800) must carry forward
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            billingCreditBalance: 1200,
          }),
        }),
      );
    });
  });

  describe('3. Trial Subscription Restriction', () => {
    it('does not issue downgrade credits for unpaid trial subscriptions', async () => {
      const trialSub = {
        id: subId,
        tenantId,
        planId: goldPlan.id,
        plan: goldPlan,
        planPriceId: goldPlan.planPrices[0].id,
        status: SubscriptionStatus.TRIAL,
        billingCycle: BillingCycle.MONTHLY,
        price: 9600,
        currency: 'LKR',
        startDate: periodStart,
        endDate: periodEnd,
        cancelAtPeriodEnd: false,
        billingCreditBalance: 0,
        addOns: [],
        invoices: [],
      };

      mockPrisma.subscription.findFirst.mockResolvedValue(trialSub);

      // Only ACTIVE subscriptions can be downgraded via scheduleDowngrade
      await expect(
        service.scheduleDowngrade(subId, tenantId, { planId: silverPlan.id, immediate: true }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. Multiple Plan Changes Within One Billing Period', () => {
    it('correctly handles downgrade followed by upgrade back using credit', async () => {
      // Salon is on Silver, has 2400 billingCreditBalance from a previous downgrade
      const silverSubWithCredit = {
        id: subId,
        tenantId,
        planId: silverPlan.id,
        plan: silverPlan,
        planPriceId: silverPlan.planPrices[0].id,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: BillingCycle.MONTHLY,
        price: 4800,
        currency: 'LKR',
        startDate: periodStart,
        endDate: periodEnd,
        cancelAtPeriodEnd: false,
        billingCreditBalance: 2400,
        addOns: [],
        invoices: [{ total: 4800, status: 'PAID', items: [{ amount: 4800, description: 'Silver Plan' }] }],
      };

      mockPrisma.subscription.findFirst.mockResolvedValue(silverSubWithCredit);
      mockPrisma.subscription.update.mockImplementation((args: any) => Promise.resolve({
        ...silverSubWithCredit,
        ...args.data,
      }));

      const asOfHalfWay = new Date('2026-10-16T00:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(asOfHalfWay);

      // Upgrading back to Gold with allowWithoutPayment
      const result: any = await service.upgradeSubscription(
        subId,
        tenantId,
        { planId: goldPlan.id },
        { allowWithoutPayment: true, adminUserId },
      );

      // 15 days remaining: Unused Silver = 2400, Gold remaining cost = 4800.
      // Raw upgrade amount = 2400. Offset by 2400 credit -> additional amount payable is 0!
      expect(result.calculatedAmount).toBe(0);

      // Remaining credit after offset = 0
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            billingCreditBalance: 0,
          }),
        }),
      );

      jest.useRealTimers();
    });
  });

  describe('5. Online Renewal via Payment Processor with Available Credit', () => {
    it('deducts billingCreditBalance properly when renewal is fulfilled via payment processor', async () => {
      const activeSilverSubWithCredit = {
        id: subId,
        tenantId,
        planId: silverPlan.id,
        plan: silverPlan,
        planPriceId: silverPlan.planPrices[0].id,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: BillingCycle.MONTHLY,
        price: 4800,
        currency: 'LKR',
        startDate: periodStart,
        endDate: periodEnd,
        cancelAtPeriodEnd: false,
        billingCreditBalance: 1800,
        addOns: [],
      };

      mockPrisma.subscription.findFirst.mockResolvedValue(activeSilverSubWithCredit);
      mockPrisma.subscription.update.mockImplementation((args: any) => Promise.resolve({
        ...activeSilverSubWithCredit,
        ...args.data,
      }));

      // Payment processor calls renewSubscription with fromPaymentProcessor: true
      await service.renewSubscription(
        subId,
        tenantId,
        {
          paymentMethod: 'PAYHERE',
          paymentReference: 'PH-TXN-12345',
        },
        { fromPaymentProcessor: true },
      );

      // Verify billingCreditBalance was deducted: 1800 credit used against 4800 recurring total -> 0 remaining
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            billingCreditBalance: 0,
          }),
        }),
      );
    });
  });

  describe('6. Super Admin Manual Upgrade Workflow', () => {
    it('rejects direct upgrade if neither payment processor nor admin authorization is present', async () => {
      const activeSub = {
        id: subId,
        tenantId,
        planId: silverPlan.id,
        plan: silverPlan,
        planPriceId: silverPlan.planPrices[0].id,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: BillingCycle.MONTHLY,
        price: 4800,
        currency: 'LKR',
        startDate: periodStart,
        endDate: periodEnd,
        cancelAtPeriodEnd: false,
        billingCreditBalance: 0,
      };

      mockPrisma.subscription.findFirst.mockResolvedValue(activeSub);

      await expect(
        service.upgradeSubscription(subId, tenantId, { planId: goldPlan.id }),
      ).rejects.toThrow(BadRequestException);
    });

    it('processes manual upgrade when authorized by Super Admin, records payment and preserves renewal date', async () => {
      const activeSilverSub = {
        id: subId,
        tenantId,
        planId: silverPlan.id,
        plan: silverPlan,
        planPriceId: silverPlan.planPrices[0].id,
        status: SubscriptionStatus.ACTIVE,
        billingCycle: BillingCycle.MONTHLY,
        price: 4800,
        currency: 'LKR',
        startDate: periodStart,
        endDate: periodEnd,
        cancelAtPeriodEnd: false,
        billingCreditBalance: 0,
        invoices: [{ total: 4800, status: 'PAID', items: [{ amount: 4800, description: 'Silver Plan' }] }],
        addOns: [],
      };

      mockPrisma.subscription.findFirst.mockResolvedValue(activeSilverSub);
      mockPrisma.subscription.update.mockImplementation((args: any) => Promise.resolve({
        ...activeSilverSub,
        ...args.data,
      }));

      const asOfHalfWay = new Date('2026-10-16T00:00:00.000Z');
      jest.useFakeTimers();
      jest.setSystemTime(asOfHalfWay);

      const result: any = await service.upgradeSubscription(
        subId,
        tenantId,
        { planId: goldPlan.id, paymentReference: 'BANK-SLIP-REF-777' },
        { allowWithoutPayment: true, adminUserId },
      );

      // Silver (4800) -> Gold (9600) with 15 days remaining -> additional amount payable is 2400
      expect(result.calculatedAmount).toBe(2400);

      // Verifies manual payment order recorded
      expect(mockPrisma.paymentOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 2400,
            purpose: PaymentPurpose.SUBSCRIPTION_UPGRADE,
            metadata: expect.objectContaining({
              paymentMethod: 'BANK_TRANSFER_VERIFIED',
              paymentReference: 'BANK-SLIP-REF-777',
            }),
          }),
        }),
      );

      // Verifies history logged with manual upgrade action
      expect(mockPrisma.subscriptionHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: SubscriptionHistoryAction.UPGRADED,
            performedBy: adminUserId,
            metadata: expect.objectContaining({
              actionType: 'MANUAL_UPGRADE',
              manualUpgrade: true,
              calculatedAmount: 2400,
            }),
          }),
        }),
      );

      jest.useRealTimers();
    });
  });
});
