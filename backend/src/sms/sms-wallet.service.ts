import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import {
  FeatureStatus,
  InAppNotificationStatus,
  NotificationType,
  Prisma,
  SmsCreditTransactionType,
  SmsDeliveryStatus,
  SmsPaymentMethod,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { buildPaginatedResponse, resolvePagination } from '../common/dto/pagination.dto';
import { maskPhoneNumber } from './sms-calculator.util';
import { SmsPaginationQueryDto } from './dto/sms-package.dto';

export interface WalletOverview {
  tenantId: string;
  balance: number;
  totalPurchased: number;
  totalConsumed: number;
  lowBalanceThreshold: number;
  isLowBalance: boolean;
  isOutOfCredits: boolean;
  isPlanCovered: boolean;
  canSend: boolean;
  status: 'PLAN_INCLUDED' | 'HEALTHY' | 'LOW' | 'EMPTY' | 'INACTIVE';
  isActive: boolean;
  activatedAt: Date | null;
  initialBonusGranted: boolean;
  initialBonusGrantedAt: Date | null;
  smsRateLkr: number;
}

@Injectable()
export class SmsWalletService {
  private readonly logger = new Logger(SmsWalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves or creates the isolated SMS wallet for the given tenant.
   * New wallets start with isActive = false and initialBonusGranted = false.
   */
  async getOrCreateWallet(tenantId: string) {
    const existing = await this.prisma.tenantSmsWallet.findUnique({
      where: { tenantId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.tenantSmsWallet.create({
      data: {
        tenantId,
        balance: 0,
        totalPurchased: 0,
        totalConsumed: 0,
        lowBalanceThreshold: 20,
        lowBalanceWarned: false,
        isActive: false,
        initialBonusGranted: false,
      },
    });
  }

  /**
   * Checks whether the tenant's current active subscription base plan
   * already includes unlimited/quota SMS notifications.
   */
  async isSmsCoveredByBasePlan(tenantId: string): Promise<boolean> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIAL,
            SubscriptionStatus.SUSPENDED,
            SubscriptionStatus.PAST_DUE,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        subscriptionFeatures: {
          where: { enabled: true },
          include: { feature: true },
        },
      },
    });

    if (!subscription) return false;

    // Check if SMS_NOTIFICATIONS is included in active plan features
    const hasPlanFeature = (subscription.subscriptionFeatures ?? []).some(
      (sf) =>
        sf.enabled &&
        sf.feature?.status === FeatureStatus.ACTIVE &&
        (sf.feature.code === 'SMS_NOTIFICATIONS' || sf.feature.code === 'SMS'),
    );

    return hasPlanFeature;
  }

  /**
   * Returns a complete high-level overview of the tenant's SMS wallet.
   */
  async getWalletOverview(tenantId: string): Promise<WalletOverview> {
    const wallet = await this.getOrCreateWallet(tenantId);
    const isPlanCovered = await this.isSmsCoveredByBasePlan(tenantId);

    const isOutOfCredits = !isPlanCovered && wallet.balance <= 0;
    const isLowBalance =
      !isPlanCovered && wallet.balance > 0 && wallet.balance <= wallet.lowBalanceThreshold;
    const canSend = isPlanCovered || (wallet.isActive && wallet.balance > 0);

    let status: 'PLAN_INCLUDED' | 'HEALTHY' | 'LOW' | 'EMPTY' | 'INACTIVE' = 'HEALTHY';
    if (isPlanCovered) {
      status = 'PLAN_INCLUDED';
    } else if (!wallet.isActive) {
      status = 'INACTIVE';
    } else if (isOutOfCredits) {
      status = 'EMPTY';
    } else if (isLowBalance) {
      status = 'LOW';
    }

    return {
      tenantId,
      balance: wallet.balance,
      totalPurchased: wallet.totalPurchased,
      totalConsumed: wallet.totalConsumed,
      lowBalanceThreshold: wallet.lowBalanceThreshold,
      isLowBalance,
      isOutOfCredits,
      isPlanCovered,
      canSend,
      status,
      isActive: wallet.isActive,
      activatedAt: wallet.activatedAt,
      initialBonusGranted: wallet.initialBonusGranted,
      initialBonusGrantedAt: wallet.initialBonusGrantedAt,
      smsRateLkr: 1,
    };
  }

  /**
   * Fast check before dispatching SMS: determines if tenant is eligible to send.
   */
  async canTenantSendSms(
    tenantId: string,
    creditsNeeded: number = 1,
  ): Promise<{ canSend: boolean; isPlanCovered: boolean; availableCredits: number; reason?: string }> {
    const isPlanCovered = await this.isSmsCoveredByBasePlan(tenantId);
    if (isPlanCovered) {
      return { canSend: true, isPlanCovered: true, availableCredits: Infinity };
    }

    const wallet = await this.getOrCreateWallet(tenantId);
    if (!wallet.isActive) {
      return {
        canSend: false,
        isPlanCovered: false,
        availableCredits: wallet.balance,
        reason:
          'SMS notifications are not activated for your salon. Please contact the Super Admin to activate SMS and add credits.',
      };
    }

    if (wallet.balance < creditsNeeded) {
      return {
        canSend: false,
        isPlanCovered: false,
        availableCredits: wallet.balance,
        reason:
          wallet.balance === 0
            ? 'You have 0 SMS credits remaining. Please contact the Super Admin to add additional SMS credits.'
            : `Insufficient SMS credits. This message requires ${creditsNeeded} credit(s), but only ${wallet.balance} is available. Contact the Super Admin to add more credits.`,
      };
    }

    return {
      canSend: true,
      isPlanCovered: false,
      availableCredits: wallet.balance,
    };
  }

  /**
   * Alias for canTenantSendSms
   */
  async checkSmsEligibility(
    tenantId: string,
    creditsNeeded: number = 1,
  ) {
    return this.canTenantSendSms(tenantId, creditsNeeded);
  }

  /**
   * Atomically reserves and deducts credits for an outgoing SMS message.
   * Concurrency-safe and prevents negative balances.
   */
  async deductCredits(params: {
    tenantId: string;
    credits: number;
    purpose: string;
    recipient: string;
    reference?: string;
    idempotencyKey?: string;
    metadata?: any;
  }): Promise<{ deducted: boolean; transactionId?: string; balanceAfter: number }> {
    const { tenantId, credits, purpose, recipient, reference, idempotencyKey, metadata } = params;

    const isPlanCovered = await this.isSmsCoveredByBasePlan(tenantId);
    if (isPlanCovered) {
      // Message is covered under higher-tier plan quota; does not deduct purchased credits
      const wallet = await this.getOrCreateWallet(tenantId);
      return { deducted: false, balanceAfter: wallet.balance };
    }

    return this.prisma.$transaction(async (tx) => {
      // Find wallet with pessimistic/atomic consistency
      const wallet = await tx.tenantSmsWallet.findUnique({
        where: { tenantId },
      });

      if (!wallet || wallet.balance < credits) {
        throw new BadRequestException(
          `Insufficient SMS credits. Available: ${wallet?.balance ?? 0}, Required: ${credits}.`,
        );
      }

      const balanceAfter = wallet.balance - credits;
      const totalConsumed = wallet.totalConsumed + credits;

      // Check if this deduction crosses the low-balance threshold
      let shouldTriggerLowBalanceWarning = false;
      let setWarnedFlag = wallet.lowBalanceWarned;

      if (balanceAfter <= wallet.lowBalanceThreshold && !wallet.lowBalanceWarned) {
        shouldTriggerLowBalanceWarning = true;
        setWarnedFlag = true;
      }

      await tx.tenantSmsWallet.update({
        where: { id: wallet.id },
        data: {
          balance: balanceAfter,
          totalConsumed,
          lowBalanceWarned: setWarnedFlag,
        },
      });

      const txRecord = await tx.smsCreditTransaction.create({
        data: {
          tenantId,
          type: SmsCreditTransactionType.USAGE,
          amount: -credits,
          balanceAfter,
          reference: reference || idempotencyKey || null,
          description: `SMS dispatched to ${maskPhoneNumber(recipient)} (${credits} credit${credits > 1 ? 's' : ''})`,
          metadata: {
            recipient: maskPhoneNumber(recipient),
            purpose,
            credits,
            ...(metadata || {}),
          },
        },
      });

      // If low-balance threshold crossed, dispatch in-app notification
      if (shouldTriggerLowBalanceWarning) {
        await this.dispatchLowBalanceNotification(tx, tenantId, balanceAfter, wallet.lowBalanceThreshold);
      }

      return {
        deducted: true,
        transactionId: txRecord.id,
        balanceAfter,
      };
    });
  }

  /**
   * Restores/refunds credits if message dispatch fails at the SMS gateway before being billable.
   */
  async refundCredits(params: {
    tenantId: string;
    credits: number;
    reason: string;
    reference?: string;
    recipient?: string;
  }): Promise<{ refunded: boolean; balanceAfter: number }> {
    const { tenantId, credits, reason, reference, recipient } = params;

    const isPlanCovered = await this.isSmsCoveredByBasePlan(tenantId);
    if (isPlanCovered) {
      const wallet = await this.getOrCreateWallet(tenantId);
      return { refunded: false, balanceAfter: wallet.balance };
    }

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.tenantSmsWallet.findUnique({
        where: { tenantId },
      });

      if (!wallet) {
        throw new NotFoundException(`SMS wallet for tenant ${tenantId} not found.`);
      }

      const balanceAfter = wallet.balance + credits;
      const totalConsumed = Math.max(0, wallet.totalConsumed - credits);

      // If balance is now above threshold, reset warned flag
      const lowBalanceWarned =
        balanceAfter > wallet.lowBalanceThreshold ? false : wallet.lowBalanceWarned;

      await tx.tenantSmsWallet.update({
        where: { id: wallet.id },
        data: {
          balance: balanceAfter,
          totalConsumed,
          lowBalanceWarned,
        },
      });

      await tx.smsCreditTransaction.create({
        data: {
          tenantId,
          type: SmsCreditTransactionType.REFUND,
          amount: credits,
          balanceAfter,
          reference: reference || null,
          description: `Refund: ${reason}${recipient ? ` (to ${maskPhoneNumber(recipient)})` : ''}`,
          metadata: {
            reason,
            recipient: recipient ? maskPhoneNumber(recipient) : undefined,
          },
        },
      });

      return { refunded: true, balanceAfter };
    });
  }

  /**
   * Adds credits to the tenant's wallet following verified payment of an SMS package.
   * Atomic, idempotent, and updates threshold status.
   */
  async addPurchasedCredits(params: {
    tenantId: string;
    credits: number;
    paymentOrderId: string;
    packageId?: string | null;
    packageName: string;
    paymentReference: string;
    amount: number;
    currency: string;
  }) {
    const {
      tenantId,
      credits,
      paymentOrderId,
      packageId,
      packageName,
      paymentReference,
      amount,
      currency,
    } = params;

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.tenantSmsWallet.upsert({
        where: { tenantId },
        update: {},
        create: {
          tenantId,
          balance: 0,
          totalPurchased: 0,
          totalConsumed: 0,
          lowBalanceThreshold: 20,
          lowBalanceWarned: false,
        },
      });

      const newBalance = wallet.balance + credits;
      const newTotalPurchased = wallet.totalPurchased + credits;

      // When balance rises above threshold, clear warned flag so future drop warns again
      const lowBalanceWarned =
        newBalance > wallet.lowBalanceThreshold ? false : wallet.lowBalanceWarned;

      await tx.tenantSmsWallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBalance,
          totalPurchased: newTotalPurchased,
          lowBalanceWarned,
          isActive: true,
          activatedAt: wallet.activatedAt || new Date(),
        },
      });

      await tx.smsCreditTransaction.create({
        data: {
          tenantId,
          type: SmsCreditTransactionType.PURCHASE,
          amount: credits,
          balanceAfter: newBalance,
          reference: paymentReference,
          paymentOrderId,
          packageId,
          description: `Purchased ${packageName} (${credits} SMS credits)`,
          metadata: {
            packageName,
            credits,
            amount,
            currency,
            paymentOrderId,
            paymentReference,
          },
        },
      });

      this.logger.log(
        `Added ${credits} SMS credits to tenant ${tenantId}. New balance: ${newBalance}.`,
      );

      return { balance: newBalance, totalPurchased: newTotalPurchased };
    });
  }

  /**
   * Super Admin manual credit adjustment (bonus, test credits, or correction).
   */
  async adjustCredits(
    tenantIdOrParams:
      | string
      | { tenantId: string; amount: number; reason: string; performedBy?: string },
    amountParam?: number,
    reasonParam?: string,
    performedByParam?: string,
  ) {
    let tenantId: string;
    let amount: number;
    let reason: string;
    let performedBy: string | undefined;

    if (typeof tenantIdOrParams === 'object') {
      tenantId = tenantIdOrParams.tenantId;
      amount = tenantIdOrParams.amount;
      reason = tenantIdOrParams.reason;
      performedBy = tenantIdOrParams.performedBy;
    } else {
      tenantId = tenantIdOrParams;
      amount = amountParam!;
      reason = reasonParam!;
      performedBy = performedByParam;
    }

    if (amount === 0) {
      throw new BadRequestException('Adjustment amount cannot be zero.');
    }

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.tenantSmsWallet.upsert({
        where: { tenantId },
        update: {},
        create: {
          tenantId,
          balance: 0,
          totalPurchased: 0,
          totalConsumed: 0,
          lowBalanceThreshold: 20,
          lowBalanceWarned: false,
        },
      });

      if (amount < 0 && wallet.balance + amount < 0) {
        throw new BadRequestException(
          `Cannot deduct ${Math.abs(amount)} credits: current balance is only ${wallet.balance}.`,
        );
      }

      const balanceAfter = wallet.balance + amount;
      const lowBalanceWarned =
        balanceAfter > wallet.lowBalanceThreshold ? false : wallet.lowBalanceWarned;

      await tx.tenantSmsWallet.update({
        where: { id: wallet.id },
        data: {
          balance: balanceAfter,
          lowBalanceWarned,
        },
      });

      await tx.smsCreditTransaction.create({
        data: {
          tenantId,
          type: SmsCreditTransactionType.ADJUSTMENT,
          amount,
          balanceAfter,
          description: `Manual Adjustment: ${reason}`,
          metadata: {
            reason,
            performedBy,
          },
        },
      });

      return { balanceAfter, amount };
    });
  }

  /**
   * Configures the low balance warning threshold for the tenant (default: 20).
   */
  async setLowBalanceThreshold(tenantId: string, threshold: number) {
    if (threshold < 0) {
      throw new BadRequestException('Threshold cannot be negative.');
    }

    const wallet = await this.getOrCreateWallet(tenantId);
    return this.prisma.tenantSmsWallet.update({
      where: { id: wallet.id },
      data: {
        lowBalanceThreshold: threshold,
        // If balance is currently above new threshold, reset warned flag
        lowBalanceWarned: wallet.balance > threshold ? false : wallet.lowBalanceWarned,
      },
    });
  }

  /**
   * Creates an in-app notification when the balance crosses the configured threshold downward.
   */
  private async dispatchLowBalanceNotification(
    tx: Prisma.TransactionClient,
    tenantId: string,
    balance: number,
    threshold: number,
  ) {
    try {
      await tx.notification.create({
        data: {
          tenantId,
          type: NotificationType.LOW_SMS_BALANCE,
          title: 'Your SMS Credits Are Running Low!',
          message: `You have only ${balance} SMS credit${balance === 1 ? '' : 's'} remaining. Purchase more credits to continue sending appointment reminders and customer notifications.`,
          status: InAppNotificationStatus.UNREAD,
          metadata: {
            balance,
            threshold,
            actionUrl: '/salon/subscription',
          },
        },
      });
      this.logger.log(`Created Low SMS Balance notification for tenant ${tenantId} (Balance: ${balance})`);
    } catch (err: any) {
      this.logger.error(`Failed to create low balance notification: ${err.message || err}`);
    }
  }

  /**
   * Returns paginated credit transactions (purchases, usages, refunds).
   */
  async listTransactions(tenantId: string, query: SmsPaginationQueryDto) {
    const { page, limit, offset } = resolvePagination(query.page, query.limit);

    const [data, total] = await Promise.all([
      this.prisma.smsCreditTransaction.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          package: { select: { id: true, name: true } },
          paymentOrder: { select: { id: true, reference: true, amount: true, currency: true } },
        },
      }),
      this.prisma.smsCreditTransaction.count({ where: { tenantId } }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * Returns paginated SMS message logs for the salon owner.
   */
  async listUsageLogs(tenantId: string, query: SmsPaginationQueryDto) {
    const { page, limit, offset } = resolvePagination(query.page, query.limit);

    const [data, total] = await Promise.all([
      this.prisma.smsMessageLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.smsMessageLog.count({ where: { tenantId } }),
    ]);

    const formatted = data.map((log) => ({
      id: log.id,
      recipientMasked: maskPhoneNumber(log.recipient),
      messagePreview: log.message.length > 50 ? `${log.message.slice(0, 50)}…` : log.message,
      purpose: log.purpose,
      segments: log.segments,
      creditsDeducted: log.creditsDeducted,
      status: log.status,
      provider: log.provider,
      providerMessageId: log.providerMessageId,
      createdAt: log.createdAt,
    }));

    return buildPaginatedResponse(formatted, total, page, limit);
  }

  async updateLowBalanceThreshold(tenantId: string, threshold: number) {
    return this.setLowBalanceThreshold(tenantId, threshold);
  }

  async getCreditTransactions(tenantId: string, query: SmsPaginationQueryDto) {
    return this.listTransactions(tenantId, query);
  }

  async getSmsLogs(tenantId: string, query: SmsPaginationQueryDto) {
    return this.listUsageLogs(tenantId, query);
  }

  async getGlobalTransactions(query: SmsPaginationQueryDto & { tenantId?: string; type?: SmsCreditTransactionType }) {
    const { page, limit, offset } = resolvePagination(query.page, query.limit);
    const where: Prisma.SmsCreditTransactionWhereInput = {};
    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }
    if (query.type) {
      where.type = query.type;
    }

    const [data, total] = await Promise.all([
      this.prisma.smsCreditTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          tenant: { select: { id: true, name: true } },
          package: { select: { id: true, name: true } },
          paymentOrder: { select: { id: true, reference: true, amount: true, currency: true } },
        },
      }),
      this.prisma.smsCreditTransaction.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * Super Admin activates SMS for a Basic/Silver salon.
   * Atomically activates SMS and optionally adds initial credits in one operation.
   * No automatic free bonus credits are granted.
   */
  async activateSms(
    tenantId: string,
    adminUserId: string,
    initialCredits: number = 0,
    notes?: string,
  ) {
    const isPlanCovered = await this.isSmsCoveredByBasePlan(tenantId);
    if (isPlanCovered) {
      throw new BadRequestException(
        'SMS notifications are already included in this salon subscription plan (Gold/Platinum/Enterprise). Super Admin manual activation is not required.',
      );
    }

    const creditsToAdd = Math.max(0, Number(initialCredits) || 0);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true },
      });
      if (!tenant) {
        throw new NotFoundException(`Salon with ID ${tenantId} not found.`);
      }

      let wallet = await tx.tenantSmsWallet.findUnique({
        where: { tenantId },
      });

      if (!wallet) {
        wallet = await tx.tenantSmsWallet.create({
          data: {
            tenantId,
            balance: 0,
            totalPurchased: 0,
            totalConsumed: 0,
            lowBalanceThreshold: 20,
            lowBalanceWarned: false,
            isActive: false,
            initialBonusGranted: false,
          },
        });
      }

      const now = new Date();
      const newBalance = wallet.balance + creditsToAdd;
      const newTotalPurchased = wallet.totalPurchased + creditsToAdd;

      const updatedWallet = await tx.tenantSmsWallet.update({
        where: { id: wallet.id },
        data: {
          isActive: true,
          activatedAt: now,
          balance: newBalance,
          totalPurchased: newTotalPurchased,
          lowBalanceWarned:
            newBalance > wallet.lowBalanceThreshold ? false : wallet.lowBalanceWarned,
        },
      });

      let txRecord: any = null;
      if (creditsToAdd > 0) {
        txRecord = await tx.smsCreditTransaction.create({
          data: {
            tenantId,
            type: SmsCreditTransactionType.ADJUSTMENT,
            amount: creditsToAdd,
            balanceAfter: newBalance,
            description: notes
              ? `SMS Activation Credits: ${notes}`
              : `SMS Activation: +${creditsToAdd.toLocaleString()} credits allocated by Super Admin`,
            metadata: {
              credits: creditsToAdd,
              activatedByAdminId: adminUserId,
              activatedAt: now.toISOString(),
              notes,
            },
          },
        });
      }

      await tx.superAdminAuditLog.create({
        data: {
          adminUserId,
          action: 'SMS_ACTIVATE',
          entityType: 'TENANT_SMS_WALLET',
          entityId: wallet.id,
          tenantId,
          oldValue: {
            isActive: wallet.isActive,
            balance: wallet.balance,
          },
          newValue: {
            isActive: true,
            balance: updatedWallet.balance,
            creditsAllocated: creditsToAdd,
          },
          metadata: {
            creditsAllocated: creditsToAdd,
            transactionId: txRecord?.id,
            notes,
          },
        },
      });

      this.logger.log(
        `Super Admin ${adminUserId} activated SMS for salon ${tenantId}. Initial credits: ${creditsToAdd}. New balance: ${updatedWallet.balance}`,
      );

      return {
        success: true,
        message:
          creditsToAdd > 0
            ? `SMS activated successfully and ${creditsToAdd.toLocaleString()} credits allocated.`
            : 'SMS activated successfully.',
        creditsAllocated: creditsToAdd,
        wallet: {
          tenantId,
          balance: updatedWallet.balance,
          totalPurchased: updatedWallet.totalPurchased,
          totalConsumed: updatedWallet.totalConsumed,
          isActive: updatedWallet.isActive,
          activatedAt: updatedWallet.activatedAt,
        },
      };
    });
  }

  /**
   * Super Admin manually allocates additional SMS credits to a salon.
   * Direct credit management (offline payment handled externally).
   */
  async addCredits(
    tenantId: string,
    adminUserId: string,
    credits: number,
    notes?: string,
  ) {
    if (!credits || credits <= 0) {
      throw new BadRequestException('Credits must be greater than 0.');
    }

    const creditsToAdd = Math.floor(credits);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true },
      });
      if (!tenant) {
        throw new NotFoundException(`Salon with ID ${tenantId} not found.`);
      }

      let wallet = await tx.tenantSmsWallet.findUnique({
        where: { tenantId },
      });

      if (!wallet) {
        wallet = await tx.tenantSmsWallet.create({
          data: {
            tenantId,
            balance: 0,
            totalPurchased: 0,
            totalConsumed: 0,
            lowBalanceThreshold: 20,
            lowBalanceWarned: false,
            isActive: false,
            initialBonusGranted: false,
          },
        });
      }

      const now = new Date();
      const newBalance = wallet.balance + creditsToAdd;
      const newTotalPurchased = wallet.totalPurchased + creditsToAdd;

      const updatedWallet = await tx.tenantSmsWallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBalance,
          totalPurchased: newTotalPurchased,
          lowBalanceWarned:
            newBalance > wallet.lowBalanceThreshold ? false : wallet.lowBalanceWarned,
        },
      });

      const txRecord = await tx.smsCreditTransaction.create({
        data: {
          tenantId,
          type: SmsCreditTransactionType.ADJUSTMENT,
          amount: creditsToAdd,
          balanceAfter: newBalance,
          description: notes
            ? `Admin Credit Allocation: ${notes}`
            : `Added +${creditsToAdd.toLocaleString()} SMS credits by Super Admin`,
          metadata: {
            credits: creditsToAdd,
            allocatedByAdminId: adminUserId,
            allocatedAt: now.toISOString(),
            notes,
          },
        },
      });

      await tx.superAdminAuditLog.create({
        data: {
          adminUserId,
          action: 'SMS_CREDITS_ALLOCATED',
          entityType: 'TENANT_SMS_WALLET',
          entityId: wallet.id,
          tenantId,
          oldValue: {
            balance: wallet.balance,
          },
          newValue: {
            balance: updatedWallet.balance,
            creditsAdded: creditsToAdd,
          },
          metadata: {
            creditsAdded: creditsToAdd,
            transactionId: txRecord.id,
            notes,
          },
        },
      });

      this.logger.log(
        `Super Admin ${adminUserId} allocated ${creditsToAdd} credits to salon ${tenantId}. New balance: ${updatedWallet.balance}`,
      );

      return {
        success: true,
        message: `Successfully allocated ${creditsToAdd.toLocaleString()} SMS credits.`,
        creditsAdded: creditsToAdd,
        wallet: {
          tenantId,
          balance: updatedWallet.balance,
          totalPurchased: updatedWallet.totalPurchased,
          totalConsumed: updatedWallet.totalConsumed,
          isActive: updatedWallet.isActive,
        },
      };
    });
  }

  /**
   * Super Admin deactivates SMS for a Basic/Silver salon.
   * Disables SMS sending while strictly preserving remaining credits and history.
   */
  async deactivateSms(tenantId: string, adminUserId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.tenantSmsWallet.findUnique({
        where: { tenantId },
      });
      if (!wallet) {
        throw new NotFoundException(`SMS wallet for salon ${tenantId} not found.`);
      }

      const updatedWallet = await tx.tenantSmsWallet.update({
        where: { id: wallet.id },
        data: {
          isActive: false,
        },
      });

      await tx.superAdminAuditLog.create({
        data: {
          adminUserId,
          action: 'SMS_DEACTIVATE',
          entityType: 'TENANT_SMS_WALLET',
          entityId: wallet.id,
          tenantId,
          oldValue: { isActive: wallet.isActive, balance: wallet.balance },
          newValue: { isActive: false, reason: reason || 'Deactivated by Super Admin' },
        },
      });

      this.logger.log(
        `Super Admin ${adminUserId} deactivated SMS for salon ${tenantId}. Remaining balance preserved: ${wallet.balance}.`,
      );

      return {
        success: true,
        message: 'SMS deactivated successfully. The salon remaining credit balance has been preserved.',
        wallet: {
          tenantId,
          balance: updatedWallet.balance,
          isActive: updatedWallet.isActive,
        },
      };
    });
  }

  /**
   * Super Admin records manually confirmed payment and allocates SMS credits.
   * Conversion rate: LKR 1 = 1 SMS credit.
   * Concurrency-safe, atomic, and enforces unique payment references.
   */
  async addManualPaymentCredits(params: {
    tenantId: string;
    amount: number;
    paymentMethod?: SmsPaymentMethod | string;
    paymentReference: string;
    paymentDate: Date | string;
    notes?: string;
    adminUserId: string;
  }) {
    const { tenantId, amount, paymentReference, notes, adminUserId } = params;

    if (!amount || amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0.');
    }

    if (!paymentReference || !paymentReference.trim()) {
      throw new BadRequestException('Payment reference is required.');
    }

    const trimmedReference = paymentReference.trim();
    const dateObj = params.paymentDate instanceof Date ? params.paymentDate : new Date(params.paymentDate);
    const methodEnum = (params.paymentMethod as SmsPaymentMethod) || SmsPaymentMethod.BANK_TRANSFER;

    // Strict 1:1 business rule: LKR 1 = 1 SMS Credit
    const credits = Math.floor(amount);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true },
      });
      if (!tenant) {
        throw new NotFoundException(`Salon with ID ${tenantId} not found.`);
      }

      // Check idempotency: unique payment reference
      const existingPayment = await tx.smsManualPayment.findFirst({
        where: { paymentReference: trimmedReference },
      });
      if (existingPayment) {
        throw new BadRequestException(
          `A manual payment with reference "${trimmedReference}" has already been recorded for salon ID ${existingPayment.tenantId}.`,
        );
      }

      let wallet = await tx.tenantSmsWallet.findUnique({
        where: { tenantId },
      });

      if (!wallet) {
        wallet = await tx.tenantSmsWallet.create({
          data: {
            tenantId,
            balance: 0,
            totalPurchased: 0,
            totalConsumed: 0,
            lowBalanceThreshold: 20,
            lowBalanceWarned: false,
            isActive: true,
            activatedAt: new Date(),
            initialBonusGranted: false,
          },
        });
      }

      const newBalance = wallet.balance + credits;
      const newTotalPurchased = wallet.totalPurchased + credits;

      // Clear warned flag if balance rises above threshold
      const lowBalanceWarned =
        newBalance > wallet.lowBalanceThreshold ? false : wallet.lowBalanceWarned;

      const updatedWallet = await tx.tenantSmsWallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBalance,
          totalPurchased: newTotalPurchased,
          lowBalanceWarned,
          isActive: true,
          activatedAt: wallet.activatedAt || new Date(),
        },
      });

      const txRecord = await tx.smsCreditTransaction.create({
        data: {
          tenantId,
          type: SmsCreditTransactionType.PURCHASE,
          amount: credits,
          balanceAfter: newBalance,
          reference: trimmedReference,
          description: `Manual Top-up: ${credits.toLocaleString()} credits (LKR ${amount.toLocaleString()}) via ${methodEnum}`,
          metadata: {
            amount,
            currency: 'LKR',
            credits,
            paymentMethod: methodEnum,
            paymentReference: trimmedReference,
            paymentDate: dateObj.toISOString(),
            notes: notes || null,
            confirmedByAdminId: adminUserId,
          },
        },
      });

      const manualPayment = await tx.smsManualPayment.create({
        data: {
          tenantId,
          amount: new Prisma.Decimal(amount),
          credits,
          paymentMethod: methodEnum,
          paymentReference: trimmedReference,
          paymentDate: dateObj,
          confirmedByAdminId: adminUserId,
          notes: notes || null,
          creditTransactionId: txRecord.id,
        },
        include: {
          confirmedBy: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.superAdminAuditLog.create({
        data: {
          adminUserId,
          action: 'SMS_MANUAL_PAYMENT_ALLOCATED',
          entityType: 'SMS_MANUAL_PAYMENT',
          entityId: manualPayment.id,
          tenantId,
          oldValue: { balance: wallet.balance },
          newValue: {
            amount,
            credits,
            paymentReference: trimmedReference,
            balance: newBalance,
          },
          metadata: {
            transactionId: txRecord.id,
            paymentMethod: methodEnum,
            paymentDate: dateObj.toISOString(),
          },
        },
      });

      this.logger.log(
        `Super Admin ${adminUserId} allocated ${credits} credits (LKR ${amount}) to salon ${tenantId}. Reference: ${trimmedReference}. New balance: ${newBalance}.`,
      );

      return {
        success: true,
        message: `Successfully allocated ${credits.toLocaleString()} SMS credits to ${tenant.name}.`,
        payment: manualPayment,
        wallet: {
          tenantId,
          balance: updatedWallet.balance,
          totalPurchased: updatedWallet.totalPurchased,
          totalConsumed: updatedWallet.totalConsumed,
          isActive: updatedWallet.isActive,
        },
      };
    });
  }

  /**
   * Super Admin salon directory with SMS activation status, credits, and subscription details.
   */
  async listSalonsForSms(query: {
    search?: string;
    status?: string;
    plan?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ? Math.max(1, query.page) : 1;
    const limit = query.limit ? Math.min(100, Math.max(1, query.limit)) : 10;
    const skip = (page - 1) * limit;

    const where: Prisma.TenantWhereInput = {};

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { code: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status as any;
    }

    if (query.plan) {
      where.subscriptions = {
        some: {
          plan: {
            code: { equals: query.plan.toUpperCase() },
          },
        },
      };
    }

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          code: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          subscriptions: {
            where: {
              status: {
                in: [
                  SubscriptionStatus.ACTIVE,
                  SubscriptionStatus.TRIAL,
                  SubscriptionStatus.SUSPENDED,
                  SubscriptionStatus.PAST_DUE,
                ],
              },
            },
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              status: true,
              plan: { select: { id: true, code: true, name: true } },
              subscriptionFeatures: {
                where: { enabled: true },
                select: {
                  enabled: true,
                  feature: { select: { code: true, status: true } },
                },
              },
            },
          },
          smsWallet: {
            select: {
              id: true,
              balance: true,
              totalPurchased: true,
              totalConsumed: true,
              lowBalanceThreshold: true,
              isActive: true,
              activatedAt: true,
              initialBonusGranted: true,
              initialBonusGrantedAt: true,
            },
          },
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    const salons = tenants.map((t) => {
      const activeSub = t.subscriptions[0];
      const hasSmsInPlan = (activeSub?.subscriptionFeatures ?? []).some(
        (sf) =>
          sf.enabled &&
          sf.feature?.status === FeatureStatus.ACTIVE &&
          (sf.feature.code === 'SMS_NOTIFICATIONS' || sf.feature.code === 'SMS'),
      );

      const wallet = t.smsWallet || {
        id: null,
        balance: 0,
        totalPurchased: 0,
        totalConsumed: 0,
        lowBalanceThreshold: 20,
        isActive: false,
        activatedAt: null,
        initialBonusGranted: false,
        initialBonusGrantedAt: null,
      };

      return {
        id: t.id,
        name: t.name,
        code: t.code,
        email: t.email,
        phone: t.phone,
        status: t.status,
        createdAt: t.createdAt,
        subscription: activeSub
          ? {
              id: activeSub.id,
              status: activeSub.status,
              plan: activeSub.plan,
            }
          : null,
        isPlanCovered: hasSmsInPlan,
        planCode: activeSub?.plan?.code ?? 'NONE',
        planName: activeSub?.plan?.name ?? 'No Subscription',
        wallet,
      };
    });

    return buildPaginatedResponse(salons, total, page, limit);
  }

  /**
   * Paginated list of manual payments (global or tenant-specific).
   */
  async listManualPayments(query: {
    tenantId?: string;
    page?: number;
    limit?: number;
  }) {
    const { page, limit, offset } = resolvePagination(query.page, query.limit);
    const where: Prisma.SmsManualPaymentWhereInput = {};
    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    const [data, total] = await Promise.all([
      this.prisma.smsManualPayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          tenant: { select: { id: true, name: true, code: true } },
          confirmedBy: { select: { id: true, name: true, email: true } },
          creditTransaction: { select: { id: true, amount: true, balanceAfter: true } },
        },
      }),
      this.prisma.smsManualPayment.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * Tenant-specific manual payment records for salon owner dashboard.
   */
  async getTenantManualPayments(tenantId: string, query: SmsPaginationQueryDto) {
    return this.listManualPayments({
      tenantId,
      page: query.page,
      limit: query.limit,
    });
  }

  /**
   * Super Admin global SMS message logs across all salons with search and status filtering.
   */
  async getGlobalSmsLogs(query: SmsPaginationQueryDto & { tenantId?: string; status?: string }) {
    const { page, limit, offset } = resolvePagination(query.page, query.limit);
    const where: Prisma.SmsMessageLogWhereInput = {};
    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }
    if (query.status) {
      where.status = query.status as any;
    }

    const [data, total] = await Promise.all([
      this.prisma.smsMessageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          tenant: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.smsMessageLog.count({ where }),
    ]);

    const formatted = data.map((log) => ({
      id: log.id,
      tenantId: log.tenantId,
      tenantName: log.tenant?.name || 'Unknown Salon',
      tenantCode: log.tenant?.code,
      recipientMasked: maskPhoneNumber(log.recipient),
      messagePreview: log.message.length > 50 ? `${log.message.slice(0, 50)}…` : log.message,
      purpose: log.purpose,
      segments: log.segments,
      creditsDeducted: log.creditsDeducted,
      status: log.status,
      provider: log.provider,
      providerMessageId: log.providerMessageId,
      providerError: log.providerError,
      createdAt: log.createdAt,
    }));

    return buildPaginatedResponse(formatted, total, page, limit);
  }
}


