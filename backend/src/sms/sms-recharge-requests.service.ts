import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SmsCreditTransactionType,
  SmsRechargeRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { buildPaginatedResponse, resolvePagination } from '../common/dto/pagination.dto';
import {
  CreateSmsRechargeRequestDto,
  FulfillRechargeRequestDto,
  ListRechargeRequestsDto,
  RejectRechargeRequestDto,
} from './dto/sms-recharge-request.dto';

@Injectable()
export class SmsRechargeRequestsService {
  private readonly logger = new Logger(SmsRechargeRequestsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Salon owner submits an SMS credit recharge request to the platform administrator.
   * Does NOT allocate SMS credits automatically on submission.
   */
  async createRequest(tenantId: string, dto: CreateSmsRechargeRequestDto) {
    if (!dto.packageId && (!dto.requestedCredits || dto.requestedCredits <= 0)) {
      throw new BadRequestException('Please select an SMS package or specify a valid credit amount.');
    }

    let requestedCredits: number;
    let amount: Prisma.Decimal | null = null;
    let packageId: string | null = null;

    if (dto.packageId) {
      const pkg = await this.prisma.smsPackage.findUnique({
        where: { id: dto.packageId },
      });
      if (!pkg || !pkg.isActive) {
        throw new NotFoundException('Selected SMS package is not active or does not exist.');
      }
      requestedCredits = pkg.credits;
      amount = pkg.price;
      packageId = pkg.id;
    } else {
      requestedCredits = Math.floor(dto.requestedCredits!);
      amount = new Prisma.Decimal(requestedCredits); // Standard reference: 1 LKR per credit
    }

    const request = await this.prisma.smsRechargeRequest.create({
      data: {
        tenantId,
        packageId,
        requestedCredits,
        amount,
        ownerMessage: dto.ownerMessage?.trim() || null,
        status: SmsRechargeRequestStatus.PENDING,
      },
      include: {
        package: {
          select: {
            id: true,
            name: true,
            credits: true,
            price: true,
            currency: true,
          },
        },
      },
    });

    this.logger.log(
      `Tenant ${tenantId} submitted SMS recharge request for ${requestedCredits} credits (ID: ${request.id})`,
    );

    return request;
  }

  /**
   * Paginated list of SMS recharge requests for a specific salon owner.
   */
  async listTenantRequests(
    tenantId: string,
    query: { page?: number; limit?: number; status?: SmsRechargeRequestStatus },
  ) {
    const { page, limit, offset } = resolvePagination(query.page, query.limit);
    const where: Prisma.SmsRechargeRequestWhereInput = { tenantId };

    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.smsRechargeRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          package: {
            select: {
              id: true,
              name: true,
              credits: true,
              price: true,
              currency: true,
            },
          },
          actionedBy: {
            select: {
              id: true,
              name: true,
            },
          },
          creditTransaction: {
            select: {
              id: true,
              amount: true,
              balanceAfter: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.smsRechargeRequest.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * Salon owner cancels their pending SMS recharge request.
   */
  async cancelTenantRequest(tenantId: string, requestId: string) {
    const request = await this.prisma.smsRechargeRequest.findFirst({
      where: { id: requestId, tenantId },
    });

    if (!request) {
      throw new NotFoundException('SMS recharge request not found.');
    }

    if (request.status !== SmsRechargeRequestStatus.PENDING) {
      throw new BadRequestException(
        `Cannot cancel request in "${request.status}" status. Only PENDING requests can be cancelled.`,
      );
    }

    const updated = await this.prisma.smsRechargeRequest.update({
      where: { id: requestId },
      data: {
        status: SmsRechargeRequestStatus.CANCELLED,
      },
      include: {
        package: true,
      },
    });

    this.logger.log(`Tenant ${tenantId} cancelled SMS recharge request ${requestId}`);
    return updated;
  }

  /**
   * Super Admin lists all SMS recharge requests with optional filters and search.
   */
  async listAdminRequests(query: ListRechargeRequestsDto) {
    const { page, limit, offset } = resolvePagination(query.page, query.limit);
    const where: Prisma.SmsRechargeRequestWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.tenant = {
        OR: [
          { name: { contains: s, mode: 'insensitive' } },
          { code: { contains: s, mode: 'insensitive' } },
          { email: { contains: s, mode: 'insensitive' } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.smsRechargeRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              code: true,
              email: true,
              phone: true,
            },
          },
          package: {
            select: {
              id: true,
              name: true,
              credits: true,
              price: true,
              currency: true,
            },
          },
          actionedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          creditTransaction: {
            select: {
              id: true,
              amount: true,
              balanceAfter: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.smsRechargeRequest.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * Super Admin fulfills an SMS recharge request:
   * Atomically adds credits to tenant wallet, updates request to FULFILLED,
   * records transaction and audit log, and prevents duplicate fulfillment.
   */
  async fulfillRequest(
    requestId: string,
    adminUserId: string,
    dto?: FulfillRechargeRequestDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.smsRechargeRequest.findUnique({
        where: { id: requestId },
        include: {
          package: true,
          tenant: { select: { id: true, name: true, code: true } },
        },
      });

      if (!request) {
        throw new NotFoundException('SMS recharge request not found.');
      }

      if (
        request.status !== SmsRechargeRequestStatus.PENDING &&
        request.status !== SmsRechargeRequestStatus.APPROVED
      ) {
        throw new BadRequestException(
          `This request is already ${request.status.toLowerCase()} and cannot be fulfilled again.`,
        );
      }

      const creditsToAdd = dto?.credits ?? request.requestedCredits;
      if (!creditsToAdd || creditsToAdd <= 0) {
        throw new BadRequestException('Credits to allocate must be greater than 0.');
      }

      let wallet = await tx.tenantSmsWallet.findUnique({
        where: { tenantId: request.tenantId },
      });

      if (!wallet) {
        wallet = await tx.tenantSmsWallet.create({
          data: {
            tenantId: request.tenantId,
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
      const lowBalanceWarned =
        newBalance > wallet.lowBalanceThreshold ? false : wallet.lowBalanceWarned;

      const updatedWallet = await tx.tenantSmsWallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBalance,
          totalPurchased: newTotalPurchased,
          lowBalanceWarned,
          isActive: true,
          activatedAt: wallet.activatedAt || now,
        },
      });

      const txDescription = request.package
        ? `Admin Request Fulfillment: ${request.package.name} (+${creditsToAdd.toLocaleString()} credits)`
        : `Admin Request Fulfillment: +${creditsToAdd.toLocaleString()} credits allocated by Admin`;

      const txRecord = await tx.smsCreditTransaction.create({
        data: {
          tenantId: request.tenantId,
          type: SmsCreditTransactionType.ADJUSTMENT,
          amount: creditsToAdd,
          balanceAfter: newBalance,
          packageId: request.packageId || null,
          description: txDescription,
          metadata: {
            requestId: request.id,
            requestedCredits: request.requestedCredits,
            allocatedCredits: creditsToAdd,
            actionedByAdminId: adminUserId,
            adminNotes: dto?.adminNotes || null,
            fulfilledAt: now.toISOString(),
          },
        },
      });

      const updatedRequest = await tx.smsRechargeRequest.update({
        where: { id: requestId },
        data: {
          status: SmsRechargeRequestStatus.FULFILLED,
          actionedByAdminId: adminUserId,
          creditTransactionId: txRecord.id,
          fulfilledAt: now,
          adminNotes: dto?.adminNotes || request.adminNotes || null,
        },
        include: {
          package: true,
          tenant: { select: { id: true, name: true, code: true } },
          actionedBy: { select: { id: true, name: true, email: true } },
          creditTransaction: true,
        },
      });

      await tx.superAdminAuditLog.create({
        data: {
          adminUserId,
          action: 'SMS_RECHARGE_REQUEST_FULFILLED',
          entityType: 'SMS_RECHARGE_REQUEST',
          entityId: request.id,
          tenantId: request.tenantId,
          oldValue: {
            status: request.status,
            balance: wallet.balance,
          },
          newValue: {
            status: SmsRechargeRequestStatus.FULFILLED,
            creditsAllocated: creditsToAdd,
            balance: newBalance,
          },
          metadata: {
            requestId: request.id,
            transactionId: txRecord.id,
            adminNotes: dto?.adminNotes,
          },
        },
      });

      this.logger.log(
        `Super Admin ${adminUserId} fulfilled SMS request ${requestId} for tenant ${request.tenantId}. Added ${creditsToAdd} credits. New balance: ${newBalance}.`,
      );

      return {
        success: true,
        message: `Successfully fulfilled SMS recharge request and allocated ${creditsToAdd.toLocaleString()} credits to ${request.tenant?.name || 'salon'}.`,
        request: updatedRequest,
        wallet: {
          tenantId: request.tenantId,
          balance: updatedWallet.balance,
          totalPurchased: updatedWallet.totalPurchased,
          totalConsumed: updatedWallet.totalConsumed,
          isActive: updatedWallet.isActive,
        },
      };
    });
  }

  /**
   * Super Admin rejects an SMS recharge request with a mandatory reason.
   */
  async rejectRequest(
    requestId: string,
    adminUserId: string,
    dto: RejectRechargeRequestDto,
  ) {
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('A reason is required to reject the SMS recharge request.');
    }

    const request = await this.prisma.smsRechargeRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException('SMS recharge request not found.');
    }

    if (
      request.status !== SmsRechargeRequestStatus.PENDING &&
      request.status !== SmsRechargeRequestStatus.APPROVED
    ) {
      throw new BadRequestException(
        `Cannot reject request in "${request.status}" status. Only PENDING or APPROVED requests can be rejected.`,
      );
    }

    const updatedRequest = await this.prisma.smsRechargeRequest.update({
      where: { id: requestId },
      data: {
        status: SmsRechargeRequestStatus.REJECTED,
        actionedByAdminId: adminUserId,
        adminNotes: dto.reason.trim(),
      },
      include: {
        package: true,
        tenant: { select: { id: true, name: true, code: true } },
        actionedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await this.prisma.superAdminAuditLog.create({
      data: {
        adminUserId,
        action: 'SMS_RECHARGE_REQUEST_REJECTED',
        entityType: 'SMS_RECHARGE_REQUEST',
        entityId: request.id,
        tenantId: request.tenantId,
        oldValue: { status: request.status },
        newValue: { status: SmsRechargeRequestStatus.REJECTED, reason: dto.reason.trim() },
        metadata: {
          requestId: request.id,
          reason: dto.reason.trim(),
        },
      },
    });

    this.logger.log(
      `Super Admin ${adminUserId} rejected SMS recharge request ${requestId} for tenant ${request.tenantId}`,
    );

    return {
      success: true,
      message: 'SMS recharge request rejected.',
      request: updatedRequest,
    };
  }
}
