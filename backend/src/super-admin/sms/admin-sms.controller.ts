import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { SmsPackagesService } from '../../sms/sms-packages.service';
import { SmsWalletService } from '../../sms/sms-wallet.service';
import {
  ActivateSmsDto,
  AddCreditsDto,
  AddManualPaymentCreditsDto,
  AdjustCreditsDto,
  CreateSmsPackageDto,
  DeactivateSmsDto,
  ListSalonsSmsQueryDto,
  SetLowBalanceThresholdDto,
  UpdateSmsPackageDto,
} from '../../sms/dto/sms-package.dto';
import {
  FulfillRechargeRequestDto,
  ListRechargeRequestsDto,
  RejectRechargeRequestDto,
} from '../../sms/dto/sms-recharge-request.dto';
import { SmsRechargeRequestsService } from '../../sms/sms-recharge-requests.service';

@Controller('super-admin/sms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminSmsController {
  constructor(
    private readonly smsPackagesService: SmsPackagesService,
    private readonly smsWalletService: SmsWalletService,
    private readonly smsRechargeRequestsService: SmsRechargeRequestsService,
  ) {}

  /**
   * Retrieves paginated SMS recharge requests across all salons.
   */
  @Get('recharge-requests')
  async listRechargeRequests(@Query() query: ListRechargeRequestsDto) {
    return this.smsRechargeRequestsService.listAdminRequests(query);
  }

  /**
   * Super Admin approves and fulfills an SMS recharge request, allocating credits to salon wallet.
   */
  @Post('recharge-requests/:id/fulfill')
  async fulfillRechargeRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FulfillRechargeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.smsRechargeRequestsService.fulfillRequest(id, user.id, dto);
  }

  /**
   * Super Admin rejects an SMS recharge request.
   */
  @Post('recharge-requests/:id/reject')
  async rejectRechargeRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRechargeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.smsRechargeRequestsService.rejectRequest(id, user.id, dto);
  }

  /**
   * Retrieves paginated salons with their SMS activation status, credits, and subscription details.
   */
  @Get('salons')
  async listSalons(@Query() query: ListSalonsSmsQueryDto) {
    return this.smsWalletService.listSalonsForSms(query);
  }

  /**
   * Activates SMS for a Basic/Silver salon.
   * Atomically activates SMS and optionally allocates initial credits in one operation.
   */
  @Post('salons/:tenantId/activate')
  async activateSms(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: ActivateSmsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.smsWalletService.activateSms(
      tenantId,
      user.id,
      dto.credits ?? 0,
      dto.notes,
    );
  }

  /**
   * Deactivates SMS for a Basic/Silver salon.
   * Disables SMS sending while preserving all remaining credits and history.
   */
  @Post('salons/:tenantId/deactivate')
  async deactivateSms(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: DeactivateSmsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.smsWalletService.deactivateSms(tenantId, user.id, dto.reason);
  }

  /**
   * Manually adds SMS credits to an active salon.
   * Direct credit management (payment handled externally).
   */
  @Post('salons/:tenantId/add-credits')
  async addCredits(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: AddCreditsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.smsWalletService.addCredits(
      tenantId,
      user.id,
      dto.credits,
      dto.notes,
    );
  }

  /**
   * Top-up alias for backward compatibility.
   */
  @Post('salons/:tenantId/top-up')
  async addTopUpCredits(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() body: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const credits = body.credits ?? body.amount ?? 0;
    return this.smsWalletService.addCredits(
      tenantId,
      user.id,
      credits,
      body.notes,
    );
  }

  /**
   * Retrieves paginated manual payment records confirmed by Super Admin.
   */
  @Get('manual-payments')
  async getManualPayments(
    @Query('tenantId') tenantId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
    const limitNum = limit ? Math.min(100, Math.max(1, parseInt(limit, 10))) : 20;

    return this.smsWalletService.listManualPayments({
      tenantId,
      page: pageNum,
      limit: limitNum,
    });
  }

  /**
   * Retrieves SMS wallet overview and status for a specific salon.
   */
  @Get('wallets/:tenantId')
  async getTenantWallet(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.smsWalletService.getWalletOverview(tenantId);
  }

  /**
   * Configures the low-balance warning threshold for a tenant's SMS wallet.
   */
  @Patch('wallets/:tenantId/threshold')
  async updateThreshold(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: SetLowBalanceThresholdDto,
  ) {
    return this.smsWalletService.updateLowBalanceThreshold(tenantId, dto.threshold);
  }

  /**
   * Manually adds or deducts SMS credits from a tenant's wallet with an audit trail.
   */
  @Post('wallets/:tenantId/adjust')
  async adjustCredits(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: AdjustCreditsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.smsWalletService.adjustCredits({
      tenantId,
      amount: dto.amount,
      reason: dto.reason,
      performedBy: user.id,
    });
  }

  /**
   * Retrieves global SMS credit transactions across all tenants or for a specific salon.
   */
  @Get('transactions')
  async getGlobalTransactions(
    @Query('tenantId') tenantId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ) {
    const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
    const limitNum = limit ? Math.min(100, Math.max(1, parseInt(limit, 10))) : 25;

    return this.smsWalletService.getGlobalTransactions({
      tenantId,
      page: pageNum,
      limit: limitNum,
      type: type as any,
    });
  }

  /**
   * Retrieves global SMS message logs across all salons or for a specific salon.
   */
  @Get('logs')
  async getLogs(
    @Query('tenantId') tenantId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const pageNum = page ? Math.max(1, parseInt(page, 10)) : 1;
    const limitNum = limit ? Math.min(100, Math.max(1, parseInt(limit, 10))) : 25;

    return this.smsWalletService.getGlobalSmsLogs({
      tenantId,
      page: pageNum,
      limit: limitNum,
      status,
    });
  }

  // --- Historical package management endpoints (retained for backward compatibility) ---

  @Get('packages')
  async getAllPackages() {
    return this.smsPackagesService.getAllPackages();
  }

  @Post('packages')
  async createPackage(@Body() dto: CreateSmsPackageDto) {
    return this.smsPackagesService.createPackage(dto);
  }

  @Put('packages/:id')
  async updatePackage(@Param('id') id: string, @Body() dto: UpdateSmsPackageDto) {
    return this.smsPackagesService.updatePackage(id, dto);
  }

  @Patch('packages/:id/toggle')
  async togglePackageStatus(@Param('id') id: string) {
    return this.smsPackagesService.togglePackageStatus(id);
  }

  @Delete('packages/:id')
  async deletePackage(@Param('id') id: string) {
    return this.smsPackagesService.deletePackage(id);
  }
}
