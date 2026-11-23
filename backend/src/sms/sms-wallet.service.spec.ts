import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SubscriptionFeatureService } from '../subscriptions/subscription-feature.service';
import { SmsWalletService } from './sms-wallet.service';
import { SmsCreditTransactionType } from '@prisma/client';

describe('SmsWalletService', () => {
  let service: SmsWalletService;
  let prisma: any;
  let subscriptionFeatureService: any;

  beforeEach(() => {
    prisma = {
      tenantSmsWallet: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      smsCreditTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'tx-1' }),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      smsMessageLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
      },
      smsManualPayment: {
        findFirst: jest.fn(),
        create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'payment-1', ...args.data })),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      superAdminAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      subscription: {
        findFirst: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => cb(prisma)),
    };

    subscriptionFeatureService = {
      hasFeature: jest.fn(),
    };

    service = new SmsWalletService(
      prisma as unknown as PrismaService,
    );
  });

  describe('getOrCreateWallet', () => {
    it('creates or retrieves isolated tenant wallet', async () => {
      const mockWallet = {
        id: 'wallet-1',
        tenantId: 'tenant-1',
        balance: 100,
        totalPurchased: 100,
        totalConsumed: 0,
        lowBalanceThreshold: 20,
        lowBalanceWarned: false,
        isActive: true,
        initialBonusGranted: true,
      };

      prisma.tenantSmsWallet.findUnique.mockResolvedValue(mockWallet);

      const wallet = await service.getOrCreateWallet('tenant-1');
      expect(wallet.balance).toBe(100);
      expect(prisma.tenantSmsWallet.findUnique).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
      });
    });

    it('creates new wallet if not existing with inactive status', async () => {
      prisma.tenantSmsWallet.findUnique.mockResolvedValue(null);
      prisma.tenantSmsWallet.create.mockResolvedValue({
        id: 'wallet-new',
        tenantId: 'tenant-new',
        balance: 0,
        totalPurchased: 0,
        totalConsumed: 0,
        lowBalanceThreshold: 20,
        lowBalanceWarned: false,
        isActive: false,
        initialBonusGranted: false,
      });

      const wallet = await service.getOrCreateWallet('tenant-new');
      expect(wallet.balance).toBe(0);
      expect(wallet.isActive).toBe(false);
      expect(prisma.tenantSmsWallet.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-new',
          balance: 0,
          totalPurchased: 0,
          totalConsumed: 0,
          lowBalanceThreshold: 20,
          lowBalanceWarned: false,
          isActive: false,
          initialBonusGranted: false,
        },
      });
    });
  });

  describe('canTenantSendSms', () => {
    it('allows sending when plan covers SMS without checking wallet', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-gold',
        status: 'ACTIVE',
        subscriptionFeatures: [
          { enabled: true, feature: { code: 'SMS_NOTIFICATIONS', status: 'ACTIVE' } },
        ],
      });

      const eligibility = await service.canTenantSendSms('tenant-gold', 5);
      expect(eligibility.canSend).toBe(true);
      expect(eligibility.isPlanCovered).toBe(true);
    });

    it('blocks sending when SMS is not activated by Super Admin for basic/silver plan', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-basic',
        status: 'ACTIVE',
        subscriptionFeatures: [],
      });

      prisma.tenantSmsWallet.findUnique.mockResolvedValue({
        id: 'wallet-inactive',
        tenantId: 'tenant-basic',
        balance: 0,
        isActive: false,
        lowBalanceThreshold: 20,
      });

      const eligibility = await service.canTenantSendSms('tenant-basic', 1);
      expect(eligibility.canSend).toBe(false);
      expect(eligibility.isPlanCovered).toBe(false);
      expect(eligibility.reason).toContain('not activated for your salon');
    });

    it('blocks sending when wallet balance is 0 on activated basic plan', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-basic',
        status: 'ACTIVE',
        subscriptionFeatures: [],
      });

      prisma.tenantSmsWallet.findUnique.mockResolvedValue({
        id: 'wallet-2',
        tenantId: 'tenant-basic',
        balance: 0,
        isActive: true,
        lowBalanceThreshold: 20,
      });

      const eligibility = await service.canTenantSendSms('tenant-basic', 1);
      expect(eligibility.canSend).toBe(false);
      expect(eligibility.isPlanCovered).toBe(false);
      expect(eligibility.availableCredits).toBe(0);
      expect(eligibility.reason).toContain('0 SMS credits remaining');
    });

    it('blocks sending when required credits exceed available balance on activated plan', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);
      prisma.tenantSmsWallet.findUnique.mockResolvedValue({
        id: 'wallet-3',
        tenantId: 'tenant-3',
        balance: 2,
        isActive: true,
        lowBalanceThreshold: 20,
      });

      const eligibility = await service.canTenantSendSms('tenant-3', 4);
      expect(eligibility.canSend).toBe(false);
      expect(eligibility.reason).toContain('requires 4 credit(s), but only 2 is available');
    });

    it('allows sending when wallet is activated and has sufficient credits', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);
      prisma.tenantSmsWallet.findUnique.mockResolvedValue({
        id: 'wallet-3',
        tenantId: 'tenant-3',
        balance: 10,
        isActive: true,
        lowBalanceThreshold: 20,
      });

      const eligibility = await service.canTenantSendSms('tenant-3', 2);
      expect(eligibility.canSend).toBe(true);
      expect(eligibility.availableCredits).toBe(10);
    });
  });

  describe('deductCredits', () => {
    it('atomically deducts credits and triggers warning when crossing threshold', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);

      // Current balance: 22. Deducting 3 leaves 19 (which is <= threshold of 20)
      const mockWallet = {
        id: 'wallet-4',
        tenantId: 'tenant-4',
        balance: 22,
        totalConsumed: 10,
        lowBalanceThreshold: 20,
        lowBalanceWarned: false,
      };

      prisma.tenantSmsWallet.findUnique.mockResolvedValue(mockWallet);
      prisma.tenantSmsWallet.update.mockResolvedValue({
        ...mockWallet,
        balance: 19,
        totalConsumed: 13,
        lowBalanceWarned: true,
      });

      const result = await service.deductCredits({
        tenantId: 'tenant-4',
        credits: 3,
        purpose: 'REMINDER',
        recipient: '0771234567',
        idempotencyKey: 'idem-1',
      });

      expect(result.deducted).toBe(true);
      expect(result.balanceAfter).toBe(19);

      // Verify wallet updated with lowBalanceWarned: true
      expect(prisma.tenantSmsWallet.update).toHaveBeenCalledWith({
        where: { id: 'wallet-4' },
        data: {
          balance: 19,
          totalConsumed: 13,
          lowBalanceWarned: true,
        },
      });

      // Verify transaction recorded
      expect(prisma.smsCreditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-4',
          type: SmsCreditTransactionType.USAGE,
          amount: -3,
          balanceAfter: 19,
        }),
      });

      // Verify notification created
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-4',
          type: 'LOW_SMS_BALANCE',
        }),
      });
    });

    it('throws BadRequestException if balance is insufficient', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);
      prisma.tenantSmsWallet.findUnique.mockResolvedValue({
        id: 'wallet-5',
        tenantId: 'tenant-5',
        balance: 1,
      });

      await expect(
        service.deductCredits({
          tenantId: 'tenant-5',
          credits: 5,
          purpose: 'TEST',
          recipient: '0770000000',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addPurchasedCredits', () => {
    it('adds purchased credits and resets lowBalanceWarned flag when above threshold', async () => {
      prisma.tenantSmsWallet.upsert.mockResolvedValue({
        id: 'wallet-6',
        tenantId: 'tenant-6',
        balance: 5,
        totalPurchased: 100,
        lowBalanceThreshold: 20,
        lowBalanceWarned: true,
      });

      prisma.tenantSmsWallet.update.mockResolvedValue({
        id: 'wallet-6',
        balance: 105,
        totalPurchased: 200,
        lowBalanceWarned: false,
      });

      const result = await service.addPurchasedCredits({
        tenantId: 'tenant-6',
        credits: 100,
        packageId: 'pkg-1',
        packageName: 'Starter SMS',
        paymentOrderId: 'order-1',
        paymentReference: 'TX-100',
        amount: 250,
        currency: 'LKR',
      });

      expect(result.balance).toBe(105);
      expect(prisma.tenantSmsWallet.update).toHaveBeenCalledWith({
        where: { id: 'wallet-6' },
        data: {
          balance: 105,
          totalPurchased: 200,
          lowBalanceWarned: false,
          isActive: true,
          activatedAt: expect.any(Date),
        },
      });

      expect(prisma.smsCreditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-6',
          type: SmsCreditTransactionType.PURCHASE,
          amount: 100,
          balanceAfter: 105,
          paymentOrderId: 'order-1',
          packageId: 'pkg-1',
        }),
      });
    });
  });

  describe('refundCredits', () => {
    it('refunds reserved credits back to the wallet on delivery failure', async () => {
      prisma.tenantSmsWallet.findUnique.mockResolvedValue({
        id: 'wallet-7',
        tenantId: 'tenant-7',
        balance: 10,
        totalConsumed: 15,
        lowBalanceThreshold: 20,
      });

      const result = await service.refundCredits({
        tenantId: 'tenant-7',
        credits: 2,
        reason: 'Provider timeout',
        recipient: '0771234567',
      });

      expect(result.refunded).toBe(true);
      expect(result.balanceAfter).toBe(12);

      expect(prisma.tenantSmsWallet.update).toHaveBeenCalledWith({
        where: { id: 'wallet-7' },
        data: expect.objectContaining({
          balance: 12,
          totalConsumed: 13,
        }),
      });

      expect(prisma.smsCreditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: SmsCreditTransactionType.REFUND,
          amount: 2,
          balanceAfter: 12,
        }),
      });
    });
  });

  describe('activateSms', () => {
    it('activates SMS and allocates initial credits atomically', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null); // not covered by plan
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', name: 'Salon One' });
      prisma.tenantSmsWallet.findUnique.mockResolvedValue({
        id: 'wallet-1',
        tenantId: 'tenant-1',
        balance: 0,
        totalPurchased: 0,
        isActive: false,
      });
      prisma.tenantSmsWallet.update.mockResolvedValue({
        id: 'wallet-1',
        tenantId: 'tenant-1',
        balance: 1000,
        totalPurchased: 1000,
        totalConsumed: 0,
        isActive: true,
      });

      const res = await service.activateSms('tenant-1', 'admin-1', 1000, 'Initial credits');
      expect(res.success).toBe(true);
      expect(res.creditsAllocated).toBe(1000);
      expect(res.wallet.balance).toBe(1000);

      expect(prisma.smsCreditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          type: SmsCreditTransactionType.ADJUSTMENT,
          amount: 1000,
          balanceAfter: 1000,
        }),
      });

      expect(prisma.superAdminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'SMS_ACTIVATE',
          tenantId: 'tenant-1',
        }),
      });
    });

    it('activates SMS with 0 credits if none specified', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-2', name: 'Salon Two' });
      prisma.tenantSmsWallet.findUnique.mockResolvedValue({
        id: 'wallet-2',
        tenantId: 'tenant-2',
        balance: 0,
        totalPurchased: 0,
        totalConsumed: 0,
        isActive: false,
      });
      prisma.tenantSmsWallet.update.mockResolvedValue({
        id: 'wallet-2',
        tenantId: 'tenant-2',
        balance: 0,
        totalPurchased: 0,
        totalConsumed: 0,
        isActive: true,
      });

      const res = await service.activateSms('tenant-2', 'admin-1', 0);
      expect(res.success).toBe(true);
      expect(res.creditsAllocated).toBe(0);
      expect(res.wallet.balance).toBe(0);
      expect(prisma.smsCreditTransaction.create).not.toHaveBeenCalled();
    });

    it('rejects activation if salon is already covered by Gold/Platinum plan', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-gold',
        status: 'ACTIVE',
        subscriptionFeatures: [
          { enabled: true, feature: { code: 'SMS_NOTIFICATIONS', status: 'ACTIVE' } },
        ],
      });

      await expect(service.activateSms('tenant-gold', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('addCredits', () => {
    it('allocates additional credits directly to the salon wallet', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-3', name: 'Salon Three' });
      prisma.tenantSmsWallet.findUnique.mockResolvedValue({
        id: 'wallet-3',
        tenantId: 'tenant-3',
        balance: 50,
        totalPurchased: 100,
        totalConsumed: 50,
        lowBalanceThreshold: 20,
        lowBalanceWarned: false,
        isActive: true,
      });
      prisma.tenantSmsWallet.update.mockResolvedValue({
        id: 'wallet-3',
        balance: 1050,
        totalPurchased: 1100,
        totalConsumed: 50,
        isActive: true,
      });

      const res = await service.addCredits('tenant-3', 'admin-1', 1000, 'Offline top-up');
      expect(res.success).toBe(true);
      expect(res.creditsAdded).toBe(1000);
      expect(res.wallet.balance).toBe(1050);

      expect(prisma.smsCreditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-3',
          type: SmsCreditTransactionType.ADJUSTMENT,
          amount: 1000,
          balanceAfter: 1050,
        }),
      });

      expect(prisma.superAdminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'SMS_CREDITS_ALLOCATED',
          tenantId: 'tenant-3',
        }),
      });
    });

    it('rejects if credits is zero or negative', async () => {
      await expect(service.addCredits('tenant-3', 'admin-1', 0)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.addCredits('tenant-3', 'admin-1', -50)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deactivateSms', () => {
    it('deactivates SMS while strictly preserving remaining credits', async () => {
      prisma.tenantSmsWallet.findUnique.mockResolvedValue({
        id: 'wallet-3',
        tenantId: 'tenant-3',
        balance: 75,
        isActive: true,
      });
      prisma.tenantSmsWallet.update.mockResolvedValue({
        id: 'wallet-3',
        tenantId: 'tenant-3',
        balance: 75,
        isActive: false,
      });

      const res = await service.deactivateSms('tenant-3', 'admin-1', 'Temporarily requested');
      expect(res.success).toBe(true);
      expect(res.wallet.isActive).toBe(false);
      expect(res.wallet.balance).toBe(75);

      expect(prisma.tenantSmsWallet.update).toHaveBeenCalledWith({
        where: { id: 'wallet-3' },
        data: { isActive: false },
      });

      expect(prisma.superAdminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'SMS_DEACTIVATE',
          tenantId: 'tenant-3',
        }),
      });
    });
  });

  describe('addManualPaymentCredits', () => {
    it('converts payment amount to credits 1:1 and records manual payment', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-4', name: 'Salon Four' });
      prisma.smsManualPayment.findFirst.mockResolvedValue(null); // unique ref
      prisma.tenantSmsWallet.findUnique.mockResolvedValue({
        id: 'wallet-4',
        tenantId: 'tenant-4',
        balance: 20,
        totalPurchased: 100,
        totalConsumed: 80,
        lowBalanceThreshold: 20,
        lowBalanceWarned: true,
      });
      prisma.tenantSmsWallet.update.mockResolvedValue({
        id: 'wallet-4',
        balance: 520,
        totalPurchased: 600,
        totalConsumed: 80,
        isActive: true,
      });

      const res = await service.addManualPaymentCredits({
        tenantId: 'tenant-4',
        amount: 500, // LKR 500 = 500 credits
        paymentMethod: 'BANK_TRANSFER',
        paymentReference: 'BOC-TX-998877',
        paymentDate: new Date(),
        notes: 'Direct bank transfer receipt verified',
        adminUserId: 'admin-1',
      });

      expect(res.success).toBe(true);
      expect(res.wallet.balance).toBe(520);

      // Verify transaction created with PURCHASE type and 500 credits
      expect(prisma.smsCreditTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-4',
          type: SmsCreditTransactionType.PURCHASE,
          amount: 500,
          balanceAfter: 520,
          reference: 'BOC-TX-998877',
        }),
      });

      // Verify manual payment recorded
      expect(prisma.smsManualPayment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-4',
          credits: 500,
          paymentReference: 'BOC-TX-998877',
          confirmedByAdminId: 'admin-1',
        }),
        include: expect.any(Object),
      });

      // Verify audit log
      expect(prisma.superAdminAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'SMS_MANUAL_PAYMENT_ALLOCATED',
          tenantId: 'tenant-4',
        }),
      });
    });

    it('rejects duplicate payment references for idempotency', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-5', name: 'Salon Five' });
      prisma.smsManualPayment.findFirst.mockResolvedValue({
        id: 'existing-pay',
        tenantId: 'tenant-5',
        paymentReference: 'DUP-REF-123',
      });

      await expect(
        service.addManualPaymentCredits({
          tenantId: 'tenant-5',
          amount: 1000,
          paymentReference: 'DUP-REF-123',
          paymentDate: new Date(),
          adminUserId: 'admin-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects non-positive payment amounts', async () => {
      await expect(
        service.addManualPaymentCredits({
          tenantId: 'tenant-6',
          amount: 0,
          paymentReference: 'REF-0',
          paymentDate: new Date(),
          adminUserId: 'admin-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

