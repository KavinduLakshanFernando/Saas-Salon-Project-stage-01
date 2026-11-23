import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentGatewayProvider, SubscriptionStatus } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentTenant } from '../tenant/decorators/current-tenant.decorator';
import { TenantContextGuard } from '../tenant/guards/tenant-context.guard';
import { TenantContext } from '../tenant/interfaces/tenant-context.interface';
import { PrismaService } from '../database/prisma.service';
import { PaymentOrdersService } from '../payments/payment-orders.service';
import { PaymentPurpose } from '../payments/dto/create-payment-order.dto';
import { SmsPackagesService } from './sms-packages.service';
import { SmsWalletService } from './sms-wallet.service';
import { SmsRechargeRequestsService } from './sms-recharge-requests.service';
import { calculateSmsSegments } from './sms-calculator.util';
import { PurchaseSmsPackageDto } from './dto/sms-package.dto';
import { CreateSmsRechargeRequestDto } from './dto/sms-recharge-request.dto';

@Controller('sms')
@UseGuards(JwtAuthGuard, TenantContextGuard)
export class SmsController {
  constructor(
    private readonly smsWalletService: SmsWalletService,
    private readonly smsPackagesService: SmsPackagesService,
    private readonly smsRechargeRequestsService: SmsRechargeRequestsService,
    private readonly paymentOrders: PaymentOrdersService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Returns SMS wallet overview for the authenticated tenant.
   * Includes balance, total purchased, consumed, low balance warning flag,
   * and whether the active base plan covers SMS quota.
   */
  @Get('wallet')
  async getWallet(@CurrentTenant() tenant: TenantContext) {
    return this.smsWalletService.getWalletOverview(tenant.tenantId);
  }

  /**
   * Returns active SMS packages available for purchase by salon owners.
   */
  @Get('packages')
  async getActivePackages() {
    return this.smsPackagesService.getActivePackages();
  }

  /**
   * Self-Service PayHere SMS package checkout.
   * Validates package and tenant subscription, creates pending PaymentOrder,
   * and generates secure PayHere checkout session.
   */
  @Post('checkout')
  @UseGuards(RolesGuard)
  @Roles('SALON_ADMIN')
  async createCheckout(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: PurchaseSmsPackageDto,
  ) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId: tenant.tenantId,
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIAL,
            SubscriptionStatus.SUSPENDED,
            SubscriptionStatus.PAST_DUE,
            SubscriptionStatus.PENDING,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new BadRequestException('No subscription found for this salon');
    }

    const unitPrice = Number(this.configService.get('SMS_UNIT_PRICE_LKR') || 1.0);
    let credits = 0;
    let amount = 0;
    let packageName = '';
    let packageId: string | null = null;
    let currency = 'LKR';

    if (dto.amount !== undefined && dto.amount !== null) {
      const parsedAmount = Math.floor(Number(dto.amount));
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new BadRequestException('Recharge amount must be a positive whole number.');
      }
      if (parsedAmount < 50) {
        throw new BadRequestException('Minimum recharge amount is LKR 50.');
      }
      if (parsedAmount > 500000) {
        throw new BadRequestException('Maximum recharge amount is LKR 500,000.');
      }
      amount = parsedAmount;
      credits = Math.floor(amount / unitPrice);
      packageName = `SMS Custom Recharge (${credits} Credits)`;
      packageId = null;
    } else if (dto.packageId) {
      const pkg = await this.smsPackagesService.getPackageById(dto.packageId);
      if (!pkg || !pkg.isActive) {
        throw new NotFoundException('Selected SMS package is not active or does not exist');
      }
      amount = Number(pkg.price);
      credits = pkg.credits;
      packageName = pkg.name;
      packageId = pkg.id;
      currency = pkg.currency || 'LKR';
    } else {
      throw new BadRequestException('Either a recharge amount or packageId must be provided.');
    }

    const gateway = dto.gateway || PaymentGatewayProvider.PAYHERE;

    const order = await this.paymentOrders.createOrder({
      tenantId: tenant.tenantId,
      subscriptionId: subscription.id,
      gateway,
      purpose: PaymentPurpose.SMS_PACKAGE_PURCHASE,
      metadata: {
        packageId,
        packageName,
        credits,
        amount,
        currency,
        unitPrice,
      },
    });

    const tenantRecord = await this.prisma.tenant.findUnique({
      where: { id: tenant.tenantId },
      select: { name: true, email: true, phone: true },
    });

    const frontendUrl = (
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'
    ).replace(/\/$/, '');
    const [firstName, ...lastParts] = (tenantRecord?.name ?? tenant.tenantName ?? 'Salon').split(
      ' ',
    );
    const lastName = lastParts.join(' ') || 'Admin';

    const session = await this.paymentOrders.buildCheckoutSession(
      order.reference,
      {
        orderReference: order.reference,
        amount: Number(order.amount),
        currency: order.currency,
        description: `SMS Recharge: ${packageName} (${credits} credits)`,
        customer: {
          firstName,
          lastName,
          email: tenantRecord?.email ?? tenant.userEmail ?? 'billing@salon.local',
          phone: tenantRecord?.phone ?? '0770000000',
          address: 'Colombo',
          city: 'Colombo',
        },
        returnUrl: `${frontendUrl}/salon/subscription?tab=sms&payment=success&orderRef=${order.reference}`,
        cancelUrl: `${frontendUrl}/salon/subscription?tab=sms&payment=cancel&orderRef=${order.reference}`,
      },
      gateway,
    );

    return {
      orderReference: order.reference,
      paymentOrderId: order.id,
      gateway: order.gateway,
      checkout: session.redirectData,
    };
  }

  /**
   * Salon owner submits an SMS credit recharge request to the platform administrator.
   */
  @Post('recharge-requests')
  @UseGuards(RolesGuard)
  @Roles('SALON_ADMIN')
  async createRechargeRequest(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateSmsRechargeRequestDto,
  ) {
    return this.smsRechargeRequestsService.createRequest(tenant.tenantId, dto);
  }

  /**
   * Returns paginated SMS recharge requests for this tenant.
   */
  @Get('recharge-requests')
  async getRechargeRequests(
    @CurrentTenant() tenant: TenantContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
    const limitNum = limit ? Math.min(100, Math.max(1, parseInt(limit, 10))) : 10;

    return this.smsRechargeRequestsService.listTenantRequests(tenant.tenantId, {
      page: pageNum,
      limit: limitNum,
      status: status as any,
    });
  }

  /**
   * Salon owner cancels a pending SMS recharge request.
   */
  @Post('recharge-requests/:id/cancel')
  @UseGuards(RolesGuard)
  @Roles('SALON_ADMIN')
  async cancelRechargeRequest(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.smsRechargeRequestsService.cancelTenantRequest(tenant.tenantId, id);
  }

  /**
   * Returns paginated manual payment records confirmed by Super Admin for this tenant.
   */
  @Get('manual-payments')
  async getManualPayments(
    @CurrentTenant() tenant: TenantContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
    const limitNum = limit ? Math.min(100, Math.max(1, parseInt(limit, 10))) : 20;

    return this.smsWalletService.getTenantManualPayments(tenant.tenantId, {
      page: pageNum,
      limit: limitNum,
    });
  }

  /**
   * Returns paginated credit transactions (purchases, usages, refunds, adjustments) for this tenant.
   */
  @Get('transactions')
  async getTransactions(
    @CurrentTenant() tenant: TenantContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
    const limitNum = limit ? Math.min(100, Math.max(1, parseInt(limit, 10))) : 20;

    return this.smsWalletService.getCreditTransactions(tenant.tenantId, {
      page: pageNum,
      limit: limitNum,
      type: type as any,
    });
  }

  /**
   * Returns paginated SMS message logs for this tenant.
   * Recipient phone numbers are automatically masked for privacy.
   */
  @Get('logs')
  async getLogs(
    @CurrentTenant() tenant: TenantContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
    const limitNum = limit ? Math.min(100, Math.max(1, parseInt(limit, 10))) : 20;

    return this.smsWalletService.getSmsLogs(tenant.tenantId, {
      page: pageNum,
      limit: limitNum,
      status: status as any,
    });
  }

  /**
   * Calculates character count, GSM-7 vs Unicode encoding, and segment estimation for any SMS text.
   */
  @Get('calculate')
  calculateEstimate(@Query('text') text?: string) {
    const message = text || '';
    const result = calculateSmsSegments(message);
    return {
      ...result,
      creditsRequired: result.segments,
    };
  }
}
