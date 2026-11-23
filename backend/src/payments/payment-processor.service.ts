import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
  Inject,
  Optional,
} from '@nestjs/common';
import {
  PaymentGatewayProvider,
  PaymentOrderStatus,
  PaymentRecordStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { SubscriptionAddonsService } from '../subscriptions/subscription-addons.service';
import { PaymentPurpose } from './dto/create-payment-order.dto';
import { InvoicesService } from '../invoices/invoices.service';
import { NotificationQueueService } from '../notifications/notification-queue.service';
import { PaymentGatewayRegistry } from './payment-gateway.registry';
import { GatewayVerificationResult } from './interfaces/payment-gateway.interface';
import { ConfigService } from '@nestjs/config';
import { PayHereService } from './payhere.service';
import { SmsWalletService } from '../sms/sms-wallet.service';

export interface WebhookProcessResult {
  success: boolean;
  status: string;
  orderReference?: string;
  alreadyProcessed?: boolean;
}

@Injectable()
export class PaymentProcessorService {
  private readonly logger = new Logger(PaymentProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gatewayRegistry: PaymentGatewayRegistry,
    @Inject(forwardRef(() => SubscriptionsService))
    private readonly subscriptionsService: SubscriptionsService,
    @Inject(forwardRef(() => SubscriptionAddonsService))
    private readonly subscriptionAddonsService: SubscriptionAddonsService,
    private readonly invoicesService: InvoicesService,
    private readonly notificationQueue: NotificationQueueService,
    @Optional()
    @Inject(forwardRef(() => SmsWalletService))
    private readonly smsWalletService?: SmsWalletService,
    @Optional()
    private readonly configService?: ConfigService,
    @Optional()
    private readonly payHereService?: PayHereService,
  ) {}

  /**
   * Process a gateway webhook/callback. Never trusts frontend return URLs —
   * only verified server-side gateway payloads activate subscriptions.
   */
  async processWebhook(
    gateway: PaymentGatewayProvider,
    payload: unknown,
  ): Promise<WebhookProcessResult> {
    const gatewayAdapter = this.gatewayRegistry.get(gateway);
    const verification = gatewayAdapter.verifyWebhook(payload);

    if (!verification.orderReference) {
      throw new BadRequestException('Missing order reference in gateway payload');
    }

    const order = await this.prisma.paymentOrder.findUnique({
      where: { reference: verification.orderReference },
      include: { subscription: true },
    });

    if (!order) {
      this.logger.warn(`Payment order not found for reference ${verification.orderReference}`);
      throw new NotFoundException('Payment order not found');
    }

    if (order.gateway !== gateway) {
      throw new BadRequestException('Gateway mismatch for payment order');
    }

    await this.recordTransaction(order.id, gateway, 'webhook', verification);

    if (!verification.valid) {
      throw new BadRequestException(verification.error ?? 'Payment verification failed');
    }

    if (verification.status === 'pending') {
      return { success: true, status: 'pending', orderReference: order.reference };
    }

    if (verification.status === 'failed' || verification.status === 'cancelled') {
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: { status: PaymentOrderStatus.FAILED },
      });

      await this.notificationQueue
        .enqueuePaymentFailed({
          tenantId: order.tenantId,
          paymentOrderId: order.id,
          orderReference: order.reference,
        })
        .catch((error) => {
          this.logger.error(
            `Payment failed notification enqueue error: ${error instanceof Error ? error.message : String(error)}`,
          );
        });

      return { success: false, status: 'failed', orderReference: order.reference };
    }

    if (verification.status !== 'paid') {
      return { success: true, status: verification.status, orderReference: order.reference };
    }

    return this.completePaidOrder(order, verification);
  }

  async confirmReturnOrder(
    orderReference: string,
    tenantId?: string,
  ): Promise<WebhookProcessResult & {
    amount?: number;
    currency?: string;
    purpose?: string;
    plan?: { id: string; name: string; code?: string } | null;
    billingCycle?: string | null;
    paidAt?: Date | null;
    invoiceId?: string | null;
    invoiceNumber?: string | null;
    subscription?: {
      id: string;
      status: string;
      startDate: Date | null;
      endDate: Date | null;
      nextBillingDate: Date | null;
    } | null;
  }> {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { reference: orderReference },
      include: {
        subscription: {
          include: {
            plan: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Payment order not found');
    }

    if (tenantId && order.tenantId !== tenantId) {
      throw new BadRequestException('Payment order does not belong to this tenant');
    }

    let isPaid = order.status === PaymentOrderStatus.PAID;

    // In sandbox or development, or when allowReturnConfirm is enabled:
    // If webhook hasn't arrived (e.g. running on localhost without public IPN tunnel),
    // automatically verify and fulfill pending order on user return confirmation.
    const isSandboxOrDev =
      process.env.NODE_ENV !== 'test' &&
      ((this.payHereService && this.payHereService.sandbox) ||
        (this.configService && this.configService.get<boolean>('payhere.allowReturnConfirm')) ||
        process.env.PAYHERE_ALLOW_RETURN_CONFIRM === 'true' ||
        process.env.PAYHERE_SANDBOX !== 'false');

    if (order.status === PaymentOrderStatus.PENDING && isSandboxOrDev) {
      this.logger.log(`[Sandbox / Return Confirm] Auto-completing pending order ${order.reference} on return confirmation.`);
      const transactionId = `PH-SBX-${order.reference.slice(-12)}`;
      const verification: GatewayVerificationResult = {
        valid: true,
        orderReference: order.reference,
        transactionId,
        status: 'paid',
        amount: Number(order.amount),
        currency: order.currency,
        rawPayload: { mode: 'sandbox_return_auto_complete' },
      };
      await this.completePaidOrder(order, verification);
      isPaid = true;
    }

    let paymentInfo: {
      paidAt: Date | null;
      invoiceId: string | null;
      invoiceNumber: string | null;
    } | null = null;

    if (isPaid && this.prisma.payment?.findFirst) {
      const payment = await this.prisma.payment.findFirst({
        where: { paymentOrderId: order.id },
        orderBy: { createdAt: 'desc' },
        include: { invoice: true },
      });
      if (payment) {
        paymentInfo = {
          paidAt: payment.paidAt,
          invoiceId: payment.invoice?.id ?? null,
          invoiceNumber: payment.invoice?.invoiceNumber ?? null,
        };
      }
    }

    const metadata = order.metadata as { planId?: string; billingCycle?: string } | null;
    let plan = order.subscription?.plan ?? null;
    if (metadata?.planId && metadata.planId !== order.subscription?.planId && this.prisma.plan?.findUnique) {
      const targetPlan = await this.prisma.plan.findUnique({
        where: { id: metadata.planId },
        select: { id: true, name: true, code: true },
      });
      if (targetPlan) {
        plan = targetPlan;
      }
    }

    return {
      success: isPaid,
      status: order.status.toLowerCase(),
      orderReference: order.reference,
      alreadyProcessed: isPaid,
      amount: Number(order.amount),
      currency: order.currency,
      purpose: order.purpose,
      plan: plan ? { id: plan.id, name: plan.name, code: plan.code } : null,
      billingCycle: metadata?.billingCycle ?? order.subscription?.billingCycle ?? null,
      paidAt: paymentInfo?.paidAt ?? null,
      invoiceId: paymentInfo?.invoiceId ?? null,
      invoiceNumber: paymentInfo?.invoiceNumber ?? null,
      subscription: order.subscription
        ? {
            id: order.subscription.id,
            status: order.subscription.status,
            startDate: order.subscription.startDate,
            endDate: order.subscription.endDate,
            nextBillingDate: order.subscription.nextBillingDate,
          }
        : null,
    };
  }

  private async completePaidOrder(
    order: Prisma.PaymentOrderGetPayload<{ include: { subscription: true } }>,
    verification: GatewayVerificationResult,
  ): Promise<WebhookProcessResult> {
    if (order.status === PaymentOrderStatus.PAID) {
      return {
        success: true,
        status: 'paid',
        orderReference: order.reference,
        alreadyProcessed: true,
      };
    }

    this.validateAmountAndCurrency(order, verification);

    const transactionId = verification.transactionId ?? order.reference;

    const existingPayment = await this.prisma.payment.findUnique({
      where: { transactionId },
    });

    if (existingPayment?.status === PaymentRecordStatus.PAID) {
      return {
        success: true,
        status: 'paid',
        orderReference: order.reference,
        alreadyProcessed: true,
      };
    }

    const paidAt = new Date();
    let paymentId: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.upsert({
        where: { transactionId },
        update: {
          status: PaymentRecordStatus.PAID,
          paidAt,
        },
        create: {
          paymentOrderId: order.id,
          transactionId,
          status: PaymentRecordStatus.PAID,
          paidAt,
        },
      });

      paymentId = payment.id;

      await tx.paymentOrder.update({
        where: { id: order.id },
        data: { status: PaymentOrderStatus.PAID },
      });

      await tx.paymentTransaction.create({
        data: {
          paymentOrderId: order.id,
          paymentId: payment.id,
          gateway: order.gateway,
          eventType: 'payment_completed',
          rawPayload: verification.rawPayload as Prisma.InputJsonValue,
          verificationResult: verification as unknown as Prisma.InputJsonValue,
          verified: true,
        },
      });
    });

    await this.fulfillOrder(order, transactionId);

    if (paymentId) {
      const existingInvoice = this.prisma.invoice?.findFirst
        ? await this.prisma.invoice.findFirst({
            where: { paymentOrderId: order.id },
          })
        : null;

      let invoice: any = null;
      if (existingInvoice) {
        invoice = await this.invoicesService.markInvoicePaid(existingInvoice.id, {
          paymentId,
          paidAt,
          paymentMethod: order.gateway,
          paymentReference: transactionId,
        });
      } else {
        invoice = await this.invoicesService
          .generateFromPayment({
            paymentOrderId: order.id,
            paymentId,
            transactionId,
            paidAt,
          })
          .catch((error) => {
            this.logger.error(
              `Invoice generation failed for order ${order.reference}: ${error instanceof Error ? error.message : String(error)}`,
            );
            return null;
          });
      }

      if (invoice) {
        await this.invoicesService.sendInvoiceEmail(invoice.id).catch((error) => {
          this.logger.error(
            `Failed to auto-send invoice email for invoice ${invoice.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      }

      await this.notificationQueue
        .enqueuePaymentSuccess({
          tenantId: order.tenantId,
          paymentOrderId: order.id,
          paymentReference: transactionId,
        })
        .catch((error) => {
          this.logger.error(
            `Payment success notification enqueue error: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
    }

    return {
      success: true,
      status: 'paid',
      orderReference: order.reference,
    };
  }

  private validateAmountAndCurrency(
    order: { amount: Prisma.Decimal; currency: string },
    verification: GatewayVerificationResult,
  ) {
    if (verification.amount === null || verification.currency === null) {
      throw new BadRequestException('Gateway did not return amount/currency');
    }

    const expected = Number(order.amount).toFixed(2);
    const received = verification.amount.toFixed(2);

    if (expected !== received) {
      throw new BadRequestException(
        `Payment amount mismatch: expected ${expected}, received ${received}`,
      );
    }

    if (verification.currency !== order.currency) {
      throw new BadRequestException(
        `Payment currency mismatch: expected ${order.currency}, received ${verification.currency}`,
      );
    }
  }

  private async fulfillOrder(
    order: Prisma.PaymentOrderGetPayload<{ include: { subscription: true } }>,
    transactionId: string,
  ) {
    const purpose = order.purpose as PaymentPurpose;

    switch (purpose) {
      case PaymentPurpose.SIGNUP:
        // Signup fulfillment is handled by SignupService via callback registration
        return;

      case PaymentPurpose.SUBSCRIPTION_ACTIVATE: {
        const metadata = order.metadata as {
          planId?: string;
          planPriceId?: string;
          billingCycle?: 'MONTHLY' | 'YEARLY';
        } | null;

        await this.subscriptionsService.activateSubscription(
          order.subscriptionId,
          order.tenantId,
          {
            planId: metadata?.planId,
            planPriceId: metadata?.planPriceId,
            billingCycle: metadata?.billingCycle,
            paymentMethod: order.gateway,
            paymentReference: transactionId,
          },
          { fromPaymentProcessor: true },
        );
        return;
      }

      case PaymentPurpose.SUBSCRIPTION_RENEW: {
        const metadata = order.metadata as {
          planPriceId?: string;
          billingCycle?: 'MONTHLY' | 'YEARLY';
        } | null;

        await this.subscriptionsService.renewSubscription(
          order.subscriptionId,
          order.tenantId,
          {
            planPriceId: metadata?.planPriceId,
            billingCycle: metadata?.billingCycle,
            paymentMethod: order.gateway,
            paymentReference: transactionId,
          },
          { fromPaymentProcessor: true },
        );
        return;
      }

      case PaymentPurpose.SUBSCRIPTION_UPGRADE: {
        const metadata = order.metadata as {
          planId?: string;
          planPriceId?: string;
          billingCycle?: 'MONTHLY' | 'YEARLY';
        } | null;

        if (!metadata?.planId) {
          throw new BadRequestException('Upgrade payment order is missing target plan metadata');
        }

        await this.subscriptionsService.upgradeSubscriptionFromPayment(
          order.subscriptionId,
          order.tenantId,
          {
            planId: metadata.planId,
            planPriceId: metadata.planPriceId,
            billingCycle: metadata.billingCycle,
          },
          {
            paymentMethod: order.gateway,
            paymentReference: transactionId,
          },
        );
        return;
      }

      case PaymentPurpose.SUBSCRIPTION_ADDON_ACTIVATE:
        await this.subscriptionAddonsService.activatePaidAddOn({
          paymentOrderId: order.id,
          subscriptionAddOnId: (order as any).subscriptionAddOnId,
          transactionId,
          paymentMethod: order.gateway,
          paidAt: new Date(),
        });
        return;

      case PaymentPurpose.SMS_PACKAGE_PURCHASE: {
        const metadata = order.metadata as {
          packageId?: string | null;
          packageName?: string;
          credits?: number;
          amount?: number;
          unitPrice?: number;
        } | null;

        let pkg = null;
        if (metadata?.packageId) {
          pkg = await this.prisma.smsPackage.findUnique({
            where: { id: metadata.packageId },
          });
        }

        const credits = metadata?.credits ?? pkg?.credits ?? Math.floor(Number(order.amount) / 1.0);
        const packageName =
          metadata?.packageName ?? pkg?.name ?? `SMS Recharge (${credits} Credits)`;

        if (this.smsWalletService) {
          await this.smsWalletService.addPurchasedCredits({
            tenantId: order.tenantId,
            credits,
            paymentOrderId: order.id,
            packageId: metadata?.packageId || null,
            packageName,
            paymentReference: transactionId,
            amount: Number(order.amount),
            currency: order.currency,
          });
        }
        return;
      }

      default:
        throw new BadRequestException(`Unsupported payment purpose: ${purpose}`);
    }
  }

  private async recordTransaction(
    paymentOrderId: string,
    gateway: PaymentGatewayProvider,
    eventType: string,
    verification: GatewayVerificationResult,
  ) {
    await this.prisma.paymentTransaction.create({
      data: {
        paymentOrderId,
        gateway,
        eventType,
        rawPayload: verification.rawPayload as Prisma.InputJsonValue,
        verificationResult: verification as unknown as Prisma.InputJsonValue,
        verified: verification.valid,
      },
    });
  }
}
