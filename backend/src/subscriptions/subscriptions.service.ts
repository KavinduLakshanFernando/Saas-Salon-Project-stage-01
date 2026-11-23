import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import {
  BillingCycle,
  FeatureStatus,
  InvoiceStatus,
  PaymentGatewayProvider,
  PaymentOrderStatus,
  PaymentRecordStatus,
  Plan,
  PlanPrice,
  Prisma,
  Subscription,
  SubscriptionAddOnStatus,
  SubscriptionHistoryAction,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { syncTenantFeatures } from '../database/sync-tenant-features.util';
import { PaymentPurpose } from '../payments/dto/create-payment-order.dto';
import { PlansService } from '../plans/plans.service';
import { getPlanCurrency, isPlanActive } from '../plans/utils/plan-pricing.util';
import {
  normalizeFeatureCodes,
  validateFeatureRecords,
} from '../super-admin/salons/utils/feature-validation.util';
import { buildPaginatedResponse, resolvePagination } from '../common/dto/pagination.dto';
import {
  ActivateSubscriptionDto,
  CreateCustomSubscriptionDto,
  CreateTrialSubscriptionDto,
  ExtendTrialDto,
  PlanChangeQuoteQueryDto,
  RenewSubscriptionDto,
  ScheduleDowngradeDto,
  UpgradeSubscriptionDto,
} from './dto/subscription.dto';
import { SubscriptionListQueryDto } from './dto/subscription-list-query.dto';
import { SubscriptionFeatureService } from './subscription-feature.service';
import { InvoicesService } from '../invoices/invoices.service';
import {
  MANDATORY_TRIAL_DAYS,
  addTrialDays,
  calculateSubscriptionRecurringTotals,
  comparePlanTier,
  extendBillingPeriod,
  isPastDate,
} from './utils/subscription-billing.util';
import { calculatePlanChangeQuote } from './utils/plan-change-quote.util';

type SubscriptionWithPlan = Subscription & { plan: Pick<Plan, 'id' | 'code' | 'displayOrder'> };

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
    private readonly subscriptionFeatureService: SubscriptionFeatureService,
    @Inject(forwardRef(() => InvoicesService))
    @Optional()
    private readonly invoicesService?: InvoicesService,
  ) {}

  async createSubscription(tenantId: string, planId: string) {
    return this.createTrialSubscription(tenantId, { planId });
  }

  async createTrialSubscription(tenantId: string, dto: CreateTrialSubscriptionDto) {
    await this.ensureTenantExists(tenantId);
    await this.assertNoBlockingSubscription(tenantId);

    const plan = await this.plansService.findById(dto.planId);
    if (!isPlanActive(plan) || plan.code === 'CUSTOM') {
      throw new BadRequestException('Plan is not available for trial');
    }

    const planPrice = await this.resolvePlanPrice(plan.id, dto.planPriceId, dto.billingCycle);

    const trialDays = MANDATORY_TRIAL_DAYS; // Exactly 21-day trial
    const trialStart = new Date();
    const trialEnd = addTrialDays(trialStart, trialDays);

    const subscription = await this.prisma.$transaction(async (tx) => {
      const created = await tx.subscription.create({
        data: {
          tenantId,
          planId: plan.id,
          planPriceId: planPrice.id,
          status: SubscriptionStatus.TRIAL,
          billingCycle: planPrice.billingCycle,
          price: planPrice.price,
          currency: planPrice.currency,
          trialStart,
          trialEnd,
          startDate: trialStart,
          endDate: trialEnd,
          nextBillingDate: trialEnd,
        },
      });

      await this.snapshotPlanFeatures(tx, created.id, plan.id);

      await this.recordHistory(tx, {
        subscriptionId: created.id,
        action: SubscriptionHistoryAction.TRIAL_STARTED,
        toPlanId: plan.id,
        toPlanPriceId: planPrice.id,
        toStatus: SubscriptionStatus.TRIAL,
        metadata: { trialDays },
      });

      return created;
    });

    await this.syncTenantFeaturesFromSubscription(subscription.id, tenantId);
    this.logger.log(
      `Trial subscription created: tenant=${tenantId}, subscription=${subscription.id}, days=${trialDays}`,
    );
    return this.findById(subscription.id, tenantId);
  }

  async extendTrial(
    subscriptionId: string,
    tenantId: string,
    dto: ExtendTrialDto,
    performedBy?: string,
  ) {
    const subscription = await this.findTenantSubscriptionOrThrow(subscriptionId, tenantId, {
      plan: true,
    });

    if (
      subscription.status !== SubscriptionStatus.TRIAL &&
      subscription.status !== SubscriptionStatus.SUSPENDED
    ) {
      throw new BadRequestException('Only trial or suspended subscriptions can be extended');
    }

    const currentEnd = subscription.trialEnd ?? subscription.endDate ?? new Date();
    let newTrialEnd: Date;

    if (dto.extraDays) {
      const base = currentEnd.getTime() > Date.now() ? currentEnd : new Date();
      newTrialEnd = addTrialDays(base, dto.extraDays);
    } else if (dto.newTrialEnd) {
      newTrialEnd = new Date(dto.newTrialEnd);
      if (isNaN(newTrialEnd.getTime()) || newTrialEnd.getTime() <= Date.now()) {
        throw new BadRequestException('newTrialEnd must be a valid future date');
      }
    } else {
      throw new BadRequestException('Either extraDays or newTrialEnd is required');
    }

    const fromStatus = subscription.status;
    const previousTrialEnd = subscription.trialEnd;

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.TRIAL,
          trialEnd: newTrialEnd,
          endDate: newTrialEnd,
          nextBillingDate: newTrialEnd,
        },
        include: this.subscriptionInclude(),
      });

      await this.recordHistory(tx, {
        subscriptionId,
        action: SubscriptionHistoryAction.STATUS_CHANGED,
        fromStatus,
        toStatus: SubscriptionStatus.TRIAL,
        performedBy: performedBy ?? null,
        metadata: {
          action: 'TRIAL_EXTENDED',
          previousTrialEnd,
          newTrialEnd,
          reason: dto.reason,
          extendedBy: performedBy ?? 'SUPER_ADMIN',
        },
      });

      return res;
    });

    await this.syncTenantFeaturesFromSubscription(subscriptionId, tenantId);
    this.logger.log(
      `Trial extended for tenant=${tenantId}, subscription=${subscriptionId}, newTrialEnd=${newTrialEnd.toISOString()}`,
    );

    return updated;
  }

  async activateSubscription(
    subscriptionId: string,
    tenantId: string,
    dto: ActivateSubscriptionDto,
    options?: { fromPaymentProcessor?: boolean },
  ) {
    const subscription = await this.findTenantSubscriptionOrThrow(subscriptionId, tenantId, {
      plan: true,
    });

    if (
      subscription.status !== SubscriptionStatus.PENDING &&
      subscription.status !== SubscriptionStatus.TRIAL &&
      subscription.status !== SubscriptionStatus.SUSPENDED
    ) {
      throw new BadRequestException('Only pending, trial, or suspended subscriptions can be activated');
    }

    if (!options?.fromPaymentProcessor) {
      const existingPaid = await this.prisma.paymentOrder.findFirst({
        where: {
          subscriptionId,
          tenantId,
          status: PaymentOrderStatus.PAID,
        },
      });

      if (existingPaid) {
        throw new ConflictException('Subscription payment has already been applied');
      }
    }

    const targetPlanId = dto.planId ?? subscription.planId;
    const planPrice = await this.resolvePlanPrice(
      targetPlanId,
      dto.planPriceId,
      dto.billingCycle ?? (subscription.billingCycle as BillingCycle),
    ).catch(() => null);

    const price = planPrice?.price ?? subscription.price;
    const currency = planPrice?.currency ?? subscription.currency;
    const cycle = planPrice?.billingCycle ?? (subscription.billingCycle as BillingCycle);
    const planPriceId = planPrice?.id ?? subscription.planPriceId;

    const paidAt = new Date();
    const fromStatus = subscription.status;
    const startDate = paidAt;
    const endDate = extendBillingPeriod(paidAt, cycle);

    const { subscription: updated, recordedPayment } = await this.prisma.$transaction(async (tx) => {
      let paymentInfo: {
        order: { id: string; reference: string };
        payment: { id: string; transactionId: string | null; paidAt: Date | null };
      } | null = null;

      if (!options?.fromPaymentProcessor) {
        paymentInfo = await this.recordSubscriptionPayment(tx, {
          tenantId,
          subscriptionId,
          amount: price,
          currency,
          purpose: PaymentPurpose.SUBSCRIPTION_ACTIVATE,
          paymentMethod: dto.paymentMethod ?? 'MANUAL',
          paymentReference: dto.paymentReference,
          paidAt,
        });
      }

      if (targetPlanId !== subscription.planId) {
        await tx.subscriptionFeature.deleteMany({ where: { subscriptionId } });
        await this.snapshotPlanFeatures(tx, subscriptionId, targetPlanId);
      } else {
        const existingSnapshot = await tx.subscriptionFeature.count({ where: { subscriptionId } });
        if (existingSnapshot === 0) {
          await this.snapshotPlanFeatures(tx, subscriptionId, subscription.planId);
        }
      }

      const result = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          planId: targetPlanId,
          planPriceId,
          billingCycle: cycle,
          price,
          currency,
          status: SubscriptionStatus.ACTIVE,
          startDate,
          endDate,
          nextBillingDate: endDate,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
        },
        include: this.subscriptionInclude(),
      });

      await this.recordHistory(tx, {
        subscriptionId,
        action:
          fromStatus === SubscriptionStatus.TRIAL
            ? SubscriptionHistoryAction.TRIAL_CONVERTED
            : SubscriptionHistoryAction.ACTIVATED,
        fromStatus,
        toStatus: SubscriptionStatus.ACTIVE,
        toPlanId: targetPlanId,
        toPlanPriceId: planPriceId,
        metadata: { startDate, endDate, billingCycle: cycle, targetPlanId },
      });

      return { subscription: result, recordedPayment: paymentInfo };
    });

    if (recordedPayment && this.invoicesService) {
      await this.invoicesService
        .generateFromPayment({
          paymentOrderId: recordedPayment.order.id,
          paymentId: recordedPayment.payment.id,
          transactionId: recordedPayment.payment.transactionId ?? recordedPayment.order.reference,
          paidAt: recordedPayment.payment.paidAt ?? new Date(),
        })
        .catch((err) => {
          this.logger.warn(`Invoice generation on activation warning: ${err instanceof Error ? err.message : String(err)}`);
        });
    }

    await this.syncTenantFeaturesFromSubscription(subscriptionId, tenantId);
    this.logger.log(
      `Subscription activated: tenant=${tenantId}, subscription=${subscriptionId}, from=${fromStatus}`,
    );
    return updated;
  }

  async renewSubscription(
    subscriptionId: string,
    tenantId: string,
    dto: RenewSubscriptionDto,
    options?: { fromPaymentProcessor?: boolean },
  ) {
    const subscription = await this.findTenantSubscriptionOrThrow(subscriptionId, tenantId, {
      plan: true,
    });

    if (
      subscription.status !== SubscriptionStatus.ACTIVE &&
      subscription.status !== SubscriptionStatus.EXPIRED &&
      subscription.status !== SubscriptionStatus.SUSPENDED &&
      subscription.status !== SubscriptionStatus.PAST_DUE
    ) {
      throw new BadRequestException(
        'Only active, expired, past due, or suspended subscriptions can be renewed',
      );
    }

    if (!subscription.endDate && subscription.status !== SubscriptionStatus.SUSPENDED) {
      throw new BadRequestException('Subscription has no billing period end date');
    }

    if (subscription.cancelAtPeriodEnd) {
      throw new BadRequestException('Cancelled subscriptions cannot be renewed');
    }

    if (subscription.pendingPlanId && subscription.pendingPlanPriceId) {
      return this.renewWithPendingPlanChange(subscription, tenantId, dto, options);
    }

    const planPrice = await this.resolvePlanPrice(
      subscription.planId,
      dto.planPriceId,
      dto.billingCycle ?? (subscription.billingCycle as BillingCycle),
    ).catch(() => null);

    const price = planPrice?.price ?? subscription.price;
    const currency = planPrice?.currency ?? subscription.currency;
    const cycle = planPrice?.billingCycle ?? (subscription.billingCycle as BillingCycle);
    const planPriceId = planPrice?.id ?? subscription.planPriceId;

    const paidAt = new Date();
    const previousEnd = subscription.endDate ?? paidAt;
    const anchorEnd =
      subscription.status === SubscriptionStatus.SUSPENDED || isPastDate(previousEnd)
        ? paidAt
        : previousEnd;
    const newEndDate = extendBillingPeriod(anchorEnd, cycle);

    const { subscription: updated, recordedPayment } = await this.prisma.$transaction(async (tx) => {
      let paymentInfo: {
        order: { id: string; reference: string };
        payment: { id: string; transactionId: string | null; paidAt: Date | null };
      } | null = null;
      const activeAddons = tx.subscriptionAddOn?.findMany
        ? await tx.subscriptionAddOn.findMany({
            where: {
              subscriptionId,
              status: SubscriptionAddOnStatus.ACTIVE,
              cancelAtPeriodEnd: false,
            },
          })
        : [];
      const planFeatures = (tx.subscriptionFeature?.findMany
        ? await tx.subscriptionFeature.findMany({
            where: { subscriptionId, enabled: true },
            select: { featureId: true },
          })
        : []) ?? [];
      const planFeatureIds = new Set((planFeatures ?? []).map((f: any) => f.featureId));
      const totals = calculateSubscriptionRecurringTotals(
        price,
        (activeAddons ?? []).map((a) => ({
          featureId: a.featureId,
          status: a.status,
          recurringAmount: a.recurringAmount,
          currency: a.currency,
        })),
        currency,
        planFeatureIds,
      );

      const currentCredit = Number((subscription as any).billingCreditBalance ?? 0);
      const recurringTotal = Number(totals.nextRenewalTotal);
      const creditToUse = Math.min(currentCredit, recurringTotal);
      const finalPayable = Math.max(0, Math.round((recurringTotal - creditToUse) * 100) / 100);
      const remainingCredit = Math.max(0, Math.round((currentCredit - creditToUse) * 100) / 100);

      if (!options?.fromPaymentProcessor) {
        paymentInfo = await this.recordSubscriptionPayment(tx, {
          tenantId,
          subscriptionId,
          amount: finalPayable,
          currency,
          purpose: PaymentPurpose.SUBSCRIPTION_RENEW,
          paymentMethod: finalPayable === 0 ? 'BILLING_CREDIT' : (dto.paymentMethod ?? 'MANUAL'),
          paymentReference: dto.paymentReference,
          paidAt,
        });
      }

      const result = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          planPriceId,
          billingCycle: cycle,
          price,
          currency,
          endDate: newEndDate,
          nextBillingDate: newEndDate,
          status: SubscriptionStatus.ACTIVE,
          billingCreditBalance: remainingCredit,
        },
        include: this.subscriptionInclude(),
      });

      await this.recordHistory(tx, {
        subscriptionId,
        action: SubscriptionHistoryAction.RENEWED,
        fromStatus: subscription.status,
        toStatus: SubscriptionStatus.ACTIVE,
        toPlanPriceId: planPriceId,
        metadata: {
          previousEndDate: previousEnd,
          newEndDate,
          startDateUnchanged: subscription.startDate,
          billingCycle: cycle,
        },
      });

      return { subscription: result, recordedPayment: paymentInfo };
    });

    if (recordedPayment && this.invoicesService) {
      await this.invoicesService
        .generateFromPayment({
          paymentOrderId: recordedPayment.order.id,
          paymentId: recordedPayment.payment.id,
          transactionId: recordedPayment.payment.transactionId ?? recordedPayment.order.reference,
          paidAt: recordedPayment.payment.paidAt ?? new Date(),
        })
        .catch((err) => {
          this.logger.warn(`Invoice generation on renewal warning: ${err instanceof Error ? err.message : String(err)}`);
        });
    }

    await this.syncTenantFeaturesFromSubscription(subscriptionId, tenantId);
    return updated;
  }

  private async renewWithPendingPlanChange(
    subscription: Prisma.SubscriptionGetPayload<{ include: { plan: true } }>,
    tenantId: string,
    dto: RenewSubscriptionDto,
    options?: { fromPaymentProcessor?: boolean },
  ) {
    const pendingPrice = await this.prisma.planPrice.findUnique({
      where: { id: subscription.pendingPlanPriceId! },
    });

    if (!pendingPrice) {
      throw new NotFoundException('Pending plan price not found');
    }

    const paidAt = new Date();
    const previousEnd = subscription.endDate ?? subscription.trialEnd ?? paidAt;
    const anchorEnd =
      subscription.status === SubscriptionStatus.SUSPENDED || isPastDate(previousEnd)
        ? paidAt
        : previousEnd;
    const newEndDate = extendBillingPeriod(anchorEnd, pendingPrice.billingCycle);
    const fromPlanId = subscription.planId;
    const fromPlanPriceId = subscription.planPriceId;
    const toPlanId = subscription.pendingPlanId!;

    const { subscription: updated, recordedPayment } = await this.prisma.$transaction(async (tx) => {
      let paymentInfo: {
        order: { id: string; reference: string };
        payment: { id: string; transactionId: string | null; paidAt: Date | null };
      } | null = null;

      const currentCredit = Number((subscription as any).billingCreditBalance ?? 0);
      const pendingTotal = Number(pendingPrice.price);
      const creditToUse = Math.min(currentCredit, pendingTotal);
      const finalPayable = Math.max(0, Math.round((pendingTotal - creditToUse) * 100) / 100);
      const remainingCredit = Math.max(0, Math.round((currentCredit - creditToUse) * 100) / 100);

      if (!options?.fromPaymentProcessor) {
        paymentInfo = await this.recordSubscriptionPayment(tx, {
          tenantId,
          subscriptionId: subscription.id,
          amount: finalPayable,
          currency: pendingPrice.currency,
          purpose: PaymentPurpose.SUBSCRIPTION_RENEW,
          paymentMethod: finalPayable === 0 ? 'BILLING_CREDIT' : (dto.paymentMethod ?? 'MANUAL'),
          paymentReference: dto.paymentReference,
          paidAt,
        });
      }

      await this.applyPlanChange(tx, subscription.id, toPlanId, pendingPrice);

      const result = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          pendingPlanId: null,
          pendingPlanPriceId: null,
          endDate: newEndDate,
          nextBillingDate: newEndDate,
          status: SubscriptionStatus.ACTIVE,
          billingCreditBalance: remainingCredit,
        },
        include: this.subscriptionInclude(),
      });

      await this.recordHistory(tx, {
        subscriptionId: subscription.id,
        action: SubscriptionHistoryAction.PLAN_CHANGED,
        fromPlanId,
        toPlanId,
        fromPlanPriceId,
        toPlanPriceId: pendingPrice.id,
        fromStatus: subscription.status,
        toStatus: SubscriptionStatus.ACTIVE,
        metadata: { scheduledDowngradeApplied: true, previousEndDate: previousEnd, newEndDate },
      });

      await this.recordHistory(tx, {
        subscriptionId: subscription.id,
        action: SubscriptionHistoryAction.RENEWED,
        fromStatus: subscription.status,
        toStatus: SubscriptionStatus.ACTIVE,
        metadata: { previousEndDate: previousEnd, newEndDate, planChangedOnRenew: true },
      });

      return { subscription: result, recordedPayment: paymentInfo };
    });

    if (recordedPayment && this.invoicesService) {
      await this.invoicesService
        .generateFromPayment({
          paymentOrderId: recordedPayment.order.id,
          paymentId: recordedPayment.payment.id,
          transactionId: recordedPayment.payment.transactionId ?? recordedPayment.order.reference,
          paidAt: recordedPayment.payment.paidAt ?? new Date(),
        })
        .catch((err) => {
          this.logger.warn(`Invoice generation on plan change renew warning: ${err instanceof Error ? err.message : String(err)}`);
        });
    }

    await this.syncTenantFeaturesFromSubscription(subscription.id, tenantId);
    return updated;
  }

  async cancelAtPeriodEnd(subscriptionId: string, tenantId: string) {
    const subscription = await this.findTenantSubscriptionOrThrow(subscriptionId, tenantId);

    if (
      subscription.status !== SubscriptionStatus.ACTIVE &&
      subscription.status !== SubscriptionStatus.TRIAL
    ) {
      throw new BadRequestException('Only active or trial subscriptions can be cancelled');
    }

    if (subscription.cancelAtPeriodEnd) {
      throw new ConflictException('Subscription is already scheduled for cancellation');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          cancelAtPeriodEnd: true,
          cancelledAt: new Date(),
          autoRenew: false,
        },
        include: this.subscriptionInclude(),
      });

      await this.recordHistory(tx, {
        subscriptionId,
        action: SubscriptionHistoryAction.CANCELLED,
        fromStatus: subscription.status,
        toStatus: subscription.status,
        metadata: {
          cancelAtPeriodEnd: true,
          accessUntil: subscription.endDate,
        },
      });

      return updated;
    });
  }

  async undoCancelAtPeriodEnd(subscriptionId: string, tenantId: string) {
    const subscription = await this.findTenantSubscriptionOrThrow(subscriptionId, tenantId);

    if (!subscription.cancelAtPeriodEnd) {
      throw new BadRequestException('Subscription is not scheduled for cancellation');
    }

    if (isPastDate(subscription.endDate)) {
      throw new BadRequestException('Subscription period has already ended');
    }

    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        autoRenew: true,
      },
      include: this.subscriptionInclude(),
    });
  }

  async upgradeSubscription(
    subscriptionId: string,
    tenantId: string,
    dto: UpgradeSubscriptionDto,
    options?: {
      fromPaymentProcessor?: boolean;
      allowWithoutPayment?: boolean;
      adminUserId?: string;
    },
  ) {
    if (!options?.fromPaymentProcessor && !options?.allowWithoutPayment) {
      throw new BadRequestException(
        'Plan upgrades require payment. Complete checkout before upgrading.',
      );
    }

    const subscription = await this.findTenantSubscriptionOrThrow(subscriptionId, tenantId, {
      plan: true,
      planPrice: true,
    });

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException(
        'Only active subscriptions can be upgraded mid-cycle. Expired or trial subscriptions must be renewed or activated.',
      );
    }

    if (subscription.cancelAtPeriodEnd) {
      throw new BadRequestException('Cannot upgrade a subscription scheduled for cancellation');
    }

    const targetPlan = await this.plansService.findById(dto.planId);
    if (!isPlanActive(targetPlan)) {
      throw new BadRequestException('Target plan is not active');
    }

    if (targetPlan.id === subscription.planId) {
      throw new BadRequestException('Target plan is identical to current subscription plan.');
    }

    const tierChange = comparePlanTier(subscription.plan.displayOrder, targetPlan.displayOrder);
    if (tierChange !== 'upgrade') {
      throw new BadRequestException('Target plan must be a higher tier than the current plan');
    }

    const targetPrice = await this.resolvePlanPrice(
      targetPlan.id,
      dto.planPriceId,
      dto.billingCycle ?? subscription.billingCycle,
    );

    // Recalculate quote to obtain authoritative prorated upgrade amount on backend
    let quoteResult: any = null;
    let additionalAmount = 0;

    if (options?.allowWithoutPayment) {
      quoteResult = await this.getPlanChangeQuote(tenantId, subscriptionId, {
        targetPlanId: targetPlan.id,
        targetPlanPriceId: targetPrice.id,
        billingCycle: targetPrice.billingCycle,
      });

      if (!quoteResult.isEligible) {
        throw new BadRequestException(
          quoteResult.quoteUnavailableReason || 'Plan upgrade is currently ineligible.',
        );
      }
      additionalAmount = quoteResult.additionalAmountPayable ?? 0;
    }

    let recordedPaymentInfo: any = null;

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.applyPlanChange(tx, subscriptionId, targetPlan.id, targetPrice);

      const currentCredit = Number((subscription as any).billingCreditBalance ?? 0);
      const newCreditBalance = quoteResult ? (quoteResult.creditCarriedForward ?? 0) : currentCredit;

      const result = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          pendingPlanId: null,
          pendingPlanPriceId: null,
          billingCreditBalance: newCreditBalance,
        },
        include: this.subscriptionInclude(),
      });

      // For Super Admin manual upgrades with an additional prorated amount, record a manual payment order
      if (options?.allowWithoutPayment && additionalAmount > 0) {
        recordedPaymentInfo = await this.recordSubscriptionPayment(tx, {
          tenantId,
          subscriptionId,
          amount: additionalAmount,
          currency: targetPrice.currency || subscription.currency || 'LKR',
          purpose: PaymentPurpose.SUBSCRIPTION_UPGRADE,
          paymentMethod: 'BANK_TRANSFER_VERIFIED',
          paymentReference:
            dto.paymentReference?.trim() ||
            `UPGRADE-MANUAL-${subscriptionId.slice(0, 8)}-${Date.now()}`,
          paidAt: new Date(),
        });
      }

      await this.recordHistory(tx, {
        subscriptionId,
        action: SubscriptionHistoryAction.UPGRADED,
        fromPlanId: subscription.planId,
        toPlanId: targetPlan.id,
        fromPlanPriceId: subscription.planPriceId,
        toPlanPriceId: targetPrice.id,
        fromStatus: SubscriptionStatus.ACTIVE,
        toStatus: SubscriptionStatus.ACTIVE,
        performedBy: options?.adminUserId,
        metadata: {
          manualUpgrade: !!options?.allowWithoutPayment,
          verifiedByAdminId: options?.adminUserId,
          calculatedAmount: additionalAmount,
          currency: targetPrice.currency || subscription.currency,
          paymentReference: dto.paymentReference,
          actionType: 'MANUAL_UPGRADE',
        },
      });

      return result;
    });

    // If an invoice service is configured and payment was recorded, issue an invoice
    if (recordedPaymentInfo && this.invoicesService) {
      await this.invoicesService
        .generateFromPayment({
          paymentOrderId: recordedPaymentInfo.order.id,
          paymentId: recordedPaymentInfo.payment.id,
          transactionId:
            recordedPaymentInfo.payment.transactionId ?? recordedPaymentInfo.order.reference,
          paidAt: recordedPaymentInfo.payment.paidAt ?? new Date(),
        })
        .catch((err) => {
          this.logger.warn(
            `Invoice generation on manual upgrade warning: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
    }

    await this.syncTenantFeaturesFromSubscription(subscriptionId, tenantId);
    return {
      ...updated,
      calculatedAmount: additionalAmount,
      quote: quoteResult,
    };
  }

  async upgradeSubscriptionFromPayment(
    subscriptionId: string,
    tenantId: string,
    metadata: { planId: string; planPriceId?: string; billingCycle?: BillingCycle },
    dto: ActivateSubscriptionDto,
  ) {
    return this.upgradeSubscription(
      subscriptionId,
      tenantId,
      {
        planId: metadata.planId,
        planPriceId: metadata.planPriceId,
        billingCycle: metadata.billingCycle,
        paymentReference: dto.paymentReference,
      },
      { fromPaymentProcessor: true },
    );
  }

  async scheduleDowngrade(
    subscriptionId: string,
    tenantId: string,
    dto: ScheduleDowngradeDto,
    options?: { adminUserId?: string; immediate?: boolean },
  ) {
    const subscription = await this.findTenantSubscriptionOrThrow(subscriptionId, tenantId, {
      plan: true,
    });

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Only active subscriptions can be downgraded');
    }

    if (subscription.cancelAtPeriodEnd) {
      throw new BadRequestException('Cannot downgrade a subscription scheduled for cancellation');
    }

    const targetPlan = await this.plansService.findById(dto.planId);
    if (!isPlanActive(targetPlan)) {
      throw new BadRequestException('Target plan is not active');
    }

    if (targetPlan.id === subscription.planId) {
      throw new BadRequestException('Target plan is identical to current subscription plan.');
    }

    const tierChange = comparePlanTier(subscription.plan.displayOrder, targetPlan.displayOrder);
    if (tierChange !== 'downgrade') {
      throw new BadRequestException('Target plan must be a lower tier than the current plan');
    }

    const targetPrice = await this.resolvePlanPrice(
      targetPlan.id,
      dto.planPriceId,
      dto.billingCycle ?? subscription.billingCycle,
    );

    const isImmediate = dto.immediate ?? options?.immediate ?? false;

    if (isImmediate) {
      const quoteResult = await this.getPlanChangeQuote(tenantId, subscriptionId, {
        targetPlanId: targetPlan.id,
        targetPlanPriceId: targetPrice.id,
        billingCycle: targetPrice.billingCycle,
      });

      if (!quoteResult.isEligible) {
        throw new BadRequestException(
          quoteResult.quoteUnavailableReason || 'Plan downgrade is currently ineligible.',
        );
      }

      const currentCredit = Number((subscription as any).billingCreditBalance ?? 0);
      const downgradeCredit = quoteResult.downgradeCredit ?? 0;
      const newCreditBalance = Math.round((currentCredit + downgradeCredit) * 100) / 100;

      const updated = await this.prisma.$transaction(async (tx) => {
        await this.applyPlanChange(tx, subscriptionId, targetPlan.id, targetPrice);

        const result = await tx.subscription.update({
          where: { id: subscriptionId },
          data: {
            pendingPlanId: null,
            pendingPlanPriceId: null,
            billingCreditBalance: newCreditBalance,
          },
          include: this.subscriptionInclude(),
        });

        await this.recordHistory(tx, {
          subscriptionId,
          action: SubscriptionHistoryAction.DOWNGRADED,
          fromPlanId: subscription.planId,
          toPlanId: targetPlan.id,
          fromPlanPriceId: subscription.planPriceId,
          toPlanPriceId: targetPrice.id,
          fromStatus: SubscriptionStatus.ACTIVE,
          toStatus: SubscriptionStatus.ACTIVE,
          performedBy: options?.adminUserId,
          metadata: {
            actionType: 'MANUAL_DOWNGRADE',
            immediate: true,
            previousPlanId: subscription.planId,
            newPlanId: targetPlan.id,
            unusedCurrentPlanValue: quoteResult.unusedCurrentPlanValue,
            newPlanRemainingCost: quoteResult.newPlanRemainingCost,
            downgradeCredit,
            creditCarriedForward: newCreditBalance,
            nextRenewalPrice: quoteResult.nextRenewalPrice,
            finalNextRenewalPayableAmount: quoteResult.finalNextRenewalPayableAmount,
            verifiedByAdminId: options?.adminUserId,
          },
        });

        return result;
      });

      await this.syncTenantFeaturesFromSubscription(subscriptionId, tenantId);
      return {
        ...updated,
        calculatedCredit: downgradeCredit,
        creditCarriedForward: newCreditBalance,
        quote: quoteResult,
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          pendingPlanId: targetPlan.id,
          pendingPlanPriceId: targetPrice.id,
        },
        include: this.subscriptionInclude(),
      });

      await this.recordHistory(tx, {
        subscriptionId,
        action: SubscriptionHistoryAction.DOWNGRADED,
        fromPlanId: subscription.planId,
        toPlanId: targetPlan.id,
        fromPlanPriceId: subscription.planPriceId,
        toPlanPriceId: targetPrice.id,
        fromStatus: SubscriptionStatus.ACTIVE,
        toStatus: SubscriptionStatus.ACTIVE,
        performedBy: options?.adminUserId,
        metadata: {
          scheduled: true,
          effectiveAt: subscription.endDate,
          verifiedByAdminId: options?.adminUserId,
          actionType: 'SCHEDULED_DOWNGRADE',
        },
      });

      return updated;
    });
  }

  async cancelPendingDowngrade(
    subscriptionId: string,
    tenantId: string,
    options?: { adminUserId?: string },
  ) {
    const subscription = await this.findTenantSubscriptionOrThrow(subscriptionId, tenantId, {
      plan: true,
    });

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Only active subscriptions can cancel a pending downgrade');
    }

    if (!subscription.pendingPlanId) {
      throw new BadRequestException('No pending downgrade to cancel');
    }

    const pendingPlanId = subscription.pendingPlanId;
    const pendingPlanPriceId = subscription.pendingPlanPriceId;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          pendingPlanId: null,
          pendingPlanPriceId: null,
        },
        include: this.subscriptionInclude(),
      });

      await this.recordHistory(tx, {
        subscriptionId,
        action: SubscriptionHistoryAction.PLAN_CHANGED,
        fromPlanId: pendingPlanId,
        toPlanId: subscription.planId,
        fromPlanPriceId: pendingPlanPriceId,
        toPlanPriceId: subscription.planPriceId,
        fromStatus: SubscriptionStatus.ACTIVE,
        toStatus: SubscriptionStatus.ACTIVE,
        performedBy: options?.adminUserId,
        metadata: {
          cancelledPendingDowngrade: true,
          verifiedByAdminId: options?.adminUserId,
          actionType: 'CANCEL_PENDING_DOWNGRADE',
        },
      });

      return updated;
    });
  }

  async finalizeDueAddonCancellations(asOf: Date = new Date()) {
    if (!this.prisma.subscriptionAddOn?.findMany) {
      return [];
    }

    const dueAddons = await this.prisma.subscriptionAddOn.findMany({
      where: {
        status: SubscriptionAddOnStatus.CANCEL_AT_PERIOD_END,
        OR: [
          { cancellationEffectiveAt: { lte: asOf } },
          {
            cancellationEffectiveAt: null,
            subscription: { endDate: { lte: asOf } },
          },
        ],
      },
      include: {
        subscription: true,
        feature: true,
      },
    });

    const results = [];
    for (const addOn of dueAddons) {
      await this.prisma.$transaction(async (tx) => {
        await tx.subscriptionAddOn.update({
          where: { id: addOn.id },
          data: {
            status: SubscriptionAddOnStatus.CANCELLED,
            cancelAtPeriodEnd: false,
            cancelledAt: asOf,
          },
        });

        await tx.subscriptionHistory.create({
          data: {
            subscriptionId: addOn.subscriptionId,
            action: SubscriptionHistoryAction.STATUS_CHANGED,
            metadata: {
              action: 'ADDON_CANCELLED',
              addOnId: addOn.id,
              featureId: addOn.featureId,
              featureCode: addOn.feature?.code,
              featureName: addOn.feature?.name,
              cancellationEffectiveAt: addOn.cancellationEffectiveAt,
              processedAt: asOf,
              source: 'SCHEDULER',
            },
          },
        });
      });

      if (addOn.subscription?.tenantId) {
        await this.syncTenantFeaturesFromSubscription(
          addOn.subscriptionId,
          addOn.subscription.tenantId,
        );
      }

      this.logger.log(
        `Finalized cancellation of add-on ${addOn.id} (${addOn.feature?.code ?? 'ADDON'}) on subscription ${addOn.subscriptionId} as of ${asOf.toISOString()}`,
      );

      results.push({
        addOnId: addOn.id,
        subscriptionId: addOn.subscriptionId,
        action: 'addon_cancelled',
        effectiveAt: addOn.cancellationEffectiveAt,
      });
    }

    return results;
  }

  async processDueSubscriptions(asOf: Date = new Date()) {
    // 1. Finalize scheduled add-on cancellations whose effective period cutoff has passed
    const cancelledAddons = await this.finalizeDueAddonCancellations(asOf);

    // 2. Process subscriptions reaching period end
    const due = await this.prisma.subscription.findMany({
      where: {
        endDate: { lte: asOf },
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
      },
    });

    const results = [];
    for (const subscription of due) {
      results.push(await this.processSubscriptionPeriodEnd(subscription.id, asOf));
    }

    return [...results, ...cancelledAddons];
  }

  async processSubscriptionPeriodEnd(subscriptionId: string, asOf: Date = new Date()) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription?.endDate || subscription.endDate > asOf) {
      return { subscriptionId, action: 'skipped', reason: 'not_due' };
    }

    if (
      subscription.status !== SubscriptionStatus.ACTIVE &&
      subscription.status !== SubscriptionStatus.TRIAL
    ) {
      return { subscriptionId, action: 'skipped', reason: 'invalid_status' };
    }

    if (subscription.status === SubscriptionStatus.TRIAL) {
      return this.suspendSubscription(subscription, 'TRIAL_EXPIRED_SUSPENDED');
    }

    if (subscription.cancelAtPeriodEnd) {
      return this.finalizeCancellation(subscription);
    }

    // Period ended without renewal — transition to SUSPENDED read-only mode
    return this.suspendSubscription(subscription, 'SUBSCRIPTION_EXPIRED_SUSPENDED');
  }

  async updateSubscriptionFeatures(
    subscriptionId: string,
    tenantId: string,
    featureCodes: string[],
  ) {
    let stage = 'load subscription';
    try {
      const subscription = await this.findTenantSubscriptionOrThrow(subscriptionId, tenantId);

      const editableStatuses: SubscriptionStatus[] = [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.TRIAL,
        SubscriptionStatus.PENDING,
      ];

      if (!editableStatuses.includes(subscription.status)) {
        throw new BadRequestException(
          'Features can only be updated for active, trial, or pending subscriptions',
        );
      }

      stage = 'validate selected features';
      const uniqueFeatures = normalizeFeatureCodes(featureCodes);
      const features = await this.resolveActiveFeatures(uniqueFeatures);
      const featureIds = features.map((feature) => feature.id);

      stage = 'replace subscription feature snapshot';
      await this.prisma.$transaction(async (tx) => {
        await tx.subscriptionFeature.deleteMany({ where: { subscriptionId } });

        if (featureIds.length > 0) {
          await tx.subscriptionFeature.createMany({
            data: featureIds.map((featureId) => ({
              subscriptionId,
              featureId,
              enabled: true,
            })),
          });
        }

        await this.recordHistory(tx, {
          subscriptionId,
          action: SubscriptionHistoryAction.STATUS_CHANGED,
          metadata: {
            reason: 'SUPER_ADMIN_FEATURE_OVERRIDE',
            features: uniqueFeatures,
          },
        });
      });

      stage = 'sync tenant feature cache';
      await this.syncTenantFeaturesFromSubscription(subscriptionId, tenantId);
      this.logger.log(
        `Subscription features updated: subscription=${subscriptionId}, tenant=${tenantId}`,
      );

      stage = 'reload subscription';
      return await this.findById(subscriptionId, tenantId);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Subscription feature update failed at stage "${stage}" (subscription=${subscriptionId}, tenant=${tenantId}): ${detail}`,
        stack,
      );
      throw error;
    }
  }

  async createCustomSubscription(dto: CreateCustomSubscriptionDto) {
    await this.ensureTenantExists(dto.tenantId);

    let planId = dto.planId;
    if (!planId && dto.planCode) {
      const plan = await this.plansService.findByCode(dto.planCode);
      planId = plan.id;
    }

    if (!planId) {
      throw new BadRequestException('planId or planCode is required');
    }

    const plan = await this.plansService.findById(planId);
    const uniqueFeatures = normalizeFeatureCodes(dto.features);
    const features = await this.resolveActiveFeatures(uniqueFeatures);

    const subscription = await this.prisma.$transaction(async (tx) => {
      const created = await tx.subscription.create({
        data: {
          tenantId: dto.tenantId,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          billingCycle: dto.billingCycle as BillingCycle,
          price: dto.price,
          currency: dto.currency ?? getPlanCurrency(plan),
          startDate: new Date(),
          endDate: this.calculateEndDate(new Date(), dto.billingCycle as BillingCycle),
          nextBillingDate: this.calculateEndDate(new Date(), dto.billingCycle as BillingCycle),
        },
      });

      await this.snapshotFeatures(
        tx,
        created.id,
        features.map((f) => f.id),
      );
      return created;
    });

    const result = await this.findById(subscription.id, dto.tenantId);
    await this.syncTenantFeaturesFromSubscription(subscription.id, dto.tenantId);
    return result;
  }

  async recordFailedPayment(subscriptionId: string, tenantId: string) {
    const subscription = await this.findTenantSubscriptionOrThrow(subscriptionId, tenantId);

    return this.prisma.paymentOrder.create({
      data: {
        tenantId,
        subscriptionId,
        amount: subscription.price,
        currency: subscription.currency,
        status: PaymentOrderStatus.FAILED,
        gateway: PaymentGatewayProvider.MANUAL,
        reference: `FAILED-${subscriptionId}-${Date.now()}`,
        purpose: PaymentPurpose.SUBSCRIPTION_RENEW,
        metadata: {
          paymentMethod: 'MANUAL',
        },
      },
    });
  }

  async listForAdmin(query: SubscriptionListQueryDto) {
    const { page, limit, offset } = resolvePagination(query.page, query.limit);

    const where: Prisma.SubscriptionWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.search
        ? {
            OR: [
              { tenant: { name: { contains: query.search, mode: 'insensitive' } } },
              { tenant: { code: { contains: query.search, mode: 'insensitive' } } },
              { plan: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { id: true, name: true, code: true, email: true, status: true } },
          plan: { select: { id: true, code: true, name: true } },
          planPrice: { select: { billingCycle: true, trialDays: true } },
          addOns: {
            where: {
              status: {
                in: [SubscriptionAddOnStatus.ACTIVE, SubscriptionAddOnStatus.CANCEL_AT_PERIOD_END],
              },
            },
            select: {
              id: true,
              featureId: true,
              recurringAmount: true,
              currency: true,
              status: true,
              cancelAtPeriodEnd: true,
            },
          },
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);

    return buildPaginatedResponse(
      data.map((sub) => {
        const totals = calculateSubscriptionRecurringTotals(
          sub.price,
          (sub.addOns ?? []).map((a) => ({
            featureId: a.featureId,
            status: a.status,
            recurringAmount: a.recurringAmount,
            currency: a.currency,
            cancelAtPeriodEnd: a.cancelAtPeriodEnd,
          })),
          sub.currency,
        );

        return {
          id: sub.id,
          tenantId: sub.tenantId,
          tenant: sub.tenant,
          plan: sub.plan,
          status: sub.status,
          billingCycle: sub.billingCycle,
          price: sub.price,
          currency: sub.currency,
          startDate: sub.startDate,
          endDate: sub.endDate,
          trialStart: sub.trialStart,
          trialEnd: sub.trialEnd,
          nextBillingDate: sub.nextBillingDate,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          createdAt: sub.createdAt,
          totals,
          activeAddonsCount: (sub.addOns ?? []).filter(
            (a) => a.status === SubscriptionAddOnStatus.ACTIVE,
          ).length,
        };
      }),
      total,
      page,
      limit,
    );
  }

  async getTenantSubscriptionContext(tenantId: string) {
    const tenant = await this.ensureTenantExists(tenantId);
    const subscription = await this.getCurrentSubscriptionRecord(tenantId);
    const features = await this.subscriptionFeatureService.getTenantFeatureCodes(tenantId);

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        logoUrl: tenant.logoUrl,
        isDemo: tenant.isDemo,
        demoProfile: tenant.demoProfile,
        lastDemoResetAt: tenant.lastDemoResetAt,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            planId: subscription.planId,
            plan: subscription.plan.name,
            planCode: subscription.plan.code,
            status: subscription.status,
            startDate: subscription.startDate,
            endDate: subscription.endDate,
            trialStart: subscription.trialStart,
            trialEnd: subscription.trialEnd,
            nextBillingDate: subscription.nextBillingDate,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            cancelledAt: subscription.cancelledAt,
            pendingPlanId: subscription.pendingPlanId,
            pendingPlan: subscription.pendingPlan
              ? {
                  id: subscription.pendingPlan.id,
                  code: subscription.pendingPlan.code,
                  name: subscription.pendingPlan.name,
                }
              : null,
            pendingPlanPrice: subscription.pendingPlanPrice
              ? {
                  id: subscription.pendingPlanPrice.id,
                  price: subscription.pendingPlanPrice.price,
                  currency: subscription.pendingPlanPrice.currency,
                  billingCycle: subscription.pendingPlanPrice.billingCycle,
                }
              : null,
            price: subscription.price,
            currency: subscription.currency,
            billingCycle: subscription.billingCycle,
            billingCreditBalance: Number((subscription as any).billingCreditBalance ?? 0),
            features,
            addOns: (subscription.addOns ?? []).map((a: any) => ({
              id: a.id,
              featureId: a.featureId,
              name: a.feature?.name ?? a.featureId,
              featureCode: a.feature?.code ?? '',
              status: a.status,
              recurringAmount: a.recurringAmount,
              cancelAtPeriodEnd: a.cancelAtPeriodEnd,
              cancellationEffectiveAt: a.cancellationEffectiveAt,
              cancelledAt: a.cancelledAt,
            })),
            totals: calculateSubscriptionRecurringTotals(
              subscription.price,
              (subscription.addOns ?? []).map((a: any) => ({
                featureId: a.featureId,
                status: a.status,
                recurringAmount: a.recurringAmount,
                cancelAtPeriodEnd: a.cancelAtPeriodEnd,
              })),
              subscription.currency,
            ),
            isTrial: subscription.status === SubscriptionStatus.TRIAL,
            isTrialExpired:
              (subscription.status === SubscriptionStatus.TRIAL && isPastDate(subscription.trialEnd)) ||
              (subscription.status === SubscriptionStatus.SUSPENDED && subscription.trialEnd != null),
            daysRemaining:
              subscription.status === SubscriptionStatus.TRIAL && subscription.trialEnd
                ? Math.max(0, Math.ceil((new Date(subscription.trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                : null,
          }
        : null,
      features,
      canWrite: await this.subscriptionFeatureService.canTenantWrite(tenantId),
    };
  }

  async findById(subscriptionId: string, tenantId: string) {
    return this.findTenantSubscriptionOrThrow(subscriptionId, tenantId);
  }

  async getPlanChangeQuote(
    tenantId: string,
    subscriptionId: string,
    query: PlanChangeQuoteQueryDto,
  ) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, tenantId },
      include: {
        plan: {
          include: {
            planFeatures: {
              where: { enabled: true },
              include: { feature: { select: { code: true, name: true } } },
            },
          },
        },
        planPrice: true,
        addOns: {
          where: {
            status: {
              in: [SubscriptionAddOnStatus.ACTIVE, SubscriptionAddOnStatus.CANCEL_AT_PERIOD_END],
            },
          },
          include: {
            feature: { select: { id: true, code: true, name: true } },
          },
        },
        invoices: {
          where: { status: InvoiceStatus.PAID },
          orderBy: { paidAt: 'desc' },
          take: 1,
          include: { items: true },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found for this salon');
    }

    const targetPlan = await this.prisma.plan.findUnique({
      where: { id: query.targetPlanId },
      include: {
        planFeatures: {
          where: { enabled: true },
          include: { feature: { select: { code: true, name: true } } },
        },
        planPrices: {
          where: { isActive: true },
        },
      },
    });

    if (!targetPlan) {
      throw new NotFoundException('Target plan not found');
    }

    const targetCycle = query.billingCycle ?? subscription.billingCycle;
    let targetPrice = query.targetPlanPriceId
      ? targetPlan.planPrices.find((p) => p.id === query.targetPlanPriceId)
      : targetPlan.planPrices.find((p) => p.billingCycle === targetCycle);

    if (!targetPrice && targetPlan.planPrices.length > 0) {
      targetPrice = targetPlan.planPrices[0];
    }

    if (!targetPrice) {
      throw new NotFoundException('No active pricing tier found for target plan');
    }

    // Determine actual eligible paid amount
    let actualEligiblePaidAmount: number | null = null;
    if (subscription.status === SubscriptionStatus.TRIAL) {
      actualEligiblePaidAmount = 0;
    } else if (subscription.invoices && subscription.invoices.length > 0) {
      const latestInvoice = subscription.invoices[0];
      const planItem = (latestInvoice.items ?? []).find(
        (i) =>
          i.description?.toLowerCase().includes('plan') ||
          i.description?.toLowerCase().includes('subscription'),
      );
      if (planItem) {
        actualEligiblePaidAmount = Number(planItem.amount);
      } else {
        actualEligiblePaidAmount = Number(latestInvoice.total);
      }
    }

    const asOf = query.asOf ? new Date(query.asOf) : new Date();

    return calculatePlanChangeQuote({
      currentPlan: {
        id: subscription.plan.id,
        code: subscription.plan.code,
        name: subscription.plan.name,
        displayOrder: subscription.plan.displayOrder,
        features: (subscription.plan.planFeatures ?? []).map((pf) => ({
          code: pf.feature.code,
          name: pf.feature.name,
        })),
      },
      currentSubscription: {
        id: subscription.id,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        price: subscription.price,
        currency: subscription.currency,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        nextBillingDate: subscription.nextBillingDate,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        cancelledAt: subscription.cancelledAt,
        actualEligiblePaidAmount,
        addOns: (subscription.addOns ?? []).map((a) => ({
          id: a.id,
          featureId: a.featureId,
          name: a.feature?.name,
          featureCode: a.feature?.code,
          status: a.status,
          recurringAmount: a.recurringAmount,
          cancelAtPeriodEnd: a.cancelAtPeriodEnd,
        })),
        billingCreditBalance: (subscription as any).billingCreditBalance,
      },
      targetPlan: {
        id: targetPlan.id,
        code: targetPlan.code,
        name: targetPlan.name,
        displayOrder: targetPlan.displayOrder,
        status: targetPlan.status,
        description: targetPlan.description,
        features: (targetPlan.planFeatures ?? []).map((pf) => ({
          code: pf.feature.code,
          name: pf.feature.name,
        })),
      },
      targetPlanPrice: {
        id: targetPrice.id,
        price: targetPrice.price,
        currency: targetPrice.currency,
        billingCycle: targetPrice.billingCycle,
        compareAtPrice: targetPrice.compareAtPrice ? Number(targetPrice.compareAtPrice) : null,
        trialDays: targetPrice.trialDays,
        isActive: targetPrice.isActive,
      },
      asOf,
    });
  }

  async getPlanChangeQuoteForAdmin(subscriptionId: string, query: PlanChangeQuoteQueryDto) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { tenantId: true },
    });
    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }
    return this.getPlanChangeQuote(sub.tenantId, subscriptionId, query);
  }

  async changePlanForTenant(subscriptionId: string, tenantId: string, newPlanId: string) {
    const updated = await this.changePlan(subscriptionId, tenantId, newPlanId);
    return this.findById(subscriptionId, tenantId);
  }

  async changePlan(subscriptionId: string, tenantId: string, newPlanId: string) {
    const subscription = await this.findById(subscriptionId, tenantId);
    const plan = await this.plansService.findById(newPlanId);

    if (!isPlanActive(plan)) {
      throw new BadRequestException('Target plan is not active');
    }

    if (subscription.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Only active subscriptions can change plan');
    }

    if (subscription.planId === newPlanId) {
      throw new BadRequestException('This plan is already active on the subscription');
    }

    const planPrice = this.plansService.resolvePlanPrice(plan, {
      billingCycle: subscription.billingCycle,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      // Full replace snapshot so downgrades remove old entitlements
      await this.applyPlanChange(tx, subscriptionId, newPlanId, planPrice);

      const result = await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          pendingPlanId: null,
          pendingPlanPriceId: null,
        },
        include: this.subscriptionInclude(),
      });

      await this.recordHistory(tx, {
        subscriptionId,
        action: SubscriptionHistoryAction.PLAN_CHANGED,
        fromPlanId: subscription.planId,
        toPlanId: newPlanId,
        fromPlanPriceId: subscription.planPriceId,
        toPlanPriceId: planPrice.id,
        fromStatus: SubscriptionStatus.ACTIVE,
        toStatus: SubscriptionStatus.ACTIVE,
        metadata: { source: 'admin_change_plan' },
      });

      return result;
    });

    await this.syncTenantFeaturesFromSubscription(subscriptionId, tenantId);
    return updated;
  }

  private async expireSubscription(subscription: Subscription, action: SubscriptionHistoryAction) {
    const fromStatus = subscription.status;

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.EXPIRED },
      });

      await this.recordHistory(tx, {
        subscriptionId: subscription.id,
        action,
        fromStatus,
        toStatus: SubscriptionStatus.EXPIRED,
      });
    });

    return { subscriptionId: subscription.id, action: 'expired', fromStatus };
  }

  private async suspendSubscription(subscription: Subscription, reason: string) {
    const fromStatus = subscription.status;

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.SUSPENDED },
      });

      await this.recordHistory(tx, {
        subscriptionId: subscription.id,
        action: SubscriptionHistoryAction.STATUS_CHANGED,
        fromStatus,
        toStatus: SubscriptionStatus.SUSPENDED,
        metadata: { reason },
      });
    });

    this.logger.log(
      `Subscription suspended: id=${subscription.id}, tenant=${subscription.tenantId}, from=${fromStatus}, reason=${reason}`,
    );

    return { subscriptionId: subscription.id, action: 'suspended', fromStatus };
  }

  private async finalizeCancellation(subscription: Subscription) {
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.CANCELLED },
      });

      await this.recordHistory(tx, {
        subscriptionId: subscription.id,
        action: SubscriptionHistoryAction.CANCELLED,
        fromStatus: SubscriptionStatus.ACTIVE,
        toStatus: SubscriptionStatus.CANCELLED,
        metadata: { cancelAtPeriodEnd: true },
      });
    });

    return { subscriptionId: subscription.id, action: 'cancelled' };
  }

  private async applyScheduledDowngrade(subscription: SubscriptionWithPlan) {
    if (!subscription.pendingPlanId || !subscription.pendingPlanPriceId) {
      throw new BadRequestException('Pending downgrade is incomplete');
    }

    const pendingPrice = await this.prisma.planPrice.findUnique({
      where: { id: subscription.pendingPlanPriceId },
    });

    if (!pendingPrice) {
      throw new NotFoundException('Pending plan price not found');
    }

    const fromPlanId = subscription.planId;
    const fromPlanPriceId = subscription.planPriceId;
    const toPlanId = subscription.pendingPlanId;

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.applyPlanChange(tx, subscription.id, toPlanId, pendingPrice);

      const newEndDate = extendBillingPeriod(subscription.endDate!, pendingPrice.billingCycle);

      const result = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          pendingPlanId: null,
          pendingPlanPriceId: null,
          endDate: newEndDate,
          nextBillingDate: newEndDate,
          status: SubscriptionStatus.ACTIVE,
        },
        include: this.subscriptionInclude(),
      });

      await this.recordHistory(tx, {
        subscriptionId: subscription.id,
        action: SubscriptionHistoryAction.PLAN_CHANGED,
        fromPlanId,
        toPlanId,
        fromPlanPriceId,
        toPlanPriceId: pendingPrice.id,
        fromStatus: SubscriptionStatus.ACTIVE,
        toStatus: SubscriptionStatus.ACTIVE,
        metadata: { scheduledDowngradeApplied: true },
      });

      return result;
    });

    await this.syncTenantFeaturesFromSubscription(subscription.id, subscription.tenantId);
    return { subscriptionId: subscription.id, action: 'downgrade_applied', subscription: updated };
  }

  private async applyPlanChange(
    tx: Prisma.TransactionClient,
    subscriptionId: string,
    planId: string,
    planPrice: PlanPrice,
  ) {
    await tx.subscriptionFeature.deleteMany({ where: { subscriptionId } });
    await this.snapshotPlanFeatures(tx, subscriptionId, planId);

    // Find the new plan's enabled features
    const newPlanFeatures = await tx.planFeature.findMany({
      where: { planId, enabled: true },
      select: { featureId: true },
    });
    const newFeatureIds = newPlanFeatures.map((pf) => pf.featureId);

    // Retire any add-ons whose feature is now included in the new plan so it's not double charged
    if (newFeatureIds.length > 0) {
      await tx.subscriptionAddOn.updateMany({
        where: {
          subscriptionId,
          featureId: { in: newFeatureIds },
          status: {
            in: [
              SubscriptionAddOnStatus.ACTIVE,
              SubscriptionAddOnStatus.PENDING_PAYMENT,
              SubscriptionAddOnStatus.CANCEL_AT_PERIOD_END,
            ],
          },
        },
        data: {
          status: SubscriptionAddOnStatus.CANCELLED,
          cancelledAt: new Date(),
          customReason: 'Feature is now included in base plan',
        },
      });
    }

    // For any remaining active or pending add-ons, sync billingCycle to match new planPrice
    await tx.subscriptionAddOn.updateMany({
      where: {
        subscriptionId,
        status: { in: [SubscriptionAddOnStatus.ACTIVE, SubscriptionAddOnStatus.PENDING_PAYMENT] },
      },
      data: {
        billingCycle: planPrice.billingCycle,
      },
    });

    await tx.subscription.update({
      where: { id: subscriptionId },
      data: {
        planId,
        planPriceId: planPrice.id,
        billingCycle: planPrice.billingCycle,
        price: planPrice.price,
        currency: planPrice.currency,
      },
    });
  }

  private async resolvePlanPrice(
    planId: string,
    planPriceId: string | undefined,
    billingCycle: BillingCycle | undefined,
  ): Promise<PlanPrice> {
    if (planPriceId) {
      const planPrice = await this.prisma.planPrice.findFirst({
        where: { id: planPriceId, planId, isActive: true },
      });

      if (!planPrice) {
        throw new NotFoundException('Plan price not found for this plan');
      }

      return planPrice;
    }

    if (!billingCycle) {
      throw new BadRequestException('planPriceId or billingCycle is required');
    }

    const planPrice = await this.prisma.planPrice.findFirst({
      where: { planId, billingCycle, isActive: true },
    });

    if (!planPrice) {
      throw new NotFoundException(`No active ${billingCycle} price for this plan`);
    }

    return planPrice;
  }

  private async getCurrentSubscriptionRecord(tenantId: string) {
    return this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIAL,
            SubscriptionStatus.SUSPENDED,
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.PENDING,
            SubscriptionStatus.EXPIRED,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: { select: { id: true, code: true, name: true, displayOrder: true } },
        pendingPlan: { select: { id: true, code: true, name: true } },
        pendingPlanPrice: {
          select: { id: true, price: true, currency: true, billingCycle: true },
        },
        addOns: {
          include: {
            feature: { select: { id: true, code: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  private async assertNoBlockingSubscription(tenantId: string) {
    const existingPaidOrSuspended = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        OR: [
          {
            status: {
              in: [
                SubscriptionStatus.ACTIVE,
                SubscriptionStatus.PAST_DUE,
                SubscriptionStatus.SUSPENDED,
              ],
            },
          },
          { paymentOrders: { some: { status: PaymentOrderStatus.PAID } } },
        ],
      },
    });

    if (existingPaidOrSuspended) {
      throw new ConflictException(
        'Tenant with an existing, suspended, or previous paid subscription cannot receive a trial',
      );
    }

    const existing = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: {
          in: [SubscriptionStatus.PENDING, SubscriptionStatus.TRIAL],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      return;
    }

    if (existing.status === SubscriptionStatus.TRIAL && !isPastDate(existing.endDate)) {
      throw new ConflictException('Tenant already has an active trial');
    }

    if (existing.status === SubscriptionStatus.PENDING) {
      throw new ConflictException('A pending subscription already exists for this tenant');
    }
  }

  private async findTenantSubscriptionOrThrow(
    subscriptionId: string,
    tenantId: string,
    include?: Prisma.SubscriptionInclude,
  ) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, tenantId },
      include: include ?? this.subscriptionInclude(),
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  private async syncTenantFeaturesFromSubscription(subscriptionId: string, tenantId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, tenantId },
      include: {
        subscriptionFeatures: { where: { enabled: true }, select: { featureId: true } },
        addOns: {
          where: {
            status: {
              in: [SubscriptionAddOnStatus.ACTIVE, SubscriptionAddOnStatus.CANCEL_AT_PERIOD_END],
            },
          },
          select: { featureId: true },
        },
      },
    });

    if (!subscription) {
      return;
    }

    const baseFeatureIds = (subscription.subscriptionFeatures ?? []).map((sf) => sf.featureId);
    const addonFeatureIds = (subscription.addOns ?? []).map((a) => a.featureId);
    const featureIds = Array.from(new Set([...baseFeatureIds, ...addonFeatureIds]));

    await this.prisma.$transaction(async (tx) => {
      await syncTenantFeatures(tx, tenantId, featureIds);
    });
  }

  private async recordHistory(
    tx: Prisma.TransactionClient,
    input: {
      subscriptionId: string;
      action: SubscriptionHistoryAction;
      fromPlanId?: string | null;
      toPlanId?: string | null;
      fromPlanPriceId?: string | null;
      toPlanPriceId?: string | null;
      fromStatus?: SubscriptionStatus | null;
      toStatus?: SubscriptionStatus | null;
      metadata?: Prisma.InputJsonValue;
      performedBy?: string | null;
    },
  ) {
    await tx.subscriptionHistory.create({
      data: {
        subscriptionId: input.subscriptionId,
        action: input.action,
        fromPlanId: input.fromPlanId ?? null,
        toPlanId: input.toPlanId ?? null,
        fromPlanPriceId: input.fromPlanPriceId ?? null,
        toPlanPriceId: input.toPlanPriceId ?? null,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        metadata: input.metadata,
        performedBy: input.performedBy ?? null,
      },
    });
  }

  private async snapshotPlanFeatures(
    tx: Prisma.TransactionClient,
    subscriptionId: string,
    planId: string,
  ) {
    const planFeatures = await tx.planFeature.findMany({
      where: {
        planId,
        enabled: true,
        feature: { status: FeatureStatus.ACTIVE },
      },
      select: { featureId: true },
    });

    await this.snapshotFeatures(
      tx,
      subscriptionId,
      planFeatures.map((pf) => pf.featureId),
    );
  }

  private async snapshotFeatures(
    tx: Prisma.TransactionClient,
    subscriptionId: string,
    featureIds: string[],
  ) {
    if (featureIds.length === 0) {
      return;
    }

    await tx.subscriptionFeature.createMany({
      data: featureIds.map((featureId) => ({
        subscriptionId,
        featureId,
        enabled: true,
      })),
      skipDuplicates: true,
    });
  }

  private calculateEndDate(startDate: Date, billingCycle: BillingCycle): Date {
    return extendBillingPeriod(startDate, billingCycle);
  }

  private async resolveActiveFeatures(codes: string[]) {
    const features = await this.prisma.feature.findMany({
      where: { code: { in: codes } },
    });

    return validateFeatureRecords(codes, features);
  }

  private async ensureTenantExists(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  private async recordSubscriptionPayment(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      subscriptionId: string;
      amount: Prisma.Decimal | number;
      currency: string;
      purpose: PaymentPurpose;
      paymentMethod?: string;
      paymentReference?: string;
      paidAt?: Date;
    },
  ) {
    const reference =
      params.paymentReference?.trim() || `${params.purpose}-${params.subscriptionId}-${Date.now()}`;

    const order = await tx.paymentOrder.create({
      data: {
        tenantId: params.tenantId,
        subscriptionId: params.subscriptionId,
        amount: params.amount,
        currency: params.currency,
        status: PaymentOrderStatus.PAID,
        gateway: PaymentGatewayProvider.MANUAL,
        reference,
        purpose: params.purpose,
        metadata: {
          paymentMethod: params.paymentMethod ?? 'MANUAL',
          paymentReference: params.paymentReference ?? reference,
        },
      },
    });

    const payment = await tx.payment.create({
      data: {
        paymentOrderId: order.id,
        transactionId: reference,
        status: PaymentRecordStatus.PAID,
        paidAt: params.paidAt ?? new Date(),
      },
    });

    return { order, payment };
  }

  private subscriptionInclude(): Prisma.SubscriptionInclude {
    return {
      plan: { select: { id: true, code: true, name: true, displayOrder: true } },
      planPrice: true,
      subscriptionFeatures: {
        where: { enabled: true },
        include: {
          feature: { select: { id: true, code: true, name: true, status: true } },
        },
        orderBy: { feature: { code: 'asc' } },
      },
      paymentOrders: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    };
  }
}
