import {
  CreateRentalCatalogShareDto,
  ListRentalCatalogSharesQueryDto,
  PreviewRentalCatalogQueryDto,
} from './dto/rental-catalog.dto';
import {
  CreateRentalCategoryDto,
  ListRentalCategoriesQueryDto,
  UpdateRentalCategoryDto,
} from './dto/rental-category.dto';
import {
  RentalHistoryQueryDto,
  RentalOverviewQueryDto,
  RentalReportsQueryDto,
} from './dto/rental-report.dto';
import {
  ListPendingReturnsQueryDto,
  ProcessRentalReturnDto,
  RecordRentalRefundDto,
  SettleRentalDepositDto,
  UpdateRentalUnitClearanceDto,
} from './dto/rental-return.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { RequirePermission } from '../../tenant/decorators/require-permission.decorator';
import { RequireFeature } from '../../tenant/decorators/require-feature.decorator';
import { FeatureGuard } from '../../tenant/guards/feature.guard';
import { PermissionGuard } from '../../tenant/guards/permission.guard';
import { TenantContextGuard } from '../../tenant/guards/tenant-context.guard';
import { TenantContext } from '../../tenant/interfaces/tenant-context.interface';
import {
  AddRentalUnitsDto,
  CreateRentalItemDto,
  ListRentalItemsQueryDto,
  UpdateRentalItemDto,
  UpdateRentalItemStatusDto,
  UpdateRentalUnitDto,
} from './dto/rental-item.dto';
import {
  CancelRentalBookingDto,
  CheckAvailabilityQueryDto,
  CreateRentalBookingDto,
  ListRentalBookingsQueryDto,
} from './dto/rental-booking.dto';
import {
  ConfirmRentalPickupDto,
  CreateRentalPaymentDto,
  ListRentalPaymentsQueryDto,
} from './dto/rental-payment.dto';
import { RentalsService } from './rentals.service';

@Controller('tenant/rentals')
@UseGuards(JwtAuthGuard, TenantContextGuard, FeatureGuard, PermissionGuard)
export class RentalsController {
  constructor(private readonly rentalsService: RentalsService) {}

  // -------------------------------------------------------------
  // RENTAL CATEGORIES
  // -------------------------------------------------------------

  @Get('categories/suggest-code')
  @RequirePermission('RENTAL_VIEW')
  suggestCategoryCode(@CurrentTenant() tenant: TenantContext) {
    return this.rentalsService.suggestNextCategoryCode(tenant.schemaName);
  }

  @Get('categories')
  @RequirePermission('RENTAL_VIEW')
  listCategories(
    @CurrentTenant() tenant: TenantContext,
    @Query() query?: ListRentalCategoriesQueryDto,
  ) {
    return this.rentalsService.listCategories(tenant.schemaName, query);
  }

  @Get('categories/:id')
  @RequirePermission('RENTAL_VIEW')
  getCategory(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.rentalsService.getCategory(tenant.schemaName, id);
  }

  @Post('categories')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_CREATE')
  createCategory(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRentalCategoryDto,
  ) {
    return this.rentalsService.createCategory(tenant.schemaName, dto, user.id);
  }

  @Patch('categories/:id')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_UPDATE')
  updateCategory(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRentalCategoryDto,
  ) {
    return this.rentalsService.updateCategory(tenant.schemaName, id, dto, user.id);
  }

  @Delete('categories/:id')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_DELETE')
  deleteCategory(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.rentalsService.deleteCategory(tenant.schemaName, id, user.id);
  }

  // -------------------------------------------------------------
  // RENTAL ITEMS
  // -------------------------------------------------------------

  @Get('items/suggest-code')
  @RequirePermission('RENTAL_VIEW')
  suggestCode(@CurrentTenant() tenant: TenantContext) {
    return this.rentalsService.suggestNextCode(tenant.schemaName);
  }

  @Get('items')
  @RequirePermission('RENTAL_VIEW')
  listItems(
    @CurrentTenant() tenant: TenantContext,
    @Query() query?: ListRentalItemsQueryDto,
  ) {
    return this.rentalsService.listItems(tenant.schemaName, query);
  }

  @Get('items/:id')
  @RequirePermission('RENTAL_VIEW')
  getItem(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.rentalsService.getItem(tenant.schemaName, id);
  }

  @Post('items')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_CREATE')
  createItem(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRentalItemDto,
  ) {
    return this.rentalsService.createItem(tenant.schemaName, dto, user.id);
  }

  @Patch('items/:id')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_UPDATE')
  updateItem(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRentalItemDto,
  ) {
    return this.rentalsService.updateItem(tenant.schemaName, id, dto, user.id);
  }

  @Patch('items/:id/status')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_UPDATE')
  updateItemStatus(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRentalItemStatusDto,
  ) {
    return this.rentalsService.updateItemStatus(tenant.schemaName, id, dto, user.id);
  }

  @Post('items/:id/units')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_UPDATE')
  addUnits(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddRentalUnitsDto,
  ) {
    return this.rentalsService.addUnits(tenant.schemaName, id, dto, user.id);
  }

  @Patch('units/:unitId')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_UPDATE')
  updateUnit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('unitId') unitId: string,
    @Body() dto: UpdateRentalUnitDto,
  ) {
    return this.rentalsService.updateUnit(tenant.schemaName, unitId, dto, user.id);
  }

  @Delete('items/:id')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_DELETE')
  deactivateItem(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.rentalsService.deactivateItem(tenant.schemaName, id, user.id);
  }

  // ==========================================
  // PHASE 2: RENTAL BOOKINGS MANAGEMENT
  // ==========================================

  @Get('availability')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_BOOKING_VIEW')
  checkAvailability(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: CheckAvailabilityQueryDto,
  ) {
    return this.rentalsService.checkAvailability(tenant.schemaName, query);
  }

  @Get('bookings/summary')
  @RequirePermission('RENTAL_BOOKING_VIEW')
  getBookingSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query('branchId') branchId?: string,
  ) {
    return this.rentalsService.getBookingSummary(tenant.schemaName, branchId);
  }

  @Get('bookings')
  @RequirePermission('RENTAL_BOOKING_VIEW')
  listBookings(
    @CurrentTenant() tenant: TenantContext,
    @Query() query?: ListRentalBookingsQueryDto,
  ) {
    return this.rentalsService.listBookings(tenant.schemaName, query);
  }

  @Get('bookings/:id')
  @RequirePermission('RENTAL_BOOKING_VIEW')
  getBooking(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.rentalsService.getBooking(tenant.schemaName, id);
  }

  @Post('bookings')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_BOOKING_CREATE')
  createBooking(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRentalBookingDto,
  ) {
    return this.rentalsService.createBooking(tenant.schemaName, dto, user.id);
  }

  @Post('bookings/:id/cancel')
  @RequirePermission('RENTAL_BOOKING_CANCEL')
  cancelBooking(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelRentalBookingDto,
  ) {
    return this.rentalsService.cancelBooking(tenant.schemaName, id, dto, user.id);
  }

  // ==========================================
  // PHASE 3: RENTAL PAYMENTS & PICKUP / HANDOVER
  // ==========================================

  @Get('payments/summary')
  @RequirePermission('RENTAL_PAYMENT_VIEW')
  getPaymentsSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query('branchId') branchId?: string,
  ) {
    return this.rentalsService.getPaymentsSummary(tenant.schemaName, branchId);
  }

  @Get('payments')
  @RequirePermission('RENTAL_PAYMENT_VIEW')
  listPayments(
    @CurrentTenant() tenant: TenantContext,
    @Query() query?: ListRentalPaymentsQueryDto,
  ) {
    return this.rentalsService.listPayments(tenant.schemaName, query);
  }

  @Get('payments/:id')
  @RequirePermission('RENTAL_PAYMENT_VIEW')
  getPayment(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.rentalsService.getPayment(tenant.schemaName, id);
  }

  @Post('payments')
  @RequirePermission('RENTAL_PAYMENT_CREATE')
  collectPayment(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRentalPaymentDto,
  ) {
    return this.rentalsService.collectPayment(tenant.schemaName, dto, user.id);
  }

  @Post('bookings/:id/pickup')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_BOOKING_PICKUP')
  confirmPickup(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ConfirmRentalPickupDto,
  ) {
    return this.rentalsService.confirmPickup(tenant.schemaName, id, dto, user.id);
  }

  // ==========================================
  // PHASE 4: RENTAL RETURNS, INSPECTION & SETTLEMENT
  // ==========================================

  @Get('returns/summary')
  @RequirePermission('RENTAL_RETURN_VIEW')
  getReturnsSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query('branchId') branchId?: string,
  ) {
    return this.rentalsService.getReturnsSummary(tenant.schemaName, branchId);
  }

  @Get('returns')
  @RequirePermission('RENTAL_RETURN_VIEW')
  listPendingReturns(
    @CurrentTenant() tenant: TenantContext,
    @Query() query?: ListPendingReturnsQueryDto,
  ) {
    return this.rentalsService.listPendingReturns(tenant.schemaName, query);
  }

  @Get('returns/:id/receipt')
  @RequirePermission('RENTAL_RETURN_VIEW')
  getReturnReceipt(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.rentalsService.getReturnReceipt(tenant.schemaName, id);
  }

  @Get('bookings/:id/return-details')
  @RequirePermission('RENTAL_RETURN_VIEW')
  getReturnDetails(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.rentalsService.getReturnDetails(tenant.schemaName, id);
  }

  @Post('bookings/:id/returns')
  @RequirePermission('RENTAL_RETURN_CREATE')
  processRentalReturn(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ProcessRentalReturnDto,
  ) {
    return this.rentalsService.processRentalReturn(tenant.schemaName, id, dto, user.id);
  }

  @Get('bookings/:id/returns')
  @RequirePermission('RENTAL_RETURN_VIEW')
  getBookingReturns(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.rentalsService.getBookingReturns(tenant.schemaName, id);
  }

  @Get('bookings/:id/deposit-settlement')
  @RequirePermission('RENTAL_RETURN_VIEW')
  getDepositSettlement(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.rentalsService.getDepositSettlementSummary(tenant.schemaName, id);
  }

  @Post('bookings/:id/deposit-settlement')
  @RequirePermission('RENTAL_RETURN_SETTLE')
  settleRentalDeposit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SettleRentalDepositDto,
  ) {
    return this.rentalsService.settleRentalDeposit(tenant.schemaName, id, dto, user.id);
  }

  @Post('bookings/:id/refunds')
  @RequirePermission('RENTAL_DEPOSIT_REFUND')
  recordRentalRefund(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RecordRentalRefundDto,
  ) {
    return this.rentalsService.recordRentalRefund(tenant.schemaName, id, dto, user.id);
  }

  @Patch('units/:id/clearance')
  @RequirePermission('RENTAL_UNIT_CLEARANCE')
  updateRentalUnitClearance(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRentalUnitClearanceDto,
  ) {
    return this.rentalsService.updateRentalUnitAfterCleaning(tenant.schemaName, id, dto, user.id);
  }


  // ==========================================
  // PHASE 5: RENTAL OVERVIEW, HISTORY & REPORTS
  // ==========================================

  @Get('overview')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_VIEW')
  getRentalOverview(
    @CurrentTenant() tenant: TenantContext,
    @Query() query?: RentalOverviewQueryDto,
  ) {
    return this.rentalsService.getRentalOverview(tenant.schemaName, query);
  }

  @Get('overview/upcoming-pickups')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_VIEW')
  getUpcomingPickups(
    @CurrentTenant() tenant: TenantContext,
    @Query('branchId') branchId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.rentalsService.getUpcomingPickups(tenant.schemaName, branchId, limit ? Number(limit) : 6);
  }

  @Get('overview/expected-returns')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_VIEW')
  getExpectedReturns(
    @CurrentTenant() tenant: TenantContext,
    @Query('branchId') branchId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.rentalsService.getExpectedReturns(tenant.schemaName, branchId, limit ? Number(limit) : 6);
  }

  @Get('overview/overdue')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_VIEW')
  getOverdueBookings(
    @CurrentTenant() tenant: TenantContext,
    @Query('branchId') branchId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.rentalsService.getOverdueBookings(tenant.schemaName, branchId, limit ? Number(limit) : 6);
  }

  @Get('overview/recent-activity')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_VIEW')
  getRecentRentalActivity(
    @CurrentTenant() tenant: TenantContext,
    @Query('branchId') branchId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.rentalsService.getRecentRentalActivity(tenant.schemaName, branchId, limit ? Number(limit) : 8);
  }

  @Get('history')
  @RequirePermission('RENTAL_VIEW')
  getRentalHistory(
    @CurrentTenant() tenant: TenantContext,
    @Query() query?: RentalHistoryQueryDto,
  ) {
    return this.rentalsService.getRentalHistory(tenant.schemaName, query);
  }

  @Get('history/customers/:customerId')
  @RequirePermission('RENTAL_VIEW')
  getCustomerRentalHistory(
    @CurrentTenant() tenant: TenantContext,
    @Param('customerId') customerId: string,
  ) {
    return this.rentalsService.getCustomerRentalHistory(tenant.schemaName, customerId);
  }

  @Get('history/units/:unitId')
  @RequirePermission('RENTAL_VIEW')
  getUnitRentalHistory(
    @CurrentTenant() tenant: TenantContext,
    @Param('unitId') unitId: string,
  ) {
    return this.rentalsService.getUnitRentalHistory(tenant.schemaName, unitId);
  }

  @Get('reports/summary')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_REPORT_VIEW')
  getRentalReportsSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query() query?: RentalReportsQueryDto,
  ) {
    return this.rentalsService.getRentalReportsSummary(tenant.schemaName, query);
  }

  @Get('reports/activity')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_REPORT_VIEW')
  getRentalActivityTrend(
    @CurrentTenant() tenant: TenantContext,
    @Query() query?: RentalReportsQueryDto,
  ) {
    return this.rentalsService.getRentalActivityTrend(tenant.schemaName, query);
  }

  @Get('reports/revenue')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_REPORT_VIEW')
  getRentalRevenueTrend(
    @CurrentTenant() tenant: TenantContext,
    @Query() query?: RentalReportsQueryDto,
  ) {
    return this.rentalsService.getRentalRevenueTrend(tenant.schemaName, query);
  }

  @Get('reports/categories')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_REPORT_VIEW')
  getRentalCategoryBreakdown(
    @CurrentTenant() tenant: TenantContext,
    @Query() query?: RentalReportsQueryDto,
  ) {
    return this.rentalsService.getRentalCategoryBreakdown(tenant.schemaName, query);
  }

  @Get('reports/unit-status')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_REPORT_VIEW')
  getRentalUnitStatusDistribution(
    @CurrentTenant() tenant: TenantContext,
    @Query('branchId') branchId?: string,
  ) {
    return this.rentalsService.getRentalUnitStatusDistribution(tenant.schemaName, branchId);
  }

  @Get('reports/export')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_REPORT_VIEW')
  exportRentalReportCsv(
    @CurrentTenant() tenant: TenantContext,
    @Query() query?: RentalReportsQueryDto & { reportType?: string },
  ) {
    return this.rentalsService.exportRentalReportCsv(tenant.schemaName, query);
  }



  // --- Catalog Sharing Endpoints ---

  @Post('catalogs/preview')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_CATALOG_SHARE')
  previewCatalog(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: PreviewRentalCatalogQueryDto,
  ) {
    return this.rentalsService.previewCatalogItems(tenant.schemaName, dto);
  }

  @Post('catalogs')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_CATALOG_SHARE')
  createCatalogShare(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRentalCatalogShareDto,
  ) {
    return this.rentalsService.createCatalogShare(
      tenant.tenantId,
      tenant.schemaName,
      dto,
      user.id,
      user.name,
    );
  }

  @Get('catalogs')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_CATALOG_SHARE')
  listCatalogShares(
    @CurrentTenant() tenant: TenantContext,
    @Query() query?: ListRentalCatalogSharesQueryDto,
  ) {
    return this.rentalsService.listCatalogShares(tenant.tenantId, query);
  }

  @Delete('catalogs/:id')
  @RequireFeature('RENTALS')
  @RequirePermission('RENTAL_CATALOG_SHARE')
  revokeCatalogShare(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.rentalsService.revokeCatalogShare(tenant.tenantId, id, user.id);
  }

}
