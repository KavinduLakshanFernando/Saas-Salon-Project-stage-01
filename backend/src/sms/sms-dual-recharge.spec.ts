import { BadRequestException } from '@nestjs/common';
import {
  PaymentGatewayProvider,
  PaymentOrderStatus,
  PaymentRecordStatus,
  SmsCreditTransactionType,
  SmsRechargeRequestStatus,
  SubscriptionStatus,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { SmsWalletService } from './sms-wallet.service';
import { SmsRechargeRequestsService } from './sms-recharge-requests.service';
import { PaymentProcessorService } from '../payments/payment-processor.service';
import { PaymentOrdersService } from '../payments/payment-orders.service';
import { PaymentPurpose } from '../payments/dto/create-payment-order.dto';
import { PaymentGatewayRegistry } from '../payments/payment-gateway.registry';

describe('Dual-Method SMS Credit Recharge System (18 Requirements Test Suite)', () => {
  const tenantId = 'tenant-silver-001';
  const superAdminId = 'admin-001';
  const packageId = 'pkg-sms-1000';
  const orderRef = 'PO-SMS-TEST-001';

  let prisma: any;
  let smsWalletService: SmsWalletService;
  let rechargeRequestsService: SmsRechargeRequestsService;
  let paymentOrdersService: PaymentOrdersService;
  let paymentProcessorService: PaymentProcessorService;
  let gatewayRegistry: { get: jest.Mock };

  beforeEach(() => {
    prisma = {
      tenantSmsWallet: {
        findUnique: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn().mockImplementation(async (args: any) => {
          const existing = await prisma.tenantSmsWallet.findUnique({ where: args.where });
          if (existing) return existing;
          return {
            id: 'wallet-1',
            tenantId: args.where?.tenantId || tenantId,
            balance: 0,
            totalPurchased: 0,
            totalConsumed: 0,
            lowBalanceThreshold: 50,
            lowBalanceWarned: false,
            isActive: false,
            ...args.create,
          };
        }),
        update: jest.fn(),
      },
      smsCreditTransaction: {
        create: jest.fn().mockImplementation((args: any) =>
          Promise.resolve({ id: 'tx-' + Math.random(), ...args.data }),
        ),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      smsRechargeRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      smsPackage: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      paymentOrder: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        findUnique: jest.fn(),
        upsert: jest.fn().mockResolvedValue({ id: 'payment-1', status: PaymentRecordStatus.PAID }),
      },
      paymentTransaction: {
        create: jest.fn(),
      },
      superAdminAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: tenantId, name: 'Silver Salon' }),
      },
      $transaction: jest.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(prisma);
        }
        return Promise.all(cb);
      }),
    };

    gatewayRegistry = { get: jest.fn() };

    smsWalletService = new SmsWalletService(prisma as unknown as PrismaService);
    rechargeRequestsService = new SmsRechargeRequestsService(prisma as unknown as PrismaService);

    const subscriptionsService = {
      activateSubscription: jest.fn(),
      renewSubscription: jest.fn(),
      upgradeSubscriptionFromPayment: jest.fn(),
    };
    const subscriptionAddonsService = {
      activatePaidAddOn: jest.fn(),
    };
    const invoicesService = {
      generateFromPayment: jest.fn().mockResolvedValue(null),
    };
    const notificationQueue = {
      enqueuePaymentSuccess: jest.fn().mockResolvedValue(undefined),
      enqueuePaymentFailed: jest.fn().mockResolvedValue(undefined),
    };

    paymentOrdersService = new PaymentOrdersService(
      prisma as unknown as PrismaService,
      gatewayRegistry as unknown as PaymentGatewayRegistry,
      { get: jest.fn() } as unknown as ConfigService,
    );
    paymentProcessorService = new PaymentProcessorService(
      prisma as never,
      gatewayRegistry as unknown as PaymentGatewayRegistry,
      subscriptionsService as never,
      subscriptionAddonsService as never,
      invoicesService as never,
      notificationQueue as never,
      smsWalletService as never,
    );
  });

  // 1. First SMS allocation by admin
  it('1. First SMS allocation by admin activates inactive wallet and credits initial balance', async () => {
    prisma.tenantSmsWallet.findUnique.mockResolvedValue(null);
    prisma.tenantSmsWallet.create.mockResolvedValue({
      id: 'wallet-1',
      tenantId,
      balance: 0,
      totalPurchased: 0,
      totalConsumed: 0,
      lowBalanceThreshold: 50,
      lowBalanceWarned: false,
      isActive: false,
    });
    prisma.tenantSmsWallet.update.mockResolvedValue({
      id: 'wallet-1',
      tenantId,
      balance: 1000,
      totalPurchased: 1000,
      totalConsumed: 0,
      isActive: true,
      activatedAt: new Date(),
    });

    const result = await smsWalletService.activateSms(tenantId, superAdminId, 1000, 'First time activation');

    expect(result.success).toBe(true);
    expect(result.creditsAllocated).toBe(1000);
    expect(prisma.tenantSmsWallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isActive: true,
          balance: 1000,
          totalPurchased: 1000,
        }),
      }),
    );
    expect(prisma.smsCreditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: SmsCreditTransactionType.ADJUSTMENT,
          amount: 1000,
          balanceAfter: 1000,
        }),
      }),
    );
  });

  // 2. Repeat SMS allocation by admin
  it('2. Repeat SMS allocation by admin adds credits on top of existing balance', async () => {
    prisma.tenantSmsWallet.findUnique.mockResolvedValue({
      id: 'wallet-1',
      tenantId,
      balance: 1000,
      totalPurchased: 1000,
      totalConsumed: 200,
      lowBalanceThreshold: 50,
      lowBalanceWarned: false,
      isActive: true,
    });
    prisma.tenantSmsWallet.update.mockResolvedValue({
      id: 'wallet-1',
      tenantId,
      balance: 1500,
      totalPurchased: 1500,
      totalConsumed: 200,
      isActive: true,
    });

    const result = await smsWalletService.addCredits(tenantId, superAdminId, 500, 'Repeat manual top-up');

    expect(result.success).toBe(true);
    expect(result.creditsAdded).toBe(500);
    expect(prisma.tenantSmsWallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          balance: 1500,
          totalPurchased: 1500,
        }),
      }),
    );
  });

  // 3. First self-service PayHere purchase
  it('3. First self-service PayHere purchase activates the wallet and credits balance automatically', async () => {
    prisma.tenantSmsWallet.findUnique.mockResolvedValue({
      id: 'wallet-new',
      tenantId,
      balance: 0,
      totalPurchased: 0,
      totalConsumed: 0,
      lowBalanceThreshold: 50,
      lowBalanceWarned: false,
      isActive: false,
      activatedAt: null,
    });
    prisma.tenantSmsWallet.update.mockResolvedValue({
      id: 'wallet-new',
      tenantId,
      balance: 1000,
      totalPurchased: 1000,
      totalConsumed: 0,
      isActive: true,
      activatedAt: new Date(),
    });

    const wallet = await smsWalletService.addPurchasedCredits({
      tenantId,
      credits: 1000,
      packageId,
      packageName: 'Silver SMS Package',
      paymentOrderId: 'order-payhere-1',
      paymentReference: 'PAYHERE-REF-001',
      amount: 1200,
      currency: 'LKR',
    });

    expect(wallet.balance).toBe(1000);
    expect(prisma.tenantSmsWallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          balance: 1000,
          totalPurchased: 1000,
          isActive: true,
          activatedAt: expect.any(Date),
        }),
      }),
    );
    expect(prisma.smsCreditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: SmsCreditTransactionType.PURCHASE,
          amount: 1000,
          balanceAfter: 1000,
          paymentOrderId: 'order-payhere-1',
        }),
      }),
    );
  });

  // 4. Repeat self-service purchase
  it('4. Repeat self-service purchase adds new credits without resetting or overwriting', async () => {
    prisma.tenantSmsWallet.findUnique.mockResolvedValue({
      id: 'wallet-active',
      tenantId,
      balance: 800,
      totalPurchased: 1000,
      totalConsumed: 200,
      lowBalanceThreshold: 50,
      lowBalanceWarned: false,
      isActive: true,
      activatedAt: new Date(),
    });
    prisma.tenantSmsWallet.update.mockResolvedValue({
      id: 'wallet-active',
      tenantId,
      balance: 1800,
      totalPurchased: 2000,
      totalConsumed: 200,
      isActive: true,
    });

    const wallet = await smsWalletService.addPurchasedCredits({
      tenantId,
      credits: 1000,
      packageId,
      packageName: 'Silver SMS Package',
      paymentOrderId: 'order-payhere-2',
      paymentReference: 'PAYHERE-REF-002',
      amount: 1200,
      currency: 'LKR',
    });

    expect(wallet.balance).toBe(1800);
    expect(prisma.tenantSmsWallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          balance: 1800,
          totalPurchased: 2000,
        }),
      }),
    );
  });

  // 5. Silver plan self-service purchase
  it('5. Silver plan owner can purchase SMS packages without requiring subscription upgrade', async () => {
    prisma.smsPackage.findUnique.mockResolvedValue({
      id: packageId,
      name: 'Growth Pack',
      credits: 1000,
      price: 1500,
      currency: 'LKR',
      isActive: true,
    });

    const subId = 'sub-silver-001';
    prisma.subscription.findFirst.mockResolvedValue({
      id: subId,
      tenantId,
      status: SubscriptionStatus.ACTIVE,
      plan: { id: 'plan-silver', code: 'SILVER', name: 'Basic / Silver', displayOrder: 1, status: 'ACTIVE' },
    });

    prisma.paymentOrder.create.mockResolvedValue({
      id: 'order-sms-1',
      reference: 'PO-SMS-12345',
      tenantId,
      subscriptionId: subId,
      amount: 1500,
      currency: 'LKR',
      status: PaymentOrderStatus.PENDING,
      purpose: PaymentPurpose.SMS_PACKAGE_PURCHASE,
      metadata: { packageId, credits: 1000 },
    });

    const order = await paymentOrdersService.createOrder({
      tenantId,
      subscriptionId: subId,
      gateway: PaymentGatewayProvider.PAYHERE,
      purpose: PaymentPurpose.SMS_PACKAGE_PURCHASE,
      metadata: { packageId, packageName: 'Growth Pack', credits: 1000, price: 1500, currency: 'LKR' },
    });

    expect(order.purpose).toBe(PaymentPurpose.SMS_PACKAGE_PURCHASE);
    expect(prisma.paymentOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          purpose: PaymentPurpose.SMS_PACKAGE_PURCHASE,
          amount: 1500,
          metadata: expect.objectContaining({ packageId, credits: 1000 }),
        }),
      }),
    );
  });

  // 6. Switching between admin and PayHere recharge methods
  it('6. Tenant can seamlessly switch between Admin top-up and PayHere self-service without lockout', async () => {
    // Stage 1: Started with 100 credits
    // Admin adds 500
    prisma.tenantSmsWallet.findUnique.mockResolvedValueOnce({
      id: 'wallet-dual',
      tenantId,
      balance: 100,
      totalPurchased: 100,
      totalConsumed: 0,
      lowBalanceThreshold: 50,
      lowBalanceWarned: false,
      isActive: true,
    });
    prisma.tenantSmsWallet.update.mockResolvedValueOnce({
      id: 'wallet-dual',
      tenantId,
      balance: 600,
      totalPurchased: 600,
      totalConsumed: 0,
      isActive: true,
    });

    const adminResult = await smsWalletService.addCredits(tenantId, superAdminId, 500, 'Admin assisted');
    expect(adminResult.wallet.balance).toBe(600);

    // Stage 2: Later, owner purchases 1,000 credits via PayHere
    prisma.tenantSmsWallet.findUnique.mockResolvedValueOnce({
      id: 'wallet-dual',
      tenantId,
      balance: 600,
      totalPurchased: 600,
      totalConsumed: 0,
      lowBalanceThreshold: 50,
      lowBalanceWarned: false,
      isActive: true,
    });
    prisma.tenantSmsWallet.update.mockResolvedValueOnce({
      id: 'wallet-dual',
      tenantId,
      balance: 1600,
      totalPurchased: 1600,
      totalConsumed: 0,
      isActive: true,
    });

    const payhereResult = await smsWalletService.addPurchasedCredits({
      tenantId,
      credits: 1000,
      packageId,
      packageName: 'PayHere 1000 Pack',
      paymentOrderId: 'order-dual-1',
      paymentReference: 'PAYHERE-DUAL',
      amount: 1500,
      currency: 'LKR',
    });
    expect(payhereResult.balance).toBe(1600);
  });

  // 7. Existing credits remaining during recharge
  it('7. Preserves existing unspent credits during new recharge', async () => {
    prisma.tenantSmsWallet.findUnique.mockResolvedValue({
      id: 'wallet-existing',
      tenantId,
      balance: 345, // Existing remaining balance
      totalPurchased: 500,
      totalConsumed: 155,
      lowBalanceThreshold: 50,
      lowBalanceWarned: false,
      isActive: true,
    });
    prisma.tenantSmsWallet.update.mockResolvedValue({
      id: 'wallet-existing',
      tenantId,
      balance: 845, // 345 + 500
      totalPurchased: 1000,
      totalConsumed: 155,
      isActive: true,
    });

    const res = await smsWalletService.addPurchasedCredits({
      tenantId,
      credits: 500,
      packageId,
      packageName: 'Addon Pack',
      paymentOrderId: 'order-3',
      paymentReference: 'PAYHERE-3',
      amount: 600,
      currency: 'LKR',
    });

    expect(res.balance).toBe(845);
  });

  // 8. Successful payment
  it('8. Verified successful payment webhook marks order PAID and calls wallet crediting service', async () => {
    gatewayRegistry.get.mockReturnValue({
      verifyWebhook: jest.fn().mockReturnValue({
        valid: true,
        orderReference: orderRef,
        transactionId: 'TX-PH-SUCCESS',
        status: 'paid',
        amount: 1500,
        currency: 'LKR',
        rawPayload: { status_code: '2' },
      }),
    });

    prisma.paymentOrder.findUnique.mockResolvedValue({
      id: 'order-sms-success',
      reference: orderRef,
      gateway: PaymentGatewayProvider.PAYHERE,
      tenantId,
      amount: 1500,
      currency: 'LKR',
      status: PaymentOrderStatus.PENDING,
      purpose: PaymentPurpose.SMS_PACKAGE_PURCHASE,
      metadata: { packageId, packageName: 'Growth Pack', credits: 1000 },
    });

    prisma.payment.findUnique.mockResolvedValue(null);
    prisma.payment.upsert.mockResolvedValue({
      id: 'payment-record-1',
      status: PaymentRecordStatus.PAID,
    });
    prisma.paymentOrder.update.mockResolvedValue({
      id: 'order-sms-success',
      status: PaymentOrderStatus.PAID,
    });

    const spyAddPurchased = jest.spyOn(smsWalletService, 'addPurchasedCredits');

    await paymentProcessorService.processWebhook(PaymentGatewayProvider.PAYHERE, {
      order_id: orderRef,
      status_code: 2,
    });

    expect(prisma.paymentOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PaymentOrderStatus.PAID,
        }),
      }),
    );
    expect(spyAddPurchased).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        credits: 1000,
        paymentOrderId: 'order-sms-success',
      }),
    );
  });

  // 9. Failed and cancelled payment
  it('9. Failed or cancelled payment does not allocate SMS credits to the wallet', async () => {
    gatewayRegistry.get.mockReturnValue({
      verifyWebhook: jest.fn().mockReturnValue({
        valid: true,
        orderReference: orderRef,
        transactionId: 'TX-PH-FAILED',
        status: 'failed',
        amount: 1500,
        currency: 'LKR',
        rawPayload: { status_code: '-2' },
      }),
    });

    prisma.paymentOrder.findUnique.mockResolvedValue({
      id: 'order-failed',
      reference: orderRef,
      gateway: PaymentGatewayProvider.PAYHERE,
      tenantId,
      amount: 1500,
      currency: 'LKR',
      status: PaymentOrderStatus.PENDING,
      purpose: PaymentPurpose.SMS_PACKAGE_PURCHASE,
      metadata: { packageId, credits: 1000 },
    });

    const spyAddPurchased = jest.spyOn(smsWalletService, 'addPurchasedCredits');

    await paymentProcessorService.processWebhook(PaymentGatewayProvider.PAYHERE, {
      order_id: orderRef,
      status_code: -2,
    });

    expect(prisma.paymentOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PaymentOrderStatus.FAILED,
        }),
      }),
    );
    expect(spyAddPurchased).not.toHaveBeenCalled();
    expect(prisma.tenantSmsWallet.update).not.toHaveBeenCalled();
  });

  // 10. Duplicate PayHere webhook idempotency
  it('10. Duplicate PayHere webhook returns idempotent response without double-crediting wallet', async () => {
    gatewayRegistry.get.mockReturnValue({
      verifyWebhook: jest.fn().mockReturnValue({
        valid: true,
        orderReference: orderRef,
        transactionId: 'TX-PH-SUCCESS',
        status: 'paid',
        amount: 1500,
        currency: 'LKR',
        rawPayload: {},
      }),
    });

    // Order is ALREADY marked as PAID
    prisma.paymentOrder.findUnique.mockResolvedValue({
      id: 'order-already-paid',
      reference: orderRef,
      gateway: PaymentGatewayProvider.PAYHERE,
      tenantId,
      amount: 1500,
      currency: 'LKR',
      status: PaymentOrderStatus.PAID,
      purpose: PaymentPurpose.SMS_PACKAGE_PURCHASE,
      metadata: { packageId, credits: 1000 },
    });

    const spyAddPurchased = jest.spyOn(smsWalletService, 'addPurchasedCredits');

    const result = await paymentProcessorService.processWebhook(PaymentGatewayProvider.PAYHERE, {
      order_id: orderRef,
    });

    expect(result.alreadyProcessed).toBe(true);
    expect(spyAddPurchased).not.toHaveBeenCalled();
    expect(prisma.tenantSmsWallet.update).not.toHaveBeenCalled();
  });

  // 11. Concurrent webhook delivery protection
  it('11. Protects against concurrent webhook delivery via database transaction isolation and status checking', async () => {
    prisma.paymentOrder.findUnique.mockResolvedValueOnce({
      id: 'order-concurrent',
      reference: orderRef,
      gateway: PaymentGatewayProvider.PAYHERE,
      tenantId,
      amount: 1500,
      currency: 'LKR',
      status: PaymentOrderStatus.PROCESSING,
      purpose: PaymentPurpose.SMS_PACKAGE_PURCHASE,
      metadata: { packageId, credits: 1000 },
    });

    prisma.payment.findUnique.mockResolvedValueOnce({
      id: 'payment-already-processed',
      transactionId: 'TX-1',
      status: PaymentRecordStatus.PAID,
    });

    gatewayRegistry.get.mockReturnValue({
      verifyWebhook: jest.fn().mockReturnValue({
        valid: true,
        orderReference: orderRef,
        transactionId: 'TX-1',
        status: 'paid',
        amount: 1500,
        currency: 'LKR',
        rawPayload: {},
      }),
    });

    const spyAddPurchased = jest.spyOn(smsWalletService, 'addPurchasedCredits');
    const result = await paymentProcessorService.processWebhook(PaymentGatewayProvider.PAYHERE, {
      order_id: orderRef,
    });

    expect(result.alreadyProcessed).toBe(true);
    expect(spyAddPurchased).not.toHaveBeenCalled();
  });

  // 12. Admin request submission
  it('12. Salon owner can submit an admin assistance recharge request without auto-crediting', async () => {
    prisma.smsPackage.findUnique.mockResolvedValue({
      id: packageId,
      name: 'Custom 500 Pack',
      credits: 500,
      price: 600,
      currency: 'LKR',
      isActive: true,
    });

    prisma.smsRechargeRequest.create.mockResolvedValue({
      id: 'req-001',
      tenantId,
      packageId,
      requestedCredits: 500,
      status: SmsRechargeRequestStatus.PENDING,
      ownerMessage: 'Please allocate credits, bank transfer sent',
      createdAt: new Date(),
    });

    const req = await rechargeRequestsService.createRequest(tenantId, {
      packageId,
      ownerMessage: 'Please allocate credits, bank transfer sent',
    });

    expect(req.status).toBe(SmsRechargeRequestStatus.PENDING);
    expect(req.requestedCredits).toBe(500);
    // Crucial: Wallet update was NOT called
    expect(prisma.tenantSmsWallet.update).not.toHaveBeenCalled();
  });

  // 13. Admin request fulfillment
  it('13. Admin fulfilling a request atomically credits wallet, updates status, and logs audit', async () => {
    prisma.smsRechargeRequest.findUnique.mockResolvedValue({
      id: 'req-001',
      tenantId,
      packageId,
      requestedCredits: 500,
      status: SmsRechargeRequestStatus.PENDING,
    });

    prisma.tenantSmsWallet.findUnique.mockResolvedValue({
      id: 'wallet-req',
      tenantId,
      balance: 100,
      totalPurchased: 100,
      totalConsumed: 0,
      lowBalanceThreshold: 50,
      lowBalanceWarned: false,
      isActive: true,
    });

    prisma.tenantSmsWallet.update.mockResolvedValue({
      id: 'wallet-req',
      tenantId,
      balance: 600,
      totalPurchased: 600,
      totalConsumed: 0,
      isActive: true,
    });

    prisma.smsRechargeRequest.update.mockResolvedValue({
      id: 'req-001',
      status: SmsRechargeRequestStatus.FULFILLED,
      fulfilledAt: new Date(),
      actionedByAdminId: superAdminId,
      creditTransactionId: 'tx-req-1',
    });

    const fulfillment = await rechargeRequestsService.fulfillRequest(
      'req-001',
      superAdminId,
      {
        credits: 500,
        adminNotes: 'Verified bank receipt',
      },
    );

    expect(fulfillment.success).toBe(true);
    expect(fulfillment.request.status).toBe(SmsRechargeRequestStatus.FULFILLED);
    expect(prisma.tenantSmsWallet.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          balance: 600,
        }),
      }),
    );
    expect(prisma.smsCreditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: SmsCreditTransactionType.ADJUSTMENT,
          amount: 500,
          balanceAfter: 600,
        }),
      }),
    );
  });

  // 14. Duplicate admin fulfillment prevention
  it('14. Prevents duplicate admin fulfillment of an already fulfilled or rejected request', async () => {
    prisma.smsRechargeRequest.findUnique.mockResolvedValue({
      id: 'req-fulfilled',
      tenantId,
      status: SmsRechargeRequestStatus.FULFILLED,
      fulfilledAt: new Date(),
    });

    await expect(
      rechargeRequestsService.fulfillRequest('req-fulfilled', superAdminId, { credits: 500 }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.tenantSmsWallet.update).not.toHaveBeenCalled();
  });

  // 15. Unauthorized allocation attempts
  it('15. Rejects request creation with negative or zero credits and enforces validation', async () => {
    await expect(
      rechargeRequestsService.createRequest(tenantId, {
        requestedCredits: -50,
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      rechargeRequestsService.createRequest(tenantId, {
        requestedCredits: 0,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // 16. SMS wallet balance and transaction history
  it('16. Maintains accurate balance and transaction history ledger with proper attribution', async () => {
    prisma.smsCreditTransaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        tenantId,
        type: SmsCreditTransactionType.PURCHASE,
        amount: 1000,
        balanceAfter: 1000,
        description: 'PayHere purchase: Silver SMS Package',
        createdAt: new Date(),
      },
      {
        id: 'tx-2',
        tenantId,
        type: SmsCreditTransactionType.USAGE,
        amount: -2,
        balanceAfter: 998,
        description: 'SMS notification for appointment #101',
        createdAt: new Date(),
      },
    ]);
    prisma.smsCreditTransaction.count.mockResolvedValue(2);

    const history = await smsWalletService.listTransactions(tenantId, { page: 1, limit: 10 });
    expect(history.data).toHaveLength(2);
    expect(history.data[0].balanceAfter).toBe(1000);
    expect(history.data[1].balanceAfter).toBe(998);
  });

  // 17. Existing SMS sending and credit deduction
  it('17. Preserves SMS credit deduction across appointments and POS eBills', async () => {
    prisma.tenantSmsWallet.findUnique.mockResolvedValue({
      id: 'wallet-deduct',
      tenantId,
      balance: 100,
      totalPurchased: 100,
      totalConsumed: 10,
      lowBalanceThreshold: 20,
      lowBalanceWarned: false,
      isActive: true,
    });
    prisma.tenantSmsWallet.update.mockResolvedValue({
      id: 'wallet-deduct',
      tenantId,
      balance: 98,
      totalPurchased: 100,
      totalConsumed: 12,
      lowBalanceWarned: false,
      isActive: true,
    });

    const deductResult = await smsWalletService.deductCredits({
      tenantId,
      credits: 2,
      recipient: '0771234567',
      purpose: 'POS eBill dispatch #554',
    });
    expect(deductResult.deducted).toBe(true);
    expect(deductResult.balanceAfter).toBe(98);
    expect(prisma.smsCreditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: SmsCreditTransactionType.USAGE,
          amount: -2,
          balanceAfter: 98,
        }),
      }),
    );
  });

  // 18. Existing subscription billing regression
  it('18. Does not alter or break subscription activation, renewal, or upgrade payment flows', async () => {
    gatewayRegistry.get.mockReturnValue({
      verifyWebhook: jest.fn().mockReturnValue({
        valid: true,
        orderReference: 'PO-SUB-001',
        transactionId: 'TX-SUB-SUCCESS',
        status: 'paid',
        amount: 8000,
        currency: 'LKR',
        rawPayload: {},
      }),
    });

    const subId = 'sub-platinum-1';
    prisma.paymentOrder.findUnique.mockResolvedValue({
      id: 'order-sub-1',
      reference: 'PO-SUB-001',
      gateway: PaymentGatewayProvider.PAYHERE,
      tenantId,
      subscriptionId: subId,
      amount: 8000,
      currency: 'LKR',
      status: PaymentOrderStatus.PENDING,
      purpose: PaymentPurpose.SUBSCRIPTION_ACTIVATE,
      subscription: { id: subId, status: SubscriptionStatus.PENDING },
    });

    const spyAddPurchased = jest.spyOn(smsWalletService, 'addPurchasedCredits');

    await paymentProcessorService.processWebhook(PaymentGatewayProvider.PAYHERE, {
      order_id: 'PO-SUB-001',
    });

    // Should NOT credit SMS wallet on normal subscription payment
    expect(spyAddPurchased).not.toHaveBeenCalled();
    expect(prisma.paymentOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PaymentOrderStatus.PAID,
        }),
      }),
    );
  });

  describe('Custom Amount SMS Recharge (1 SMS = LKR 1.00 Rule)', () => {
    it('19. Resolves custom order pricing accurately for LKR 100, 250, 750, and 1,500', async () => {
      const sub = {
        id: 'sub-1',
        planId: 'plan-silver',
        currency: 'LKR',
        billingCycle: 'MONTHLY',
      } as any;

      const order100 = await (paymentOrdersService as any).resolveOrderPricing(
        sub,
        PaymentPurpose.SMS_PACKAGE_PURCHASE,
        { amount: 100 },
      );
      expect(order100.amount).toBe(100);
      expect((order100.metadata as any).credits).toBe(100);
      expect((order100.metadata as any).unitPrice).toBe(1);

      const order250 = await (paymentOrdersService as any).resolveOrderPricing(
        sub,
        PaymentPurpose.SMS_PACKAGE_PURCHASE,
        { amount: 250 },
      );
      expect(order250.amount).toBe(250);
      expect((order250.metadata as any).credits).toBe(250);

      const order750 = await (paymentOrdersService as any).resolveOrderPricing(
        sub,
        PaymentPurpose.SMS_PACKAGE_PURCHASE,
        { amount: 750 },
      );
      expect(order750.amount).toBe(750);
      expect((order750.metadata as any).credits).toBe(750);

      const order1500 = await (paymentOrdersService as any).resolveOrderPricing(
        sub,
        PaymentPurpose.SMS_PACKAGE_PURCHASE,
        { amount: 1500 },
      );
      expect(order1500.amount).toBe(1500);
      expect((order1500.metadata as any).credits).toBe(1500);
    });

    it('20. Rejects invalid, negative, zero, and out-of-bounds custom amounts (< 50, > 500,000)', async () => {
      const sub = { id: 'sub-1', planId: 'plan-silver', currency: 'LKR' } as any;

      await expect(
        (paymentOrdersService as any).resolveOrderPricing(
          sub,
          PaymentPurpose.SMS_PACKAGE_PURCHASE,
          { amount: 0 },
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        (paymentOrdersService as any).resolveOrderPricing(
          sub,
          PaymentPurpose.SMS_PACKAGE_PURCHASE,
          { amount: -50 },
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        (paymentOrdersService as any).resolveOrderPricing(
          sub,
          PaymentPurpose.SMS_PACKAGE_PURCHASE,
          { amount: 25 },
        ),
      ).rejects.toThrow('Minimum recharge amount is LKR 50.');

      await expect(
        (paymentOrdersService as any).resolveOrderPricing(
          sub,
          PaymentPurpose.SMS_PACKAGE_PURCHASE,
          { amount: 600000 },
        ),
      ).rejects.toThrow('Maximum recharge amount is LKR 500,000.');
    });

    it('21. Fulfills custom amount SMS recharge webhook without requiring packageId and adds exact credits', async () => {
      gatewayRegistry.get.mockReturnValue({
        verifyWebhook: jest.fn().mockReturnValue({
          valid: true,
          orderReference: 'PO-CUSTOM-750',
          transactionId: 'TX-CUSTOM-750',
          status: 'paid',
          amount: 750,
          currency: 'LKR',
          rawPayload: {},
        }),
      });

      prisma.paymentOrder.findUnique.mockResolvedValue({
        id: 'order-custom-750',
        reference: 'PO-CUSTOM-750',
        gateway: PaymentGatewayProvider.PAYHERE,
        tenantId,
        subscriptionId: 'sub-silver-1',
        amount: 750,
        currency: 'LKR',
        status: PaymentOrderStatus.PENDING,
        purpose: PaymentPurpose.SMS_PACKAGE_PURCHASE,
        metadata: {
          packageId: null,
          packageName: 'SMS Custom Recharge (750 Credits)',
          credits: 750,
          amount: 750,
          currency: 'LKR',
          unitPrice: 1.0,
        },
      });

      const spyAddPurchased = jest.spyOn(smsWalletService, 'addPurchasedCredits');

      await paymentProcessorService.processWebhook(
        PaymentGatewayProvider.PAYHERE,
        {
          order_id: 'PO-CUSTOM-750',
        },
      );

      expect(spyAddPurchased).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          credits: 750,
          packageId: null,
          amount: 750,
          paymentOrderId: 'order-custom-750',
        }),
      );
    });

    it('22. Preserves wallet balance when mixing custom PayHere recharge (LKR 500 = 500 SMS) with admin allocation (300 SMS)', async () => {
      let balance = 200;
      const getWallet = () => ({
        id: 'wallet-1',
        tenantId,
        balance,
        totalPurchased: balance,
        totalConsumed: 0,
        lowBalanceThreshold: 50,
        lowBalanceWarned: false,
        isActive: true,
      });

      prisma.tenantSmsWallet.findUnique.mockImplementation(async () => getWallet());
      prisma.tenantSmsWallet.upsert.mockImplementation(async () => getWallet());

      prisma.tenantSmsWallet.update.mockImplementation(async (args: any) => {
        balance = args.data.balance;
        return {
          id: 'wallet-1',
          tenantId,
          balance,
          totalPurchased: args.data.totalPurchased,
        };
      });

      // 1. PayHere custom recharge: LKR 500 -> +500 credits
      const step1 = await smsWalletService.addPurchasedCredits({
        tenantId,
        credits: 500,
        paymentOrderId: 'order-payhere-500',
        packageId: null,
        packageName: 'SMS Custom Recharge (500 Credits)',
        paymentReference: 'TX-PAYHERE-500',
        amount: 500,
        currency: 'LKR',
      });
      expect(step1.balance).toBe(700);

      // 2. Admin allocates 300 credits
      const step2 = await smsWalletService.addCredits(
        tenantId,
        superAdminId,
        300,
        'Direct Admin Top-Up',
      );
      expect(step2.wallet.balance).toBe(1000);
    });
  });
});
