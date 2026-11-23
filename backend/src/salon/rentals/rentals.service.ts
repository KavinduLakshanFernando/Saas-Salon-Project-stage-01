import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { randomBytes } from 'crypto';
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
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantSchemaService } from '../../tenant/services/tenant-schema.service';
import { tenantTable } from '../../tenant/utils/schema-name.util';
import { buildPaginatedResponse, resolvePagination } from '../../common/dto/pagination.dto';
import { logAudit } from '../utils/audit.util';
import {
  AddRentalUnitsDto,
  CreateRentalItemDto,
  ListRentalItemsQueryDto,
  MANUALLY_ASSIGNABLE_UNIT_STATUSES,
  RentalUnitStatus,
  UpdateRentalItemDto,
  UpdateRentalItemStatusDto,
  UpdateRentalUnitDto,
} from './dto/rental-item.dto';
import {
  CancelRentalBookingDto,
  CheckAvailabilityQueryDto,
  CreateRentalBookingDto,
  ListRentalBookingsQueryDto,
  RentalBookingStatus,
} from './dto/rental-booking.dto';
import {
  ConfirmRentalPickupDto,
  CreateRentalPaymentDto,
  ListRentalPaymentsQueryDto,
  RentalAllocationType,
  RentalPaymentMethod,
} from './dto/rental-payment.dto';
import {
  ListPendingReturnsQueryDto,
  ProcessRentalReturnDto,
  ProcessReturnItemDto,
  RecordRentalRefundDto,
  RentalClearanceStatus,
  RentalItemCondition,
  SettleRentalDepositDto,
  UpdateRentalUnitClearanceDto,
} from './dto/rental-return.dto';

export interface RentalReturnItemRecord {
  id: string;
  returnId: string;
  bookingItemId: string;
  rentalUnitId: string;
  unitCode: string;
  unitNumber: number;
  itemName: string;
  itemCode: string;
  conditionOut: string | null;
  conditionIn: RentalItemCondition;
  inspectionNotes: string | null;
  lateFee: number;
  damageCharge: number;
  requiresMaintenance: boolean;
  createdAt: Date;
}

export interface RentalReturnRecord {
  id: string;
  returnNumber: string;
  branchId: string;
  branchName?: string;
  bookingId: string;
  bookingReference?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string | null;
  actualReturnAt: Date;
  returnedToUserId: string | null;
  returnedToUserName?: string | null;
  returnNotes: string | null;
  items?: RentalReturnItemRecord[];
  createdAt: Date;
}

export interface RentalDepositSettlementRecord {
  id: string;
  settlementNumber: string;
  branchId: string;
  bookingId: string;
  depositCollected: number;
  totalLateFees: number;
  totalDamageCharges: number;
  depositDeducted: number;
  depositRefunded: number;
  additionalAmountDue: number;
  settlementStatus: string;
  settledByUserId: string | null;
  settledByUserName?: string | null;
  settledAt: Date;
  notes: string | null;
  refunds?: RentalRefundRecord[];
}

export interface RentalRefundRecord {
  id: string;
  refundNumber: string;
  bookingId: string;
  settlementId: string | null;
  branchId: string;
  amount: number;
  paymentMethod: RentalPaymentMethod;
  refundStatus: string;
  refundedByUserId: string | null;
  refundedByUserName?: string | null;
  refundedAt: Date;
  notes: string | null;
  idempotencyKey: string | null;
}


export interface RentalBookingItemRecord {
  id: string;
  bookingId: string;
  rentalItemId: string;
  itemName: string;
  itemCode: string;
  itemCategory: string;
  rentalUnitId: string;
  unitCode: string;
  unitNumber: number;
  rentPrice: number;
  deposit: number;
  notes: string | null;
  createdAt: Date;
}

export interface BookingFinancialSummary {
  totalRent: number;
  paidRent: number;
  remainingRent: number;
  totalDeposit: number;
  heldDeposit: number;
  remainingDeposit: number;
  grandTotal: number;
  totalPaid: number;
  totalBalance: number;
  isFullyPaid: boolean;
  isRentFullyPaid: boolean;
  isDepositFullyPaid: boolean;
}

export interface RentalPaymentAllocationRecord {
  id: string;
  paymentId: string;
  bookingId: string;
  allocationType: RentalAllocationType;
  amount: number;
  notes: string | null;
  createdAt: Date;
}

export interface RentalPaymentRecord {
  id: string;
  branchId: string;
  branchName?: string;
  bookingId: string;
  bookingReference?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerCode?: string;
  paymentNumber: string;
  idempotencyKey: string | null;
  amount: number;
  paymentMethod: RentalPaymentMethod;
  referenceNumber: string | null;
  notes: string | null;
  receivedBy: string | null;
  receiverName?: string | null;
  rentAmount: number;
  depositAmount: number;
  allocations?: RentalPaymentAllocationRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RentalBookingRecord {
  id: string;
  branchId: string;
  branchName?: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerCode?: string;
  bookingReference: string;
  pickupDate: string;
  returnDate: string;
  status: RentalBookingStatus;
  totalRent: number;
  totalDeposit: number;
  notes: string | null;
  cancelledAt: Date | null;
  cancelledBy?: string | null;
  cancellerName?: string | null;
  cancellationReason: string | null;
  createdBy?: string | null;
  creatorName?: string | null;
  actualPickupAt?: Date | null;
  pickedUpByUserId?: string | null;
  pickedUpByName?: string | null;
  pickupNotes?: string | null;
  financials?: BookingFinancialSummary;
  payments?: RentalPaymentRecord[];
  createdAt: Date;
  updatedAt: Date;
  itemCount?: number;
  items?: RentalBookingItemRecord[];
}

export interface AvailabilityUnitRecord {
  id: string;
  unitNumber: number;
  unitCode: string;
  status: RentalUnitStatus;
  isAvailable: boolean;
  conflictReason?: string | null;
}

export interface RentalAvailabilityItem {
  id: string;
  code: string;
  name: string;
  category: string;
  size: string | null;
  color: string | null;
  rentPrice: number;
  deposit: number;
  status: string;
  notes: string | null;
  imageUrl: string | null;
  totalCopiesCount: number;
  availableCopiesCount: number;
  units: AvailabilityUnitRecord[];
}

export interface RentalUnitRecord {
  id: string;
  rentalItemId: string;
  branchId: string;
  branchName?: string;
  unitNumber: number;
  unitCode: string;
  status: RentalUnitStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RentalItemRecord {
  id: string;
  branchId: string;
  branchName?: string;
  code: string;
  name: string;
  category: string;
  size: string | null;
  color: string | null;
  rentPrice: number;
  deposit: number;
  status: string;
  notes: string | null;
  imageUrl: string | null;
  totalUnits: number;
  availableUnits: number;
  reservedUnits: number;
  rentedUnits: number;
  cleaningUnits: number;
  maintenanceUnits: number;
  inactiveUnits: number;
  createdAt: Date;
  updatedAt: Date;
  units?: RentalUnitRecord[];
}

@Injectable()
export class RentalsService {
  constructor(
    private readonly tenantSchemaService: TenantSchemaService,
    private readonly prisma?: PrismaService,
    private readonly configService?: ConfigService,
  ) {}

  /**
   * Helper: Ensure the branch exists and is active in the tenant schema.
   */
  private async assertBranchActive(
    tx: Prisma.TransactionClient,
    schemaName: string,
    branchId: string,
  ): Promise<{ id: string; name: string }> {
    const branches = tenantTable(schemaName, 'branches');
    const rows = await tx.$queryRawUnsafe<Array<{ id: string; name: string; status: string }>>(
      `SELECT id, name, status::text AS status FROM ${branches} WHERE id = $1::uuid LIMIT 1`,
      branchId,
    );

    if (rows.length === 0) {
      throw new NotFoundException('Branch not found');
    }

    if (rows[0].status !== 'ACTIVE') {
      throw new BadRequestException('Selected branch is currently inactive');
    }

    return { id: rows[0].id, name: rows[0].name };
  }

  /**
   * Suggest or generate next sequential rental item code (e.g. RENT-0001)
   * Guaranteed concurrency-safe via transaction advisory lock and sequence lookup.
   */
  async suggestNextCode(schemaName: string): Promise<{ code: string }> {
    const items = tenantTable(schemaName, 'rental_items');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      return { code: await this.generateNextItemCode(tx, schemaName, items) };
    });
  }

  private async generateNextItemCode(
    tx: Prisma.TransactionClient,
    schemaName: string,
    itemsTable: string,
  ): Promise<string> {
    // Acquire transaction-scoped advisory lock based on schema to serialize code generation
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('rental_items_seq_' || $1))`, schemaName);

    // Get next value from schema-scoped sequence
    let candidateCode = '';
    let isUnique = false;

    while (!isUnique) {
      const seqRows = await tx.$queryRawUnsafe<Array<{ seq: string | number }>>(
        `SELECT nextval('"${schemaName}".rental_item_code_seq') AS seq`,
      );
      const seqNum = Number(seqRows[0]?.seq ?? 1);
      candidateCode = `RENT-${String(seqNum).padStart(4, '0')}`;

      const existing = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM ${itemsTable} WHERE code = $1 LIMIT 1`,
        candidateCode,
      );

      if (existing.length === 0) {
        isUnique = true;
      }
    }

    return candidateCode;
  }

  /**
   * List rental items with search, filters, pagination, and real-time unit status aggregates.
   */
  async listItems(schemaName: string, query?: ListRentalItemsQueryDto) {
    const items = tenantTable(schemaName, 'rental_items');
    const units = tenantTable(schemaName, 'rental_units');
    const branches = tenantTable(schemaName, 'branches');

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (query?.branchId && query.branchId !== 'all') {
      conditions.push(`ri.branch_id = $${idx++}::uuid`);
      params.push(query.branchId);
    }

    if (query?.category && query.category !== 'all') {
      conditions.push(`ri.category::text = $${idx++}`);
      params.push(query.category);
    }

    if (query?.status && query.status !== 'all') {
      conditions.push(`ri.status::text = $${idx++}`);
      params.push(query.status.toUpperCase());
    }

    if (query?.unitStatus && query.unitStatus !== 'all') {
      conditions.push(
        `EXISTS (SELECT 1 FROM ${units} ru WHERE ru.rental_item_id = ri.id AND ru.status::text = $${idx++})`,
      );
      params.push(query.unitStatus.toUpperCase());
    }

    if (query?.search?.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      conditions.push(
        `(LOWER(ri.name) LIKE $${idx} OR LOWER(ri.code) LIKE $${idx} OR LOWER(COALESCE(ri.color, '')) LIKE $${idx} OR LOWER(COALESCE(ri.size, '')) LIKE $${idx} OR LOWER(COALESCE(ri.notes, '')) LIKE $${idx} OR EXISTS (SELECT 1 FROM ${units} ru WHERE ru.rental_item_id = ri.id AND LOWER(ru.unit_code) LIKE $${idx}))`,
      );
      params.push(term);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const totalResult = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::bigint AS count FROM ${items} ri ${whereClause}`,
        ...params,
      );
      const total = Number(totalResult[0]?.count ?? 0);

      const page = query?.page ? Number(query.page) : 1;
      const limit = query?.limit ? Number(query.limit) : 15;
      const { offset, page: safePage, limit: safeLimit } = resolvePagination(page, limit);

      const rows = await tx.$queryRawUnsafe<Array<any>>(
        `SELECT
            ri.id,
            ri.branch_id AS "branchId",
            b.name AS "branchName",
            ri.code,
            ri.name,
            ri.category::text AS category,
            ri.size,
            ri.color,
            ri.rent_price::float AS "rentPrice",
            ri.deposit::float AS deposit,
            ri.status::text AS status,
            ri.notes,
            ri.image_url AS "imageUrl",
            ri.created_at AS "createdAt",
            ri.updated_at AS "updatedAt",
            COALESCE((SELECT COUNT(*)::int FROM ${units} u WHERE u.rental_item_id = ri.id), 0) AS "totalUnits",
            COALESCE((SELECT COUNT(*)::int FROM ${units} u WHERE u.rental_item_id = ri.id AND u.status = 'AVAILABLE'), 0) AS "availableUnits",
            COALESCE((SELECT COUNT(*)::int FROM ${units} u WHERE u.rental_item_id = ri.id AND u.status = 'RESERVED'), 0) AS "reservedUnits",
            COALESCE((SELECT COUNT(*)::int FROM ${units} u WHERE u.rental_item_id = ri.id AND u.status = 'RENTED'), 0) AS "rentedUnits",
            COALESCE((SELECT COUNT(*)::int FROM ${units} u WHERE u.rental_item_id = ri.id AND u.status = 'CLEANING'), 0) AS "cleaningUnits",
            COALESCE((SELECT COUNT(*)::int FROM ${units} u WHERE u.rental_item_id = ri.id AND u.status = 'MAINTENANCE'), 0) AS "maintenanceUnits",
            COALESCE((SELECT COUNT(*)::int FROM ${units} u WHERE u.rental_item_id = ri.id AND u.status = 'INACTIVE'), 0) AS "inactiveUnits"
         FROM ${items} ri
         LEFT JOIN ${branches} b ON ri.branch_id = b.id
         ${whereClause}
         ORDER BY ri.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        ...params,
        safeLimit,
        offset,
      );

      return buildPaginatedResponse(rows, total, safePage, safeLimit);
    });
  }

  /**
   * Retrieve a single rental item by ID with full physical units list.
   */
  async getItem(schemaName: string, id: string): Promise<RentalItemRecord> {
    const items = tenantTable(schemaName, 'rental_items');
    const units = tenantTable(schemaName, 'rental_units');
    const branches = tenantTable(schemaName, 'branches');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const itemRows = await tx.$queryRawUnsafe<Array<any>>(
        `SELECT
            ri.id,
            ri.branch_id AS "branchId",
            b.name AS "branchName",
            ri.code,
            ri.name,
            ri.category::text AS category,
            ri.size,
            ri.color,
            ri.rent_price::float AS "rentPrice",
            ri.deposit::float AS deposit,
            ri.status::text AS status,
            ri.notes,
            ri.image_url AS "imageUrl",
            ri.created_at AS "createdAt",
            ri.updated_at AS "updatedAt",
            COALESCE((SELECT COUNT(*)::int FROM ${units} u WHERE u.rental_item_id = ri.id), 0) AS "totalUnits",
            COALESCE((SELECT COUNT(*)::int FROM ${units} u WHERE u.rental_item_id = ri.id AND u.status = 'AVAILABLE'), 0) AS "availableUnits",
            COALESCE((SELECT COUNT(*)::int FROM ${units} u WHERE u.rental_item_id = ri.id AND u.status = 'RESERVED'), 0) AS "reservedUnits",
            COALESCE((SELECT COUNT(*)::int FROM ${units} u WHERE u.rental_item_id = ri.id AND u.status = 'RENTED'), 0) AS "rentedUnits",
            COALESCE((SELECT COUNT(*)::int FROM ${units} u WHERE u.rental_item_id = ri.id AND u.status = 'CLEANING'), 0) AS "cleaningUnits",
            COALESCE((SELECT COUNT(*)::int FROM ${units} u WHERE u.rental_item_id = ri.id AND u.status = 'MAINTENANCE'), 0) AS "maintenanceUnits",
            COALESCE((SELECT COUNT(*)::int FROM ${units} u WHERE u.rental_item_id = ri.id AND u.status = 'INACTIVE'), 0) AS "inactiveUnits"
         FROM ${items} ri
         LEFT JOIN ${branches} b ON ri.branch_id = b.id
         WHERE ri.id = $1::uuid
         LIMIT 1`,
        id,
      );

      if (itemRows.length === 0) {
        throw new NotFoundException('Rental item not found');
      }

      const item = itemRows[0];

      // Fetch all units belonging to this item
      const unitRows = await tx.$queryRawUnsafe<Array<any>>(
        `SELECT
            ru.id,
            ru.rental_item_id AS "rentalItemId",
            ru.branch_id AS "branchId",
            b.name AS "branchName",
            ru.unit_number AS "unitNumber",
            ru.unit_code AS "unitCode",
            ru.status::text AS status,
            ru.notes,
            ru.created_at AS "createdAt",
            ru.updated_at AS "updatedAt"
         FROM ${units} ru
         LEFT JOIN ${branches} b ON ru.branch_id = b.id
         WHERE ru.rental_item_id = $1::uuid
         ORDER BY ru.unit_number ASC`,
        id,
      );

      item.units = unitRows;
      return item;
    });
  }

  /**
   * Create a new rental item and its initial batch of physical units atomically.
   */
  async createItem(schemaName: string, dto: CreateRentalItemDto, userId: string) {
    const items = tenantTable(schemaName, 'rental_items');
    const units = tenantTable(schemaName, 'rental_units');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      // Validate branch
      await this.assertBranchActive(tx, schemaName, dto.branchId);

      // Determine item code
      let itemCode = dto.code?.trim().toUpperCase();
      if (itemCode) {
        const existing = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM ${items} WHERE UPPER(code) = $1 LIMIT 1`,
          itemCode,
        );
        if (existing.length > 0) {
          throw new ConflictException(`Rental item code "${itemCode}" already exists`);
        }
      } else {
        itemCode = await this.generateNextItemCode(tx, schemaName, items);
      }

      // Insert parent rental item
      const itemInsert = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `INSERT INTO ${items}
           (branch_id, code, name, category, size, color, rent_price, deposit, status, notes, image_url)
         VALUES
           ($1::uuid, $2, $3, $4::varchar, $5, $6, $7, $8, 'ACTIVE', $9, $10)
         RETURNING id`,
        dto.branchId,
        itemCode,
        dto.name.trim(),
        dto.category,
        dto.size?.trim() || null,
        dto.color?.trim() || null,
        dto.rentPrice,
        dto.deposit ?? 0,
        dto.notes?.trim() || null,
        dto.imageUrl || null,
      );

      const rentalItemId = itemInsert[0].id;

      // Insert physical units (1..quantity)
      const createdUnits: Array<{ id: string; unitNumber: number; unitCode: string }> = [];

      for (let i = 1; i <= dto.quantity; i++) {
        const unitCode = `${itemCode}-${String(i).padStart(2, '0')}`;
        const unitInsert = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `INSERT INTO ${units}
             (rental_item_id, branch_id, unit_number, unit_code, status, notes)
           VALUES
             ($1::uuid, $2::uuid, $3, $4, 'AVAILABLE', $5)
           RETURNING id`,
          rentalItemId,
          dto.branchId,
          i,
          unitCode,
          `Initial unit ${i} for ${itemCode}`,
        );

        createdUnits.push({
          id: unitInsert[0].id,
          unitNumber: i,
          unitCode,
        });
      }

      await logAudit(tx, schemaName, {
        userId,
        action: 'RENTAL_ITEM_CREATE',
        entityType: 'rental_item',
        entityId: rentalItemId,
        details: {
          code: itemCode,
          name: dto.name,
          category: dto.category,
          quantity: dto.quantity,
          branchId: dto.branchId,
        },
      });

      return {
        id: rentalItemId,
        code: itemCode,
        unitsCount: createdUnits.length,
        units: createdUnits,
      };
    });
  }

  /**
   * Update rental item master configuration.
   */
  async updateItem(schemaName: string, id: string, dto: UpdateRentalItemDto, userId: string) {
    const items = tenantTable(schemaName, 'rental_items');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      // Check existing item
      const existing = await tx.$queryRawUnsafe<Array<{ id: string; branch_id: string }>>(
        `SELECT id, branch_id FROM ${items} WHERE id = $1::uuid LIMIT 1`,
        id,
      );
      if (existing.length === 0) {
        throw new NotFoundException('Rental item not found');
      }

      if (dto.branchId && dto.branchId !== existing[0].branch_id) {
        await this.assertBranchActive(tx, schemaName, dto.branchId);
      }

      await tx.$queryRawUnsafe(
        `UPDATE ${items}
         SET name = COALESCE($2, name),
             category = CASE WHEN $3::text IS NOT NULL THEN $3::varchar ELSE category END,
             size = CASE WHEN $4::boolean THEN $5 ELSE size END,
             color = CASE WHEN $6::boolean THEN $7 ELSE color END,
             rent_price = COALESCE($8, rent_price),
             deposit = COALESCE($9, deposit),
             branch_id = COALESCE($10::uuid, branch_id),
             notes = CASE WHEN $11::boolean THEN $12 ELSE notes END,
             image_url = CASE WHEN $13::boolean THEN $14 ELSE image_url END,
             updated_at = NOW()
         WHERE id = $1::uuid`,
        id,
        dto.name?.trim() ?? null,
        dto.category ?? null,
        dto.size !== undefined,
        dto.size?.trim() || null,
        dto.color !== undefined,
        dto.color?.trim() || null,
        dto.rentPrice ?? null,
        dto.deposit ?? null,
        dto.branchId ?? null,
        dto.notes !== undefined,
        dto.notes?.trim() || null,
        dto.imageUrl !== undefined,
        dto.imageUrl || null,
      );

      await logAudit(tx, schemaName, {
        userId,
        action: 'RENTAL_ITEM_UPDATE',
        entityType: 'rental_item',
        entityId: id,
        details: dto as unknown as Record<string, unknown>,
      });

      return { id, success: true };
    });
  }

  /**
   * Update rental item status (ACTIVE / INACTIVE).
   * Deactivating also places available units into INACTIVE state safely.
   */
  async updateItemStatus(
    schemaName: string,
    id: string,
    dto: UpdateRentalItemStatusDto,
    userId: string,
  ) {
    const items = tenantTable(schemaName, 'rental_items');
    const units = tenantTable(schemaName, 'rental_units');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const existing = await tx.$queryRawUnsafe<Array<{ id: string; status: string }>>(
        `SELECT id, status::text AS status FROM ${items} WHERE id = $1::uuid LIMIT 1`,
        id,
      );
      if (existing.length === 0) {
        throw new NotFoundException('Rental item not found');
      }

      await tx.$queryRawUnsafe(
        `UPDATE ${items}
         SET status = $2::text::"${schemaName}".rental_item_status,
             updated_at = NOW()
         WHERE id = $1::uuid`,
        id,
        dto.status,
      );

      // Update master item status only. Each physical unit preserves its exact physical
      // condition (AVAILABLE, CLEANING, MAINTENANCE, INACTIVE) without accidental overwrites.

      await logAudit(tx, schemaName, {
        userId,
        action: 'RENTAL_ITEM_STATUS_CHANGE',
        entityType: 'rental_item',
        entityId: id,
        details: { fromStatus: existing[0].status, toStatus: dto.status },
      });

      return { id, status: dto.status };
    });
  }

  /**
   * Add additional physical trackable units to an existing rental item.
   */
  async addUnits(schemaName: string, itemId: string, dto: AddRentalUnitsDto, userId: string) {
    const items = tenantTable(schemaName, 'rental_items');
    const units = tenantTable(schemaName, 'rental_units');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const itemRows = await tx.$queryRawUnsafe<Array<{ id: string; code: string; branch_id: string }>>(
        `SELECT id, code, branch_id FROM ${items} WHERE id = $1::uuid LIMIT 1`,
        itemId,
      );
      if (itemRows.length === 0) {
        throw new NotFoundException('Rental item not found');
      }

      const item = itemRows[0];
      const targetBranchId = dto.branchId || item.branch_id;
      await this.assertBranchActive(tx, schemaName, targetBranchId);

      // Determine highest existing unit number for this item
      const maxRow = await tx.$queryRawUnsafe<Array<{ maxNum: number }>>(
        `SELECT COALESCE(MAX(unit_number), 0)::int AS "maxNum" FROM ${units} WHERE rental_item_id = $1::uuid`,
        itemId,
      );
      const startNum = Number(maxRow[0]?.maxNum ?? 0);

      const addedUnits: Array<{ id: string; unitNumber: number; unitCode: string }> = [];

      for (let i = 1; i <= dto.quantity; i++) {
        const nextNum = startNum + i;
        const unitCode = `${item.code}-${String(nextNum).padStart(2, '0')}`;

        const unitInsert = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `INSERT INTO ${units}
             (rental_item_id, branch_id, unit_number, unit_code, status, notes)
           VALUES
             ($1::uuid, $2::uuid, $3, $4, 'AVAILABLE', $5)
           RETURNING id`,
          itemId,
          targetBranchId,
          nextNum,
          unitCode,
          dto.notes?.trim() || `Added unit ${nextNum} for ${item.code}`,
        );

        addedUnits.push({
          id: unitInsert[0].id,
          unitNumber: nextNum,
          unitCode,
        });
      }

      await logAudit(tx, schemaName, {
        userId,
        action: 'RENTAL_UNITS_ADD',
        entityType: 'rental_item',
        entityId: itemId,
        details: { quantityAdded: dto.quantity, addedUnits },
      });

      return {
        itemId,
        addedCount: addedUnits.length,
        units: addedUnits,
      };
    });
  }

  /**
   * Update an individual physical unit (status, notes, branch).
   * Strict Phase 1 constraint: RESERVED and RENTED cannot be set manually.
   */
  async updateUnit(schemaName: string, unitId: string, dto: UpdateRentalUnitDto, userId: string) {
    const units = tenantTable(schemaName, 'rental_units');

    // Phase 1 guard: Prevent manual assignment of RESERVED or RENTED
    if (dto.status === 'RESERVED' || dto.status === 'RENTED') {
      throw new BadRequestException(
        `Manual transition to "${dto.status}" is not permitted. RESERVED and RENTED are managed exclusively by booking workflows in upcoming phases.`,
      );
    }

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const existingRows = await tx.$queryRawUnsafe<
        Array<{ id: string; rental_item_id: string; status: string; unit_code: string; branch_id: string }>
      >(
        `SELECT id, rental_item_id, status::text AS status, unit_code, branch_id FROM ${units} WHERE id = $1::uuid LIMIT 1`,
        unitId,
      );

      if (existingRows.length === 0) {
        throw new NotFoundException('Rental unit not found');
      }

      const existing = existingRows[0];

      if (dto.branchId && dto.branchId !== existing.branch_id) {
        await this.assertBranchActive(tx, schemaName, dto.branchId);
      }

      // If unit is currently RESERVED or RENTED, prevent arbitrary status override without booking flow
      if (
        dto.status &&
        (existing.status === 'RESERVED' || existing.status === 'RENTED') &&
        dto.status !== existing.status
      ) {
        throw new BadRequestException(
          `Unit ${existing.unit_code} is currently ${existing.status} and cannot have its status manually altered.`,
        );
      }

      await tx.$queryRawUnsafe(
        `UPDATE ${units}
         SET status = CASE WHEN $2::text IS NOT NULL THEN $2::text::"${schemaName}".rental_unit_status ELSE status END,
             notes = CASE WHEN $3::boolean THEN $4 ELSE notes END,
             branch_id = COALESCE($5::uuid, branch_id),
             updated_at = NOW()
         WHERE id = $1::uuid`,
        unitId,
        dto.status ?? null,
        dto.notes !== undefined,
        dto.notes?.trim() || null,
        dto.branchId ?? null,
      );

      await logAudit(tx, schemaName, {
        userId,
        action: 'RENTAL_UNIT_UPDATE',
        entityType: 'rental_unit',
        entityId: unitId,
        details: {
          unitCode: existing.unit_code,
          fromStatus: existing.status,
          toStatus: dto.status ?? existing.status,
          notes: dto.notes,
          branchId: dto.branchId,
        },
      });

      return {
        id: unitId,
        unitCode: existing.unit_code,
        status: dto.status ?? existing.status,
        success: true,
      };
    });
  }

  /**
   * Safe deactivation / delete of rental item.
   * "Avoid deleting units that may later have booking history."
   * Soft-deactivates the item and its units to preserve operational integrity.
   */
  async deactivateItem(schemaName: string, id: string, userId: string) {
    return this.updateItemStatus(schemaName, id, { status: 'INACTIVE' }, userId);
  }

  /**
   * Suggest or generate next sequential rental category code (e.g. RCAT-0001)
   */
  async suggestNextCategoryCode(schemaName: string): Promise<{ code: string }> {
    const cats = tenantTable(schemaName, 'rental_categories');
    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      return { code: await this.generateNextCategoryCode(tx, cats) };
    });
  }

  private async generateNextCategoryCode(
    tx: Prisma.TransactionClient,
    catsTable: string,
  ): Promise<string> {
    const rows = await tx.$queryRawUnsafe<Array<{ max_num: number | null }>>(
      `SELECT MAX(NULLIF(regexp_replace(code, '^RCAT-', '', 'i'), '')::int) AS max_num
       FROM ${catsTable}
       WHERE code ~* '^RCAT-[0-9]+$'`,
    );
    const nextNum = (rows[0]?.max_num ?? 0) + 1;
    return `RCAT-${String(nextNum).padStart(4, '0')}`;
  }

  /**
   * List all rental categories with item count and optional filters
   */
  async listCategories(schemaName: string, query?: ListRentalCategoriesQueryDto) {
    const cats = tenantTable(schemaName, 'rental_categories');
    const items = tenantTable(schemaName, 'rental_items');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const conditions: string[] = ['1=1'];
      const params: any[] = [];
      let pIdx = 1;

      if (query?.search?.trim()) {
        conditions.push(`(rc.name ILIKE $${pIdx} OR rc.code ILIKE $${pIdx} OR rc.description ILIKE $${pIdx})`);
        params.push(`%${query.search.trim()}%`);
        pIdx++;
      }

      if (query?.status) {
        if (query.status.toUpperCase() === 'ACTIVE') {
          conditions.push(`rc.is_active = true`);
        } else if (query.status.toUpperCase() === 'INACTIVE') {
          conditions.push(`rc.is_active = false`);
        }
      }

      const rows = await tx.$queryRawUnsafe<Array<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        isActive: boolean;
        itemCount: string | number;
        createdAt: Date;
        updatedAt: Date;
      }>>(
        `SELECT
           rc.id,
           rc.code,
           rc.name,
           rc.description,
           rc.is_active AS "isActive",
           rc.created_at AS "createdAt",
           rc.updated_at AS "updatedAt",
           COUNT(ri.id)::int AS "itemCount"
         FROM ${cats} rc
         LEFT JOIN ${items} ri ON LOWER(ri.category) = LOWER(rc.name)
         WHERE ${conditions.join(' AND ')}
         GROUP BY rc.id, rc.code, rc.name, rc.description, rc.is_active, rc.created_at, rc.updated_at
         ORDER BY rc.name ASC`,
        ...params,
      );

      return rows.map((r) => ({
        ...r,
        itemCount: Number(r.itemCount || 0),
      }));
    });
  }

  /**
   * Get single rental category by ID with item count
   */
  async getCategory(schemaName: string, id: string) {
    const cats = tenantTable(schemaName, 'rental_categories');
    const items = tenantTable(schemaName, 'rental_items');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const rows = await tx.$queryRawUnsafe<Array<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        isActive: boolean;
        itemCount: string | number;
        createdAt: Date;
        updatedAt: Date;
      }>>(
        `SELECT
           rc.id,
           rc.code,
           rc.name,
           rc.description,
           rc.is_active AS "isActive",
           rc.created_at AS "createdAt",
           rc.updated_at AS "updatedAt",
           COUNT(ri.id)::int AS "itemCount"
         FROM ${cats} rc
         LEFT JOIN ${items} ri ON LOWER(ri.category) = LOWER(rc.name)
         WHERE rc.id = $1::uuid
         GROUP BY rc.id, rc.code, rc.name, rc.description, rc.is_active, rc.created_at, rc.updated_at
         LIMIT 1`,
        id,
      );

      if (rows.length === 0) {
        throw new NotFoundException('Rental category not found');
      }

      return {
        ...rows[0],
        itemCount: Number(rows[0].itemCount || 0),
      };
    });
  }

  /**
   * Create a new rental category
   */
  async createCategory(schemaName: string, dto: CreateRentalCategoryDto, userId: string) {
    const cats = tenantTable(schemaName, 'rental_categories');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const trimmedName = dto.name.trim();
      const dupName = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM ${cats} WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        trimmedName,
      );
      if (dupName.length > 0) {
        throw new ConflictException(`Category "${trimmedName}" already exists`);
      }

      let code = dto.code?.trim().toUpperCase();
      if (!code) {
        code = await this.generateNextCategoryCode(tx, cats);
      } else {
        const dupCode = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM ${cats} WHERE LOWER(code) = LOWER($1) LIMIT 1`,
          code,
        );
        if (dupCode.length > 0) {
          throw new ConflictException(`Category code "${code}" already exists`);
        }
      }

      const rows = await tx.$queryRawUnsafe<Array<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      }>>(
        `INSERT INTO ${cats} (code, name, description, is_active)
         VALUES ($1, $2, $3, true)
         RETURNING id, code, name, description, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
        code,
        trimmedName,
        dto.description?.trim() || null,
      );

      await logAudit(tx, schemaName, {
        userId,
        action: 'CREATE_RENTAL_CATEGORY',
        entityType: 'rental_category',
        entityId: rows[0].id,
        details: rows[0],
      });

      return {
        ...rows[0],
        itemCount: 0,
      };
    });
  }

  /**
   * Update rental category (name, description, isActive)
   * If category name is renamed, cascade update rental_items.category
   */
  async updateCategory(schemaName: string, id: string, dto: UpdateRentalCategoryDto, userId: string) {
    const cats = tenantTable(schemaName, 'rental_categories');
    const items = tenantTable(schemaName, 'rental_items');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const existing = await tx.$queryRawUnsafe<Array<{ id: string; name: string; code: string; is_active: boolean }>>(
        `SELECT id, name, code, is_active FROM ${cats} WHERE id = $1::uuid LIMIT 1`,
        id,
      );
      if (existing.length === 0) {
        throw new NotFoundException('Rental category not found');
      }

      const oldName = existing[0].name;
      const trimmedName = dto.name?.trim();

      if (trimmedName && trimmedName.toLowerCase() !== oldName.toLowerCase()) {
        const dupName = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM ${cats} WHERE LOWER(name) = LOWER($1) AND id <> $2::uuid LIMIT 1`,
          trimmedName,
          id,
        );
        if (dupName.length > 0) {
          throw new ConflictException(`Category "${trimmedName}" already exists`);
        }
      }

      const updatedRows = await tx.$queryRawUnsafe<Array<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      }>>(
        `UPDATE ${cats}
         SET name = COALESCE($2, name),
             description = CASE WHEN $3::boolean THEN $4 ELSE description END,
             is_active = COALESCE($5, is_active),
             updated_at = NOW()
         WHERE id = $1::uuid
         RETURNING id, code, name, description, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
        id,
        trimmedName ?? null,
        dto.description !== undefined,
        dto.description?.trim() || null,
        dto.isActive ?? null,
      );

      // If name changed, cascade update items table category column
      if (trimmedName && trimmedName.toLowerCase() !== oldName.toLowerCase()) {
        await tx.$queryRawUnsafe(
          `UPDATE ${items}
           SET category = $1
           WHERE LOWER(category) = LOWER($2)`,
          trimmedName,
          oldName,
        );
      }

      await logAudit(tx, schemaName, {
        userId,
        action: 'UPDATE_RENTAL_CATEGORY',
        entityType: 'rental_category',
        entityId: id,
        details: { old: existing[0], new: updatedRows[0] },
      });

      const countRows = await tx.$queryRawUnsafe<Array<{ count: number }>>(
        `SELECT COUNT(*)::int AS count FROM ${items} WHERE LOWER(category) = LOWER($1)`,
        updatedRows[0].name,
      );

      return {
        ...updatedRows[0],
        itemCount: Number(countRows[0]?.count || 0),
      };
    });
  }

  /**
   * Delete rental category if not assigned to any rental item
   */
  async deleteCategory(schemaName: string, id: string, userId: string) {
    const cats = tenantTable(schemaName, 'rental_categories');
    const items = tenantTable(schemaName, 'rental_items');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const existing = await tx.$queryRawUnsafe<Array<{ id: string; name: string; code: string }>>(
        `SELECT id, name, code FROM ${cats} WHERE id = $1::uuid LIMIT 1`,
        id,
      );
      if (existing.length === 0) {
        throw new NotFoundException('Rental category not found');
      }

      const catName = existing[0].name;

      const assignedRows = await tx.$queryRawUnsafe<Array<{ count: number }>>(
        `SELECT COUNT(*)::int AS count FROM ${items} WHERE LOWER(category) = LOWER($1)`,
        catName,
      );
      const assignedCount = Number(assignedRows[0]?.count || 0);

      if (assignedCount > 0) {
        throw new BadRequestException(
          `Cannot delete category "${catName}" because it is currently assigned to ${assignedCount} rental item(s). Please reassign or remove those items first.`,
        );
      }

      await tx.$queryRawUnsafe(`DELETE FROM ${cats} WHERE id = $1::uuid`, id);

      await logAudit(tx, schemaName, {
        userId,
        action: 'DELETE_RENTAL_CATEGORY',
        entityType: 'rental_category',
        entityId: id,
        details: existing[0],
      });

      return {
        success: true,
        message: `Category "${catName}" deleted successfully`,
      };
    });
  }

  // ==========================================
  // PHASE 2: RENTAL BOOKINGS MANAGEMENT
  // ==========================================

  /**
   * Generate sequential, tenant-unique booking reference (e.g. RENT-BK-0001)
   * Protected with a schema-scoped advisory transaction lock.
   */
  private round2(amount: number): number {
    return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
  }

  private calculateBookingFinancials(
    totalRent: number,
    totalDeposit: number,
    allocations: Array<{ allocationType: string; amount: number }>,
  ): BookingFinancialSummary {
    let paidRent = 0;
    let heldDeposit = 0;

    for (const alloc of allocations) {
      if (alloc.allocationType === 'RENT') {
        paidRent = this.round2(paidRent + Number(alloc.amount));
      } else if (alloc.allocationType === 'SECURITY_DEPOSIT') {
        heldDeposit = this.round2(heldDeposit + Number(alloc.amount));
      }
    }

    const tRent = this.round2(totalRent);
    const tDeposit = this.round2(totalDeposit);
    const remainingRent = Math.max(0, this.round2(tRent - paidRent));
    const remainingDeposit = Math.max(0, this.round2(tDeposit - heldDeposit));
    const grandTotal = this.round2(tRent + tDeposit);
    const totalPaid = this.round2(paidRent + heldDeposit);
    const totalBalance = this.round2(remainingRent + remainingDeposit);

    return {
      totalRent: tRent,
      paidRent,
      remainingRent,
      totalDeposit: tDeposit,
      heldDeposit,
      remainingDeposit,
      grandTotal,
      totalPaid,
      totalBalance,
      isFullyPaid: remainingRent <= 0 && remainingDeposit <= 0,
      isRentFullyPaid: remainingRent <= 0,
      isDepositFullyPaid: remainingDeposit <= 0,
    };
  }

  /**
   * Generate sequential, tenant-unique payment code (e.g. RPAY-0001)
   * Protected with a schema-scoped advisory transaction lock.
   */
  private async generateNextPaymentNumber(
    tx: Prisma.TransactionClient,
    schemaName: string,
    paymentsTable: string,
  ): Promise<string> {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext('rental_payments_seq_' || $1))`,
      schemaName,
    );

    let candidateCode = '';
    let isUnique = false;

    while (!isUnique) {
      const seqRows = await tx.$queryRawUnsafe<Array<{ seq: string | number }>>(
        `SELECT nextval('"${schemaName}".rental_payment_code_seq') AS seq`,
      );
      const seqNum = Number(seqRows[0]?.seq ?? 1);
      candidateCode = `RPAY-${String(seqNum).padStart(4, '0')}`;

      const existing = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM ${paymentsTable} WHERE payment_number = $1 LIMIT 1`,
        candidateCode,
      );

      if (existing.length === 0) {
        isUnique = true;
      }
    }

    return candidateCode;
  }

  private async generateNextBookingReference(
    tx: Prisma.TransactionClient,
    schemaName: string,
    bookingsTable: string,
  ): Promise<string> {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext('rental_bookings_seq_' || $1))`,
      schemaName,
    );

    let candidateRef = '';
    let isUnique = false;

    while (!isUnique) {
      const seqRows = await tx.$queryRawUnsafe<Array<{ seq: string | number }>>(
        `SELECT nextval('"${schemaName}".rental_booking_code_seq') AS seq`,
      );
      const seqNum = Number(seqRows[0]?.seq ?? 1);
      candidateRef = `RENT-BK-${String(seqNum).padStart(4, '0')}`;

      const existing = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM ${bookingsTable} WHERE booking_reference = $1 LIMIT 1`,
        candidateRef,
      );

      if (existing.length === 0) {
        isUnique = true;
      }
    }

    return candidateRef;
  }

  /**
   * Check availability of all rental items and their individual physical copies
   * for a requested pickup date and return date range at a specific branch.
   */
  async checkAvailability(
    schemaName: string,
    query: CheckAvailabilityQueryDto,
  ): Promise<RentalAvailabilityItem[]> {
    const items = tenantTable(schemaName, 'rental_items');
    const units = tenantTable(schemaName, 'rental_units');
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');

    if (query.returnDate < query.pickupDate) {
      throw new BadRequestException('Return date cannot be earlier than pickup date');
    }

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      await this.assertBranchActive(tx, schemaName, query.branchId);

      const conditions: string[] = [`ri.branch_id = $1::uuid`, `ri.status = 'ACTIVE'`];
      const params: unknown[] = [query.branchId];
      let idx = 2;

      if (query.category && query.category !== 'all') {
        conditions.push(`ri.category::text = $${idx++}`);
        params.push(query.category);
      }

      if (query.search?.trim()) {
        const term = `%${query.search.trim().toLowerCase()}%`;
        conditions.push(
          `(LOWER(ri.name) LIKE $${idx} OR LOWER(ri.code) LIKE $${idx} OR LOWER(COALESCE(ri.color, '')) LIKE $${idx} OR LOWER(COALESCE(ri.size, '')) LIKE $${idx} OR EXISTS (SELECT 1 FROM ${units} ru WHERE ru.rental_item_id = ri.id AND LOWER(ru.unit_code) LIKE $${idx}))`,
        );
        params.push(term);
        idx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 1. Fetch active rental items
      const itemRows = await tx.$queryRawUnsafe<Array<any>>(
        `SELECT
            ri.id,
            ri.code,
            ri.name,
            ri.category::text AS category,
            ri.size,
            ri.color,
            ri.rent_price::float AS "rentPrice",
            ri.deposit::float AS deposit,
            ri.status::text AS status,
            ri.notes,
            ri.image_url AS "imageUrl"
         FROM ${items} ri
         ${whereClause}
         ORDER BY ri.name ASC`,
        ...params,
      );

      if (itemRows.length === 0) {
        return [];
      }

      const itemIds = itemRows.map((r) => r.id);

      // 2. Fetch all physical units for these items
      const unitRows = await tx.$queryRawUnsafe<Array<any>>(
        `SELECT
            ru.id,
            ru.rental_item_id AS "rentalItemId",
            ru.unit_number AS "unitNumber",
            ru.unit_code AS "unitCode",
            ru.status::text AS status
         FROM ${units} ru
         WHERE ru.rental_item_id = ANY($1::uuid[])
           AND ru.branch_id = $2::uuid
         ORDER BY ru.unit_number ASC`,
        itemIds,
        query.branchId,
      );

      if (unitRows.length === 0) {
        return itemRows.map((item) => ({
          ...item,
          totalCopiesCount: 0,
          availableCopiesCount: 0,
          units: [],
        }));
      }

      const unitIds = unitRows.map((u) => u.id);

      // 3. Fetch active overlapping bookings for these units in requested dates
      // Two inclusive date intervals [A_start, A_end] and [B_start, B_end] overlap iff A_start <= B_end AND A_end >= B_start
      const conflictRows = await tx.$queryRawUnsafe<
        Array<{
          rentalUnitId: string;
          bookingReference: string;
          pickupDate: string;
          returnDate: string;
        }>
      >(
        `SELECT
            rbi.rental_unit_id AS "rentalUnitId",
            rb.booking_reference AS "bookingReference",
            rb.pickup_date::text AS "pickupDate",
            rb.return_date::text AS "returnDate"
         FROM ${bookingItems} rbi
         JOIN ${bookings} rb ON rb.id = rbi.booking_id
         WHERE rbi.rental_unit_id = ANY($1::uuid[])
           AND rb.status NOT IN ('CANCELLED', 'RETURNED')
           AND rb.pickup_date <= $2::date
           AND (
             CASE
               WHEN rb.status IN ('PICKED_UP', 'PARTIALLY_RETURNED')
               THEN GREATEST(rb.return_date, CURRENT_DATE)
               ELSE rb.return_date
             END
           ) >= $3::date`,
        unitIds,
        query.returnDate,
        query.pickupDate,
      );

      const conflictMap = new Map<
        string,
        { bookingReference: string; pickupDate: string; returnDate: string }
      >();
      for (const c of conflictRows) {
        conflictMap.set(c.rentalUnitId, c);
      }

      const todayStr = new Date().toISOString().slice(0, 10);

      // Group units by rental item
      const unitsByItem = new Map<string, AvailabilityUnitRecord[]>();
      for (const u of unitRows) {
        let isAvailable = false;
        let conflictReason: string | null = null;

        if (u.status === 'INACTIVE') {
          conflictReason = 'Unit is currently inactive';
        } else if (u.status === 'MAINTENANCE') {
          conflictReason = 'Unit is under repair / maintenance';
        } else if (u.status === 'CLEANING') {
          conflictReason = 'Unit is currently undergoing cleaning / laundry';
        } else if (conflictMap.has(u.id)) {
          const conflict = conflictMap.get(u.id)!;
          conflictReason = `Booked for ${conflict.pickupDate} to ${conflict.returnDate} (${conflict.bookingReference})`;
        } else if (u.status === 'RENTED' && query.pickupDate <= todayStr) {
          conflictReason = 'Unit is physically rented out and not yet returned';
        } else {
          isAvailable = true;
        }

        const unitRecord: AvailabilityUnitRecord = {
          id: u.id,
          unitNumber: u.unitNumber,
          unitCode: u.unitCode,
          status: u.status,
          isAvailable,
          conflictReason,
        };

        if (!unitsByItem.has(u.rentalItemId)) {
          unitsByItem.set(u.rentalItemId, []);
        }
        unitsByItem.get(u.rentalItemId)!.push(unitRecord);
      }

      return itemRows.map((item) => {
        const itemUnits = unitsByItem.get(item.id) || [];
        const availableCopiesCount = itemUnits.filter((u) => u.isAvailable).length;
        return {
          ...item,
          totalCopiesCount: itemUnits.length,
          availableCopiesCount,
          units: itemUnits,
        };
      });
    });
  }

  /**
   * Concurrency-safe creation of a multi-item rental booking.
   * Locks physical units with row-level locks, checks date availability,
   * calculates snapshot prices, and inserts atomically.
   */
  async createBooking(schemaName: string, dto: CreateRentalBookingDto, userId: string) {
    const items = tenantTable(schemaName, 'rental_items');
    const units = tenantTable(schemaName, 'rental_units');
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const customers = tenantTable(schemaName, 'customers');

    if (dto.returnDate < dto.pickupDate) {
      throw new BadRequestException('Expected return date cannot be earlier than pickup date');
    }

    const uniqueUnitIds = Array.from(new Set(dto.unitIds));
    if (uniqueUnitIds.length !== dto.unitIds.length) {
      throw new BadRequestException('Duplicate physical copies selected in the same booking');
    }

    // Deterministic sorting to prevent deadlocks under concurrent multi-item requests
    const sortedUnitIds = [...uniqueUnitIds].sort();

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      // 1. Validate branch
      await this.assertBranchActive(tx, schemaName, dto.branchId);

      // 2. Validate customer
      const customerRows = await tx.$queryRawUnsafe<
        Array<{ id: string; name: string; phone: string | null; status: string }>
      >(
        `SELECT id, name, phone, status::text AS status FROM ${customers} WHERE id = $1::uuid LIMIT 1`,
        dto.customerId,
      );
      if (customerRows.length === 0) {
        throw new NotFoundException('Customer not found');
      }
      if (customerRows[0].status !== 'ACTIVE') {
        throw new BadRequestException('Selected customer is currently not active');
      }

      // 3. Concurrency lock: Select and lock physical units with FOR UPDATE in deterministic order
      const lockedUnits = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          rentalItemId: string;
          branchId: string;
          unitNumber: number;
          unitCode: string;
          status: string;
          itemName: string;
          itemCode: string;
          itemStatus: string;
          rentPrice: number;
          deposit: number;
        }>
      >(
        `SELECT
            ru.id,
            ru.rental_item_id AS "rentalItemId",
            ru.branch_id AS "branchId",
            ru.unit_number AS "unitNumber",
            ru.unit_code AS "unitCode",
            ru.status::text AS status,
            ri.name AS "itemName",
            ri.code AS "itemCode",
            ri.status::text AS "itemStatus",
            ri.rent_price::float AS "rentPrice",
            ri.deposit::float AS deposit
         FROM ${units} ru
         JOIN ${items} ri ON ri.id = ru.rental_item_id
         WHERE ru.id = ANY($1::uuid[])
         ORDER BY ru.id ASC
         FOR UPDATE`,
        sortedUnitIds,
      );

      if (lockedUnits.length !== sortedUnitIds.length) {
        throw new NotFoundException('One or more selected physical copies were not found');
      }

      // 4. Validate unit conditions & branch matching
      const todayStr = new Date().toISOString().slice(0, 10);
      for (const u of lockedUnits) {
        if (u.branchId !== dto.branchId) {
          throw new BadRequestException(
            `Copy ${u.unitCode} does not belong to the selected branch`,
          );
        }
        if (u.itemStatus !== 'ACTIVE') {
          throw new BadRequestException(
            `Rental item "${u.itemName}" (${u.itemCode}) is currently inactive`,
          );
        }
        if (u.status === 'INACTIVE') {
          throw new ConflictException(
            `Copy ${u.unitCode} (${u.itemName}) is currently inactive and cannot be booked`,
          );
        }
        if (u.status === 'MAINTENANCE') {
          throw new ConflictException(
            `Copy ${u.unitCode} (${u.itemName}) is currently under repair / maintenance and cannot be booked`,
          );
        }
        if (u.status === 'CLEANING') {
          throw new ConflictException(
            `Copy ${u.unitCode} (${u.itemName}) is currently undergoing cleaning / laundry and cannot be booked`,
          );
        }
        if (u.status === 'RENTED' && dto.pickupDate <= todayStr) {
          throw new ConflictException(
            `Copy ${u.unitCode} (${u.itemName}) is currently rented out and cannot be picked up on ${dto.pickupDate}`,
          );
        }
        // Note: Units in RESERVED or currently RENTED with non-overlapping future dates are verified in Step 5 below
      }

      // 5. Date-overlap check under transaction lock
      const conflictRows = await tx.$queryRawUnsafe<
        Array<{
          rentalUnitId: string;
          unitCode: string;
          itemName: string;
          bookingReference: string;
          pickupDate: string;
          returnDate: string;
        }>
      >(
        `SELECT
            rbi.rental_unit_id AS "rentalUnitId",
            ru.unit_code AS "unitCode",
            ri.name AS "itemName",
            rb.booking_reference AS "bookingReference",
            rb.pickup_date::text AS "pickupDate",
            rb.return_date::text AS "returnDate"
         FROM ${bookingItems} rbi
         JOIN ${bookings} rb ON rb.id = rbi.booking_id
         JOIN ${units} ru ON ru.id = rbi.rental_unit_id
         JOIN ${items} ri ON ri.id = rbi.rental_item_id
         WHERE rbi.rental_unit_id = ANY($1::uuid[])
           AND rb.status NOT IN ('CANCELLED', 'RETURNED')
           AND rb.pickup_date <= $2::date
           AND (
             CASE
               WHEN rb.status IN ('PICKED_UP', 'PARTIALLY_RETURNED')
               THEN GREATEST(rb.return_date, CURRENT_DATE)
               ELSE rb.return_date
             END
           ) >= $3::date
         LIMIT 1`,
        sortedUnitIds,
        dto.returnDate,
        dto.pickupDate,
      );

      if (conflictRows.length > 0) {
        const c = conflictRows[0];
        throw new ConflictException(
          `This copy (${c.unitCode} - ${c.itemName}) is no longer available for the selected dates (${dto.pickupDate} to ${dto.returnDate}). It is already booked under ${c.bookingReference}. Please choose another copy.`,
        );
      }

      // 6. Generate sequential booking reference (RENT-BK-0001)
      const bookingRef = await this.generateNextBookingReference(tx, schemaName, bookings);

      // 7. Calculate snapshot totals
      const totalRent =
        Math.round(lockedUnits.reduce((acc, u) => acc + Number(u.rentPrice), 0) * 100) / 100;
      const itemsDeposit =
        Math.round(lockedUnits.reduce((acc, u) => acc + Number(u.deposit), 0) * 100) / 100;
      // Support entering a refundable deposit at booking level even if item master has no deposit
      const totalDeposit =
        dto.securityDeposit !== undefined && dto.securityDeposit !== null
          ? Math.max(0, Math.round(Number(dto.securityDeposit) * 100) / 100)
          : itemsDeposit;

      // 8. Insert master rental booking
      const bookingInsert = await tx.$queryRawUnsafe<Array<{ id: string; createdAt: Date }>>(
        `INSERT INTO ${bookings}
           (branch_id, customer_id, booking_reference, pickup_date, return_date, status, total_rent, total_deposit, notes, created_by)
         VALUES
           ($1::uuid, $2::uuid, $3, $4::date, $5::date, 'RESERVED', $6, $7, $8, $9::uuid)
         RETURNING id, created_at AS "createdAt"`,
        dto.branchId,
        dto.customerId,
        bookingRef,
        dto.pickupDate,
        dto.returnDate,
        totalRent,
        totalDeposit,
        dto.notes?.trim() || null,
        userId,
      );

      const bookingId = bookingInsert[0].id;

      // 9. Insert item reservations with price and deposit snapshots
      for (const u of lockedUnits) {
        await tx.$queryRawUnsafe(
          `INSERT INTO ${bookingItems}
             (booking_id, rental_item_id, rental_unit_id, rent_price, deposit, notes)
           VALUES
             ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6)`,
          bookingId,
          u.rentalItemId,
          u.id,
          u.rentPrice,
          u.deposit,
          `Reserved under ${bookingRef}`,
        );
      }

      // 10. Process Optional Advance Payment / Deposit Collection Atomically
      let advancePaymentRecord: RentalPaymentRecord | null = null;
      if (dto.advancePayment) {
        const rentPay = this.round2(Number(dto.advancePayment.rentAmount || 0));
        const depPay = this.round2(Number(dto.advancePayment.depositAmount || 0));
        const totalPay = this.round2(rentPay + depPay);

        if (totalPay > 0) {
          if (rentPay > totalRent) {
            throw new BadRequestException(
              `Advance rent payment (${rentPay}) cannot exceed total rent (${totalRent})`,
            );
          }
          if (depPay > totalDeposit) {
            throw new BadRequestException(
              `Deposit collection (${depPay}) cannot exceed required deposit (${totalDeposit})`,
            );
          }

          const payments = tenantTable(schemaName, 'rental_payments');
          const allocations = tenantTable(schemaName, 'rental_payment_allocations');
          const paymentNumber = await this.generateNextPaymentNumber(tx, schemaName, payments);
          const paymentMethod = dto.advancePayment.paymentMethod || 'CASH';

          const payInsert = await tx.$queryRawUnsafe<
            Array<{ id: string; createdAt: Date; updatedAt: Date }>
          >(
            `INSERT INTO ${payments}
               (branch_id, booking_id, payment_number, idempotency_key, amount, payment_method, reference_number, notes, received_by)
             VALUES
               ($1::uuid, $2::uuid, $3, $4, $5, $6::text::"${schemaName}".payment_method, $7, $8, $9::uuid)
             RETURNING id, created_at AS "createdAt", updated_at AS "updatedAt"`,
            dto.branchId,
            bookingId,
            paymentNumber,
            dto.advancePayment.idempotencyKey?.trim() || null,
            totalPay,
            paymentMethod,
            dto.advancePayment.referenceNumber?.trim() || null,
            dto.advancePayment.notes?.trim() || 'Advance payment at booking reservation',
            userId,
          );
          const paymentId = payInsert[0].id;

          const createdAllocations: RentalPaymentAllocationRecord[] = [];
          if (rentPay > 0) {
            const allocInsert = await tx.$queryRawUnsafe<Array<{ id: string; createdAt: Date }>>(
              `INSERT INTO ${allocations}
                 (payment_id, booking_id, allocation_type, amount, notes)
               VALUES
                 ($1::uuid, $2::uuid, 'RENT', $3, 'Advance rental payment')
               RETURNING id, created_at AS "createdAt"`,
              paymentId,
              bookingId,
              rentPay,
            );
            createdAllocations.push({
              id: allocInsert[0].id,
              paymentId,
              bookingId,
              allocationType: 'RENT',
              amount: rentPay,
              notes: 'Advance rental payment',
              createdAt: allocInsert[0].createdAt,
            });
          }

          if (depPay > 0) {
            const allocInsert = await tx.$queryRawUnsafe<Array<{ id: string; createdAt: Date }>>(
              `INSERT INTO ${allocations}
                 (payment_id, booking_id, allocation_type, amount, notes)
               VALUES
                 ($1::uuid, $2::uuid, 'SECURITY_DEPOSIT', $3, 'Security deposit collected at booking')
               RETURNING id, created_at AS "createdAt"`,
              paymentId,
              bookingId,
              depPay,
            );
            createdAllocations.push({
              id: allocInsert[0].id,
              paymentId,
              bookingId,
              allocationType: 'SECURITY_DEPOSIT',
              amount: depPay,
              notes: 'Security deposit collected at booking',
              createdAt: allocInsert[0].createdAt,
            });
          }

          advancePaymentRecord = {
            id: paymentId,
            branchId: dto.branchId,
            bookingId,
            bookingReference: bookingRef,
            paymentNumber,
            idempotencyKey: dto.advancePayment.idempotencyKey?.trim() || null,
            amount: totalPay,
            paymentMethod,
            referenceNumber: dto.advancePayment.referenceNumber?.trim() || null,
            notes: dto.advancePayment.notes?.trim() || null,
            receivedBy: userId,
            rentAmount: rentPay,
            depositAmount: depPay,
            allocations: createdAllocations,
            createdAt: payInsert[0].createdAt,
            updatedAt: payInsert[0].updatedAt,
          };
        }
      }

      // 11. Audit log
      await logAudit(tx, schemaName, {
        userId,
        action: 'RENTAL_BOOKING_CREATE',
        entityType: 'rental_booking',
        entityId: bookingId,
        details: {
          bookingReference: bookingRef,
          customerId: dto.customerId,
          customerName: customerRows[0].name,
          pickupDate: dto.pickupDate,
          returnDate: dto.returnDate,
          unitsCount: lockedUnits.length,
          unitCodes: lockedUnits.map((u) => u.unitCode),
          totalRent,
          totalDeposit,
          advancePayment: advancePaymentRecord ? {
            paymentNumber: advancePaymentRecord.paymentNumber,
            amount: advancePaymentRecord.amount,
            rentAmount: advancePaymentRecord.rentAmount,
            depositAmount: advancePaymentRecord.depositAmount,
          } : null,
        },
      });

      return {
        id: bookingId,
        bookingReference: bookingRef,
        status: 'RESERVED' as RentalBookingStatus,
        customerId: dto.customerId,
        customerName: customerRows[0].name,
        pickupDate: dto.pickupDate,
        returnDate: dto.returnDate,
        totalRent,
        totalDeposit,
        unitsCount: lockedUnits.length,
        items: lockedUnits.map((u) => ({
          rentalItemId: u.rentalItemId,
          itemName: u.itemName,
          itemCode: u.itemCode,
          rentalUnitId: u.id,
          unitCode: u.unitCode,
          unitNumber: u.unitNumber,
          rentPrice: u.rentPrice,
          deposit: u.deposit,
        })),
        payment: advancePaymentRecord,
        createdAt: bookingInsert[0].createdAt,
      };
    });
  }

  /**
   * List rental bookings with search, filters, pagination, and customer/item aggregations.
   */
  async listBookings(schemaName: string, query?: ListRentalBookingsQueryDto) {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const items = tenantTable(schemaName, 'rental_items');
    const units = tenantTable(schemaName, 'rental_units');
    const customers = tenantTable(schemaName, 'customers');
    const branches = tenantTable(schemaName, 'branches');

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (query?.branchId && query.branchId !== 'all') {
      conditions.push(`rb.branch_id = $${idx++}::uuid`);
      params.push(query.branchId);
    }

    if (query?.status && query.status !== 'all') {
      conditions.push(`rb.status::text = $${idx++}`);
      params.push(query.status.toUpperCase());
    }

    if (query?.startDate && query?.endDate) {
      conditions.push(`rb.pickup_date <= $${idx++}::date AND rb.return_date >= $${idx++}::date`);
      params.push(query.endDate, query.startDate);
    } else if (query?.startDate) {
      conditions.push(`rb.return_date >= $${idx++}::date`);
      params.push(query.startDate);
    } else if (query?.endDate) {
      conditions.push(`rb.pickup_date <= $${idx++}::date`);
      params.push(query.endDate);
    }

    if (query?.search?.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      conditions.push(
        `(LOWER(rb.booking_reference) LIKE $${idx} OR LOWER(c.name) LIKE $${idx} OR LOWER(COALESCE(c.phone, '')) LIKE $${idx} OR LOWER(COALESCE(c.code, '')) LIKE $${idx})`,
      );
      params.push(term);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const totalResult = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::bigint AS count
         FROM ${bookings} rb
         LEFT JOIN ${customers} c ON c.id = rb.customer_id
         ${whereClause}`,
        ...params,
      );
      const total = Number(totalResult[0]?.count ?? 0);

      const page = query?.page ? Number(query.page) : 1;
      const limit = query?.limit ? Number(query.limit) : 15;
      const { offset, page: safePage, limit: safeLimit } = resolvePagination(page, limit);

      const rows = await tx.$queryRawUnsafe<Array<any>>(
        `SELECT
            rb.id,
            rb.branch_id AS "branchId",
            b.name AS "branchName",
            rb.customer_id AS "customerId",
            c.name AS "customerName",
            c.phone AS "customerPhone",
            c.email AS "customerEmail",
            c.code AS "customerCode",
            rb.booking_reference AS "bookingReference",
            rb.pickup_date::text AS "pickupDate",
            rb.return_date::text AS "returnDate",
            rb.status::text AS status,
            rb.total_rent::float AS "totalRent",
            rb.total_deposit::float AS "totalDeposit",
            rb.notes,
            rb.cancelled_at AS "cancelledAt",
            rb.cancellation_reason AS "cancellationReason",
            rb.actual_pickup_at AS "actualPickupAt",
            rb.pickup_notes AS "pickupNotes",
            u_pick.name AS "pickedUpByName",
            rb.created_at AS "createdAt",
            rb.updated_at AS "updatedAt",
            COALESCE((SELECT COUNT(*)::int FROM ${bookingItems} rbi WHERE rbi.booking_id = rb.id), 0) AS "itemCount",
            COALESCE((
              SELECT SUM(rpa.amount)::float
              FROM "${schemaName}".rental_payment_allocations rpa
              WHERE rpa.booking_id = rb.id AND rpa.allocation_type = 'RENT'
            ), 0)::float AS "paidRent",
            COALESCE((
              SELECT SUM(rpa.amount)::float
              FROM "${schemaName}".rental_payment_allocations rpa
              WHERE rpa.booking_id = rb.id AND rpa.allocation_type = 'SECURITY_DEPOSIT'
            ), 0)::float AS "heldDeposit",
            COALESCE((
              SELECT json_agg(json_build_object(
                'itemId', ri.id,
                'itemName', ri.name,
                'itemCode', ri.code,
                'category', ri.category::text,
                'unitCode', ru.unit_code,
                'rentPrice', rbi.rent_price::float,
                'deposit', rbi.deposit::float
              ))
              FROM ${bookingItems} rbi
              JOIN ${items} ri ON ri.id = rbi.rental_item_id
              JOIN ${units} ru ON ru.id = rbi.rental_unit_id
              WHERE rbi.booking_id = rb.id
            ), '[]'::json) AS items
         FROM ${bookings} rb
         LEFT JOIN ${customers} c ON c.id = rb.customer_id
         LEFT JOIN ${branches} b ON b.id = rb.branch_id
         LEFT JOIN "${schemaName}".users u_pick ON u_pick.id = rb.picked_up_by_user_id
         ${whereClause}
         ORDER BY rb.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        ...params,
        safeLimit,
        offset,
      );

      const enrichedRows = rows.map((row) => ({
        ...row,
        financials: this.calculateBookingFinancials(row.totalRent, row.totalDeposit, [
          { allocationType: 'RENT', amount: row.paidRent || 0 },
          { allocationType: 'SECURITY_DEPOSIT', amount: row.heldDeposit || 0 },
        ]),
      }));

      return buildPaginatedResponse(enrichedRows, total, safePage, safeLimit);
    });
  }

  /**
   * Retrieve single booking details with full item/copy breakdowns and snapshots.
   */
  async getBooking(schemaName: string, id: string): Promise<RentalBookingRecord> {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const items = tenantTable(schemaName, 'rental_items');
    const units = tenantTable(schemaName, 'rental_units');
    const customers = tenantTable(schemaName, 'customers');
    const branches = tenantTable(schemaName, 'branches');
    const users = tenantTable(schemaName, 'users');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const rows = await tx.$queryRawUnsafe<Array<any>>(
        `SELECT
            rb.id,
            rb.branch_id AS "branchId",
            b.name AS "branchName",
            rb.customer_id AS "customerId",
            c.name AS "customerName",
            c.phone AS "customerPhone",
            c.email AS "customerEmail",
            c.code AS "customerCode",
            rb.booking_reference AS "bookingReference",
            rb.pickup_date::text AS "pickupDate",
            rb.return_date::text AS "returnDate",
            rb.status::text AS status,
            rb.total_rent::float AS "totalRent",
            rb.total_deposit::float AS "totalDeposit",
            rb.notes,
            rb.cancelled_at AS "cancelledAt",
            rb.cancellation_reason AS "cancellationReason",
            rb.cancelled_by AS "cancelledBy",
            uc.name AS "cancellerName",
            rb.created_by AS "createdBy",
            ub.name AS "creatorName",
            rb.actual_pickup_at AS "actualPickupAt",
            rb.picked_up_by_user_id AS "pickedUpByUserId",
            upick.name AS "pickedUpByName",
            rb.pickup_notes AS "pickupNotes",
            rb.created_at AS "createdAt",
            rb.updated_at AS "updatedAt"
         FROM ${bookings} rb
         LEFT JOIN ${customers} c ON c.id = rb.customer_id
         LEFT JOIN ${branches} b ON b.id = rb.branch_id
         LEFT JOIN ${users} ub ON ub.id = rb.created_by
         LEFT JOIN ${users} uc ON uc.id = rb.cancelled_by
         LEFT JOIN ${users} upick ON upick.id = rb.picked_up_by_user_id
         WHERE rb.id = $1::uuid
         LIMIT 1`,
        id,
      );

      if (rows.length === 0) {
        throw new NotFoundException('Rental booking not found');
      }

      const booking = rows[0];

      // Fetch booking items
      const itemRows = await tx.$queryRawUnsafe<Array<any>>(
        `SELECT
            rbi.id,
            rbi.booking_id AS "bookingId",
            rbi.rental_item_id AS "rentalItemId",
            ri.name AS "itemName",
            ri.code AS "itemCode",
            ri.category::text AS "itemCategory",
            rbi.rental_unit_id AS "rentalUnitId",
            ru.unit_code AS "unitCode",
            ru.unit_number AS "unitNumber",
            rbi.rent_price::float AS "rentPrice",
            rbi.deposit::float AS deposit,
            rbi.notes,
            rbi.created_at AS "createdAt"
         FROM ${bookingItems} rbi
         JOIN ${items} ri ON ri.id = rbi.rental_item_id
         JOIN ${units} ru ON ru.id = rbi.rental_unit_id
         WHERE rbi.booking_id = $1::uuid
         ORDER BY ri.name ASC, ru.unit_number ASC`,
        id,
      );

      const paymentsTable = tenantTable(schemaName, 'rental_payments');
      const allocationsTable = tenantTable(schemaName, 'rental_payment_allocations');

      const paymentRows = await tx.$queryRawUnsafe<Array<any>>(
        `SELECT
            rp.id,
            rp.branch_id AS "branchId",
            b.name AS "branchName",
            rp.booking_id AS "bookingId",
            rp.payment_number AS "paymentNumber",
            rp.idempotency_key AS "idempotencyKey",
            rp.amount::float AS amount,
            rp.payment_method::text AS "paymentMethod",
            rp.reference_number AS "referenceNumber",
            rp.notes,
            rp.received_by AS "receivedBy",
            u.name AS "receiverName",
            rp.created_at AS "createdAt",
            rp.updated_at AS "updatedAt",
            COALESCE((
              SELECT SUM(amount)::float FROM ${allocationsTable} rpa
              WHERE rpa.payment_id = rp.id AND rpa.allocation_type = 'RENT'
            ), 0)::float AS "rentAmount",
            COALESCE((
              SELECT SUM(amount)::float FROM ${allocationsTable} rpa
              WHERE rpa.payment_id = rp.id AND rpa.allocation_type = 'SECURITY_DEPOSIT'
            ), 0)::float AS "depositAmount",
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', rpa.id,
                'paymentId', rpa.payment_id,
                'bookingId', rpa.booking_id,
                'allocationType', rpa.allocation_type,
                'amount', rpa.amount::float,
                'notes', rpa.notes,
                'createdAt', rpa.created_at
              ))
              FROM ${allocationsTable} rpa
              WHERE rpa.payment_id = rp.id
            ), '[]'::json) AS allocations
         FROM ${paymentsTable} rp
         LEFT JOIN ${branches} b ON b.id = rp.branch_id
         LEFT JOIN ${users} u ON u.id = rp.received_by
         WHERE rp.booking_id = $1::uuid
         ORDER BY rp.created_at ASC`,
        id,
      );

      const allAllocRows = await tx.$queryRawUnsafe<Array<{ allocationType: string; amount: number }>>(
        `SELECT allocation_type AS "allocationType", amount::float AS amount
         FROM ${allocationsTable}
         WHERE booking_id = $1::uuid`,
        id,
      );

      const financials = this.calculateBookingFinancials(
        Number(booking.totalRent),
        Number(booking.totalDeposit),
        allAllocRows,
      );

      booking.items = itemRows;
      booking.itemCount = itemRows.length;
      booking.financials = financials;
      booking.payments = paymentRows;

      return booking;
    });
  }

  /**
   * Cancel an eligible RESERVED booking.
   * Cancelling immediately releases all date-based reservations for its copies.
   */
  async cancelBooking(
    schemaName: string,
    id: string,
    dto: CancelRentalBookingDto,
    userId: string,
  ) {
    const bookings = tenantTable(schemaName, 'rental_bookings');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      // Row lock the booking
      const existingRows = await tx.$queryRawUnsafe<
        Array<{ id: string; booking_reference: string; status: string; customer_id: string }>
      >(
        `SELECT id, booking_reference, status::text AS status, customer_id
         FROM ${bookings}
         WHERE id = $1::uuid
         LIMIT 1
         FOR UPDATE`,
        id,
      );

      if (existingRows.length === 0) {
        throw new NotFoundException('Rental booking not found');
      }

      const existing = existingRows[0];

      if (existing.status === 'CANCELLED') {
        throw new BadRequestException('This booking is already cancelled');
      }

      if (existing.status !== 'RESERVED') {
        throw new BadRequestException(
          `Cannot cancel booking ${existing.booking_reference} with status "${existing.status}". Only RESERVED bookings can be cancelled in this phase.`,
        );
      }

      await tx.$queryRawUnsafe(
        `UPDATE ${bookings}
         SET status = 'CANCELLED',
             cancelled_at = NOW(),
             cancelled_by = $2::uuid,
             cancellation_reason = $3,
             updated_at = NOW()
         WHERE id = $1::uuid`,
        id,
        userId,
        dto.reason?.trim() || null,
      );

      const units = tenantTable(schemaName, 'rental_units');
      const bookingItems = tenantTable(schemaName, 'rental_booking_items');
      await tx.$executeRawUnsafe(
        `UPDATE ${units}
         SET status = 'AVAILABLE', updated_at = NOW()
         WHERE id IN (
           SELECT rental_unit_id FROM ${bookingItems} WHERE booking_id = $1::uuid
         ) AND status = 'RESERVED'`,
        id,
      );

      await logAudit(tx, schemaName, {
        userId,
        action: 'RENTAL_BOOKING_CANCEL',
        entityType: 'rental_booking',
        entityId: id,
        details: {
          bookingReference: existing.booking_reference,
          customerId: existing.customer_id,
          reason: dto.reason?.trim() || 'Staff initiated cancellation',
        },
      });

      return {
        id,
        bookingReference: existing.booking_reference,
        status: 'CANCELLED' as RentalBookingStatus,
        success: true,
      };
    });
  }

  /**
   * Summary metrics for rental bookings (Total, Reserved, Cancelled, Revenue).
   */
  async getBookingSummary(schemaName: string, branchId?: string) {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (branchId && branchId !== 'all') {
      conditions.push(`branch_id = $1::uuid`);
      params.push(branchId);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const rows = await tx.$queryRawUnsafe<
        Array<{
          totalBookings: number;
          reservedBookings: number;
          pickedUpBookings: number;
          cancelledBookings: number;
          totalRentReserved: number;
          totalSecurityDepositHeld: number;
          totalCollectedRent: number;
        }>
      >(
        `SELECT
            COUNT(*)::int AS "totalBookings",
            COALESCE(COUNT(*) FILTER (WHERE status = 'RESERVED'), 0)::int AS "reservedBookings",
            COALESCE(COUNT(*) FILTER (WHERE status = 'PICKED_UP'), 0)::int AS "pickedUpBookings",
            COALESCE(COUNT(*) FILTER (WHERE status = 'CANCELLED'), 0)::int AS "cancelledBookings",
            COALESCE(SUM(total_rent) FILTER (WHERE status = 'RESERVED'), 0)::float AS "totalRentReserved",
            COALESCE((
              SELECT GREATEST(0,
                COALESCE(SUM(CASE WHEN rpa.allocation_type = 'SECURITY_DEPOSIT' THEN rpa.amount ELSE 0 END), 0)
                - COALESCE(SUM(CASE WHEN rpa.allocation_type IN ('DAMAGE_CHARGE', 'REFUND') THEN rpa.amount ELSE 0 END), 0)
                - COALESCE((
                    SELECT SUM(rf.amount)
                    FROM "${schemaName}".rental_refunds rf
                    JOIN ${bookings} rbf ON rbf.id = rf.booking_id
                    WHERE rbf.status IN ('RESERVED', 'PICKED_UP', 'PARTIALLY_RETURNED')
                      ${branchId && branchId !== 'all' ? `AND rbf.branch_id = '${branchId}'::uuid` : ''}
                  ), 0)
              )::float
              FROM "${schemaName}".rental_payment_allocations rpa
              JOIN ${bookings} rb2 ON rb2.id = rpa.booking_id
              WHERE rb2.status IN ('RESERVED', 'PICKED_UP', 'PARTIALLY_RETURNED')
                ${branchId && branchId !== 'all' ? `AND rb2.branch_id = '${branchId}'::uuid` : ''}
            ), 0)::float AS "totalSecurityDepositHeld",
            COALESCE((
              SELECT SUM(rpa.amount)::float
              FROM "${schemaName}".rental_payment_allocations rpa
              JOIN ${bookings} rb3 ON rb3.id = rpa.booking_id
              WHERE rpa.allocation_type = 'RENT'
                ${branchId && branchId !== 'all' ? `AND rb3.branch_id = '${branchId}'::uuid` : ''}
            ), 0)::float AS "totalCollectedRent"
         FROM ${bookings}
         ${where}`,
        ...params,
      );

      const r = rows[0] || {
        totalBookings: 0,
        reservedBookings: 0,
        pickedUpBookings: 0,
        cancelledBookings: 0,
        totalRentReserved: 0,
        totalSecurityDepositHeld: 0,
        totalCollectedRent: 0,
      };

      return {
        ...r,
        // Backward-compatible alias for the Security Deposit Held KPI (Part A #11)
        totalDepositReserved: r.totalSecurityDepositHeld ?? 0,
      };
    });
  }


  // =========================================================================
  // PHASE 3: RENTAL PAYMENTS & PICKUP / HANDOVER IMPLEMENTATION
  // =========================================================================

  /**
   * Collect a rental payment transaction with allocation to Rent and/or Refundable Security Deposit.
   * Atomically locks the booking, validates remaining balance and required deposit,
   * generates sequential payment code (RPAY-0001), prevents duplicates via idempotency keys,
   * and records an audit log.
   */
  async collectPayment(
    schemaName: string,
    dto: CreateRentalPaymentDto,
    userId: string,
  ): Promise<RentalPaymentRecord> {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const payments = tenantTable(schemaName, 'rental_payments');
    const allocations = tenantTable(schemaName, 'rental_payment_allocations');
    const customers = tenantTable(schemaName, 'customers');
    const branches = tenantTable(schemaName, 'branches');

    const paymentAmount = this.round2(dto.amount);
    if (paymentAmount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    // 1. Idempotency Check: if idempotency key is passed, check if already recorded
    if (dto.idempotencyKey?.trim()) {
      const existing = await this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
        return tx.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM ${payments} WHERE idempotency_key = $1 LIMIT 1`,
          dto.idempotencyKey!.trim(),
        );
      });
      if (existing.length > 0) {
        return this.getPayment(schemaName, existing[0].id);
      }
    }

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      // 2. Lock booking row
      const bookingRows = await tx.$queryRawUnsafe<Array<any>>(
        `SELECT
            rb.id,
            rb.branch_id AS "branchId",
            b.name AS "branchName",
            rb.customer_id AS "customerId",
            c.name AS "customerName",
            c.phone AS "customerPhone",
            c.email AS "customerEmail",
            c.code AS "customerCode",
            rb.booking_reference AS "bookingReference",
            rb.status::text AS status,
            rb.settlement_status::text AS "settlementStatus",
            rb.total_rent::float AS "totalRent",
            rb.total_deposit::float AS "totalDeposit"
         FROM ${bookings} rb
         JOIN ${branches} b ON b.id = rb.branch_id
         JOIN ${customers} c ON c.id = rb.customer_id
         WHERE rb.id = $1::uuid
         FOR UPDATE`,
        dto.bookingId,
      );

      if (bookingRows.length === 0) {
        throw new NotFoundException('Rental booking not found');
      }

      const booking = bookingRows[0];

      if (booking.status === 'CANCELLED') {
        throw new BadRequestException('Cannot collect payment for a cancelled rental booking');
      }
      if (booking.status === 'RETURNED' && booking.settlementStatus === 'SETTLED') {
        throw new BadRequestException('Cannot collect payment for a booking that has already been returned and settled');
      }

      // 3. Query existing allocations under lock
      const allocRows = await tx.$queryRawUnsafe<Array<{ allocationType: string; totalAmount: number }>>(
        `SELECT allocation_type AS "allocationType", COALESCE(SUM(amount), 0)::float AS "totalAmount"
         FROM ${allocations}
         WHERE booking_id = $1::uuid
         GROUP BY allocation_type`,
        dto.bookingId,
      );

      let alreadyPaidRent = 0;
      let alreadyHeldDeposit = 0;
      for (const r of allocRows) {
        if (r.allocationType === 'RENT') alreadyPaidRent = this.round2(r.totalAmount);
        if (r.allocationType === 'SECURITY_DEPOSIT') alreadyHeldDeposit = this.round2(r.totalAmount);
      }

      const totalRent = this.round2(booking.totalRent);
      const totalDeposit = this.round2(booking.totalDeposit);
      const remainingRent = Math.max(0, this.round2(totalRent - alreadyPaidRent));
      const remainingDeposit = Math.max(0, this.round2(totalDeposit - alreadyHeldDeposit));

      if (remainingRent <= 0 && remainingDeposit <= 0) {
        throw new BadRequestException(
          booking.status === 'RETURNED'
            ? 'Cannot collect payment for a booking that has already been returned and settled'
            : 'This rental booking has no outstanding rental balance or deposit to collect',
        );
      }


      let rentAmount = dto.rentAmount !== undefined ? this.round2(dto.rentAmount) : 0;
      let depositAmount = dto.depositAmount !== undefined ? this.round2(dto.depositAmount) : 0;

      // Auto-allocation if neither was explicitly split
      if (dto.rentAmount === undefined && dto.depositAmount === undefined) {
        const payToRent = Math.min(paymentAmount, remainingRent);
        rentAmount = this.round2(payToRent);
        const remainingToPay = this.round2(paymentAmount - rentAmount);
        depositAmount = Math.min(remainingToPay, remainingDeposit);
      }

      const allocatedTotal = this.round2(rentAmount + depositAmount);
      if (Math.abs(allocatedTotal - paymentAmount) > 0.01) {
        throw new BadRequestException(
          `Total payment amount (LKR ${paymentAmount.toFixed(2)}) must exactly equal the sum of rent allocation (LKR ${rentAmount.toFixed(2)}) and security deposit allocation (LKR ${depositAmount.toFixed(2)})`,
        );
      }

      if (rentAmount > remainingRent + 0.001) {
        throw new BadRequestException(
          `Rent allocation of LKR ${rentAmount.toFixed(2)} exceeds the remaining rental balance of LKR ${remainingRent.toFixed(2)}`,
        );
      }

      if (depositAmount > remainingDeposit + 0.001) {
        throw new BadRequestException(
          `Security deposit allocation of LKR ${depositAmount.toFixed(2)} exceeds the remaining required deposit of LKR ${remainingDeposit.toFixed(2)}`,
        );
      }

      if (rentAmount <= 0 && depositAmount <= 0) {
        throw new BadRequestException('Payment must allocate a positive amount to either rent charge or security deposit');
      }

      // 4. Generate sequential payment number (e.g. RPAY-0001)
      const paymentNumber = await this.generateNextPaymentNumber(tx, schemaName, payments);

      // 5. Insert payment header
      const payInsert = await tx.$queryRawUnsafe<Array<{ id: string; createdAt: Date; updatedAt: Date }>>(
        `INSERT INTO ${payments}
           (branch_id, booking_id, payment_number, idempotency_key, amount, payment_method, reference_number, notes, received_by)
         VALUES
           ($1::uuid, $2::uuid, $3, $4, $5, $6::text::"${schemaName}".payment_method, $7, $8, $9::uuid)
         RETURNING id, created_at AS "createdAt", updated_at AS "updatedAt"`,
        booking.branchId,
        dto.bookingId,
        paymentNumber,
        dto.idempotencyKey?.trim() || null,
        paymentAmount,
        dto.paymentMethod,
        dto.referenceNumber?.trim() || null,
        dto.notes?.trim() || null,
        userId,
      );

      const paymentId = payInsert[0].id;

      // 6. Insert allocations
      const createdAllocations: RentalPaymentAllocationRecord[] = [];

      if (rentAmount > 0) {
        const a = await tx.$queryRawUnsafe<Array<{ id: string; createdAt: Date }>>(
          `INSERT INTO ${allocations}
             (payment_id, booking_id, allocation_type, amount, notes)
           VALUES
             ($1::uuid, $2::uuid, 'RENT', $3, $4)
           RETURNING id, created_at AS "createdAt"`,
          paymentId,
          dto.bookingId,
          rentAmount,
          'Rental fee payment',
        );
        createdAllocations.push({
          id: a[0].id,
          paymentId,
          bookingId: dto.bookingId,
          allocationType: 'RENT',
          amount: rentAmount,
          notes: 'Rental fee payment',
          createdAt: a[0].createdAt,
        });
      }

      if (depositAmount > 0) {
        const a = await tx.$queryRawUnsafe<Array<{ id: string; createdAt: Date }>>(
          `INSERT INTO ${allocations}
             (payment_id, booking_id, allocation_type, amount, notes)
           VALUES
             ($1::uuid, $2::uuid, 'SECURITY_DEPOSIT', $3, $4)
           RETURNING id, created_at AS "createdAt"`,
          paymentId,
          dto.bookingId,
          depositAmount,
          'Refundable security deposit collection',
        );
        createdAllocations.push({
          id: a[0].id,
          paymentId,
          bookingId: dto.bookingId,
          allocationType: 'SECURITY_DEPOSIT',
          amount: depositAmount,
          notes: 'Refundable security deposit collection',
          createdAt: a[0].createdAt,
        });
      }

      // If booking is returned and rent is now fully paid:
      // If total deposit was 0 (or already settled) and no accrued fees, automatically settle the booking
      if (booking.status === 'RETURNED') {
        const newRemainingRent = Math.max(0, this.round2(remainingRent - rentAmount));
        if (newRemainingRent <= 0.001 && totalDeposit <= 0.001) {
          await tx.$executeRawUnsafe(
            `UPDATE ${bookings}
             SET settlement_status = 'SETTLED', updated_at = NOW()
             WHERE id = $1::uuid`,
            dto.bookingId,
          );
        }
      }

      // 7. Audit log
      await logAudit(tx, schemaName, {
        userId,
        action: 'RENTAL_PAYMENT_COLLECTED',
        entityType: 'rental_payment',
        entityId: paymentId,
        details: {
          paymentNumber,
          bookingReference: booking.bookingReference,
          customerId: booking.customerId,
          customerName: booking.customerName,
          totalAmount: paymentAmount,
          rentAmount,
          depositAmount,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber,
        },
      });

      return {
        id: paymentId,
        branchId: booking.branchId,
        branchName: booking.branchName,
        bookingId: dto.bookingId,
        bookingReference: booking.bookingReference,
        customerId: booking.customerId,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        customerEmail: booking.customerEmail,
        customerCode: booking.customerCode,
        paymentNumber,
        idempotencyKey: dto.idempotencyKey?.trim() || null,
        amount: paymentAmount,
        paymentMethod: dto.paymentMethod,
        referenceNumber: dto.referenceNumber?.trim() || null,
        notes: dto.notes?.trim() || null,
        receivedBy: userId,
        rentAmount,
        depositAmount,
        allocations: createdAllocations,
        createdAt: payInsert[0].createdAt,
        updatedAt: payInsert[0].updatedAt,
      };
    });
  }

  /**
   * Confirm item handover / pickup for a RESERVED booking.
   * Validates eligibility, dates, payment and deposit policies,
   * locks booking and physical units in a single database transaction,
   * updates booking status to PICKED_UP, updates physical units to RENTED,
   * and records audit history.
   */
  async confirmPickup(
    schemaName: string,
    bookingId: string,
    dto: ConfirmRentalPickupDto,
    userId: string,
  ): Promise<RentalBookingRecord> {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const units = tenantTable(schemaName, 'rental_units');
    const allocations = tenantTable(schemaName, 'rental_payment_allocations');
    const payments = tenantTable(schemaName, 'rental_payments');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      // 1. Lock booking row
      const bookingRows = await tx.$queryRawUnsafe<Array<any>>(
        `SELECT
            rb.id,
            rb.branch_id AS "branchId",
            rb.booking_reference AS "bookingReference",
            rb.pickup_date::text AS "pickupDate",
            rb.return_date::text AS "returnDate",
            rb.status::text AS status,
            rb.total_rent::float AS "totalRent",
            rb.total_deposit::float AS "totalDeposit",
            rb.actual_pickup_at AS "actualPickupAt"
         FROM ${bookings} rb
         WHERE rb.id = $1::uuid
         FOR UPDATE`,
        bookingId,
      );

      if (bookingRows.length === 0) {
        throw new NotFoundException('Rental booking not found');
      }

      const booking = bookingRows[0];

      // Eligibility validations
      if (booking.status === 'PICKED_UP') {
        throw new ConflictException(
          `This booking has already been picked up (handover recorded on ${booking.actualPickupAt || 'earlier date'}).`,
        );
      }
      if (booking.status !== 'RESERVED') {
        throw new BadRequestException(
          `Only bookings in RESERVED status can be picked up. Current status is ${booking.status}.`,
        );
      }

      // 2. Validate actual pickup date against booking dates
      const actualPickupDate = dto.actualPickupDate || new Date().toISOString().split('T')[0];
      if (actualPickupDate > booking.returnDate) {
        throw new BadRequestException(
          `Actual pickup date (${actualPickupDate}) cannot be later than the scheduled return date (${booking.returnDate}).`,
        );
      }

      // 3. Payment & security deposit policy validation
      const allocRows = await tx.$queryRawUnsafe<Array<{ allocationType: string; totalAmount: number }>>(
        `SELECT allocation_type AS "allocationType", COALESCE(SUM(amount), 0)::float AS "totalAmount"
         FROM ${allocations}
         WHERE booking_id = $1::uuid
         GROUP BY allocation_type`,
        bookingId,
      );

      let paidRent = 0;
      let heldDeposit = 0;
      for (const r of allocRows) {
        if (r.allocationType === 'RENT') paidRent = this.round2(r.totalAmount);
        if (r.allocationType === 'SECURITY_DEPOSIT') heldDeposit = this.round2(r.totalAmount);
      }

      const totalRent = this.round2(booking.totalRent);
      const totalDeposit = this.round2(booking.totalDeposit);
      let remainingDeposit = Math.max(0, this.round2(totalDeposit - heldDeposit));
      let remainingRent = Math.max(0, this.round2(totalRent - paidRent));

      // Optional: Process payment provided directly in pickup request (pay balance & pickup atomically)
      if (dto.payment && dto.payment.amount && dto.payment.amount > 0) {
        const payAmount = this.round2(dto.payment.amount);
        const payToRent = Math.min(payAmount, remainingRent);
        const rentAlloc = this.round2(payToRent);
        const remToPay = this.round2(payAmount - rentAlloc);
        const depAlloc = Math.min(remToPay, remainingDeposit);

        const paymentNumber = await this.generateNextPaymentNumber(tx, schemaName, payments);

        const payInsert = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `INSERT INTO ${payments}
             (branch_id, booking_id, payment_number, amount, payment_method, reference_number, notes, received_by)
           VALUES
             ($1::uuid, $2::uuid, $3, $4, $5::text::"${schemaName}".payment_method, $6, $7, $8::uuid)
           RETURNING id`,
          booking.branchId,
          bookingId,
          paymentNumber,
          payAmount,
          dto.payment.paymentMethod || 'CASH',
          dto.payment.referenceNumber?.trim() || null,
          dto.payment.notes?.trim() || 'Paid upon pickup/handover',
          userId,
        );

        const paymentId = payInsert[0].id;

        if (rentAlloc > 0) {
          await tx.$queryRawUnsafe(
            `INSERT INTO ${allocations} (payment_id, booking_id, allocation_type, amount)
             VALUES ($1::uuid, $2::uuid, 'RENT', $3)`,
            paymentId,
            bookingId,
            rentAlloc,
          );
          paidRent = this.round2(paidRent + rentAlloc);
          remainingRent = Math.max(0, this.round2(totalRent - paidRent));
        }

        if (depAlloc > 0) {
          await tx.$queryRawUnsafe(
            `INSERT INTO ${allocations} (payment_id, booking_id, allocation_type, amount)
             VALUES ($1::uuid, $2::uuid, 'SECURITY_DEPOSIT', $3)`,
            paymentId,
            bookingId,
            depAlloc,
          );
          heldDeposit = this.round2(heldDeposit + depAlloc);
          remainingDeposit = Math.max(0, this.round2(totalDeposit - heldDeposit));
        }

        await logAudit(tx, schemaName, {
          userId,
          action: 'CREATE_RENTAL_PAYMENT',
          entityType: 'rental_payment',
          entityId: paymentId,
          details: {
            paymentNumber,
            amount: payAmount,
            rentAllocation: rentAlloc,
            depositAllocation: depAlloc,
            paymentMethod: dto.payment.paymentMethod || 'CASH',
            collectedAtPickup: true,
          },
        });
      }

      if (remainingDeposit > 0 && !dto.allowPendingDeposit) {
        throw new BadRequestException(
          `Cannot confirm pickup: Refundable security deposit has not been fully collected. Required deposit is LKR ${totalDeposit.toFixed(2)}, currently held is LKR ${heldDeposit.toFixed(2)} (deficit: LKR ${remainingDeposit.toFixed(2)}). Please collect the security deposit first or confirm handover with pending deposit.`,
        );
      }

      // Note: Requirement 4 — Removed hardcoded requirement for 100% rental payment before pickup.
      // Customer pickup is allowed with partial advance payment (Scenario 1) or no advance (Scenario 4).
      // Outstanding balance is tracked and can be collected during the rental period or upon return.

      // 4. Lock booking items and physical units in deterministic order
      const itemRows = await tx.$queryRawUnsafe<Array<{ id: string; rentalUnitId: string }>>(
        `SELECT id, rental_unit_id AS "rentalUnitId"
         FROM ${bookingItems}
         WHERE booking_id = $1::uuid
         ORDER BY rental_unit_id ASC`,
        bookingId,
      );

      if (itemRows.length === 0) {
        throw new BadRequestException('This booking has no physical items assigned.');
      }

      const unitIds = itemRows.map((r) => r.rentalUnitId).sort();

      const lockedUnits = await tx.$queryRawUnsafe<Array<{ id: string; unitCode: string; status: string }>>(
        `SELECT id, unit_code AS "unitCode", status::text AS status
         FROM ${units}
         WHERE id = ANY($1::uuid[])
         ORDER BY id ASC
         FOR UPDATE`,
        unitIds,
      );

      for (const u of lockedUnits) {
        if (u.status === 'RENTED') {
          throw new ConflictException(
            `Physical copy ${u.unitCode} is already marked as RENTED in another active handover.`,
          );
        }
        if (u.status === 'MAINTENANCE' || u.status === 'INACTIVE' || u.status === 'CLEANING') {
          throw new ConflictException(
            `Physical copy ${u.unitCode} is currently in ${u.status.toLowerCase()} status and cannot be handed over.`,
          );
        }
      }

      // 5. Update booking status to PICKED_UP
      await tx.$executeRawUnsafe(
        `UPDATE ${bookings}
         SET status = 'PICKED_UP',
             actual_pickup_at = NOW(),
             picked_up_by_user_id = $1::uuid,
             pickup_notes = $2,
             updated_at = NOW()
         WHERE id = $3::uuid`,
        userId,
        dto.pickupNotes?.trim() || null,
        bookingId,
      );

      // 6. Update booking items with handover timestamp and condition notes
      await tx.$executeRawUnsafe(
        `UPDATE ${bookingItems}
         SET handed_over_at = NOW(),
             handed_over_by = $1::uuid,
             condition_out = $2,
             updated_at = NOW()
         WHERE booking_id = $3::uuid`,
        userId,
        dto.conditionOut?.trim() || dto.pickupNotes?.trim() || null,
        bookingId,
      );

      // 7. Update physical units to RENTED
      await tx.$executeRawUnsafe(
        `UPDATE ${units}
         SET status = 'RENTED',
             updated_at = NOW()
         WHERE id = ANY($1::uuid[])`,
        unitIds,
      );

      // 8. Audit log
      await logAudit(tx, schemaName, {
        userId,
        action: 'RENTAL_BOOKING_PICKED_UP',
        entityType: 'rental_booking',
        entityId: bookingId,
        details: {
          bookingReference: booking.bookingReference,
          actualPickupDate,
          unitsCount: unitIds.length,
          notes: dto.pickupNotes,
        },
      });

      return this.getBooking(schemaName, bookingId);
    });
  }

  /**
   * List paginated rental payment transactions.
   */
  async listPayments(schemaName: string, query?: ListRentalPaymentsQueryDto) {
    const payments = tenantTable(schemaName, 'rental_payments');
    const allocations = tenantTable(schemaName, 'rental_payment_allocations');
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const customers = tenantTable(schemaName, 'customers');
    const branches = tenantTable(schemaName, 'branches');
    const users = tenantTable(schemaName, 'users');

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (query?.bookingId) {
      conditions.push(`rp.booking_id = $${idx++}::uuid`);
      params.push(query.bookingId);
    }
    if (query?.branchId && query.branchId !== 'all') {
      conditions.push(`rp.branch_id = $${idx++}::uuid`);
      params.push(query.branchId);
    }
    if (query?.paymentMethod && query.paymentMethod !== 'all') {
      conditions.push(`rp.payment_method::text = $${idx++}`);
      params.push(query.paymentMethod);
    }
    if (query?.startDate) {
      conditions.push(`rp.created_at >= $${idx++}::date`);
      params.push(query.startDate);
    }
    if (query?.endDate) {
      conditions.push(`rp.created_at <= ($${idx++}::date + interval '1 day')`);
      params.push(query.endDate);
    }
    if (query?.search?.trim()) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      conditions.push(`(
        LOWER(rp.payment_number) LIKE $${idx} OR
        LOWER(rb.booking_reference) LIKE $${idx} OR
        LOWER(c.name) LIKE $${idx} OR
        LOWER(COALESCE(c.phone, '')) LIKE $${idx} OR
        LOWER(COALESCE(rp.reference_number, '')) LIKE $${idx}
      )`);
      params.push(term);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const totalResult = await tx.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::bigint AS count
         FROM ${payments} rp
         JOIN ${bookings} rb ON rb.id = rp.booking_id
         LEFT JOIN ${customers} c ON c.id = rb.customer_id
         ${whereClause}`,
        ...params,
      );
      const total = Number(totalResult[0]?.count ?? 0);

      const page = query?.page ? Number(query.page) : 1;
      const limit = query?.limit ? Number(query.limit) : 15;
      const { offset, page: safePage, limit: safeLimit } = resolvePagination(page, limit);

      const rows = await tx.$queryRawUnsafe<Array<any>>(
        `SELECT
            rp.id,
            rp.branch_id AS "branchId",
            b.name AS "branchName",
            rp.booking_id AS "bookingId",
            rb.booking_reference AS "bookingReference",
            rb.customer_id AS "customerId",
            c.name AS "customerName",
            c.phone AS "customerPhone",
            c.code AS "customerCode",
            rp.payment_number AS "paymentNumber",
            rp.idempotency_key AS "idempotencyKey",
            rp.amount::float AS amount,
            rp.payment_method::text AS "paymentMethod",
            rp.reference_number AS "referenceNumber",
            rp.notes,
            rp.received_by AS "receivedBy",
            u.name AS "receiverName",
            rp.created_at AS "createdAt",
            rp.updated_at AS "updatedAt",
            COALESCE((
              SELECT SUM(amount)::float FROM ${allocations} rpa
              WHERE rpa.payment_id = rp.id AND rpa.allocation_type = 'RENT'
            ), 0)::float AS "rentAmount",
            COALESCE((
              SELECT SUM(amount)::float FROM ${allocations} rpa
              WHERE rpa.payment_id = rp.id AND rpa.allocation_type = 'SECURITY_DEPOSIT'
            ), 0)::float AS "depositAmount"
         FROM ${payments} rp
         JOIN ${bookings} rb ON rb.id = rp.booking_id
         LEFT JOIN ${customers} c ON c.id = rb.customer_id
         LEFT JOIN ${branches} b ON b.id = rp.branch_id
         LEFT JOIN ${users} u ON u.id = rp.received_by
         ${whereClause}
         ORDER BY rp.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        ...params,
        safeLimit,
        offset,
      );

      return buildPaginatedResponse(rows, total, safePage, safeLimit);
    });
  }

  /**
   * Retrieve a single payment with booking, customer, and receipt details.
   */
  async getPayment(
    schemaName: string,
    id: string,
  ): Promise<RentalPaymentRecord & { booking?: any; branch?: any }> {
    const payments = tenantTable(schemaName, 'rental_payments');
    const allocations = tenantTable(schemaName, 'rental_payment_allocations');
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const customers = tenantTable(schemaName, 'customers');
    const branches = tenantTable(schemaName, 'branches');
    const users = tenantTable(schemaName, 'users');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const items = tenantTable(schemaName, 'rental_items');
    const units = tenantTable(schemaName, 'rental_units');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const rows = await tx.$queryRawUnsafe<Array<any>>(
        `SELECT
            rp.id,
            rp.branch_id AS "branchId",
            b.name AS "branchName",
            b.phone AS "branchPhone",
            b.address AS "branchAddress",
            rp.booking_id AS "bookingId",
            rb.booking_reference AS "bookingReference",
            rb.pickup_date::text AS "pickupDate",
            rb.return_date::text AS "returnDate",
            rb.total_rent::float AS "bookingTotalRent",
            rb.total_deposit::float AS "bookingTotalDeposit",
            rb.status::text AS "bookingStatus",
            rb.customer_id AS "customerId",
            c.name AS "customerName",
            c.phone AS "customerPhone",
            c.email AS "customerEmail",
            c.code AS "customerCode",
            rp.payment_number AS "paymentNumber",
            rp.idempotency_key AS "idempotencyKey",
            rp.amount::float AS amount,
            rp.payment_method::text AS "paymentMethod",
            rp.reference_number AS "referenceNumber",
            rp.notes,
            rp.received_by AS "receivedBy",
            u.name AS "receiverName",
            rp.created_at AS "createdAt",
            rp.updated_at AS "updatedAt",
            COALESCE((
              SELECT SUM(amount)::float FROM ${allocations} rpa
              WHERE rpa.payment_id = rp.id AND rpa.allocation_type = 'RENT'
            ), 0)::float AS "rentAmount",
            COALESCE((
              SELECT SUM(amount)::float FROM ${allocations} rpa
              WHERE rpa.payment_id = rp.id AND rpa.allocation_type = 'SECURITY_DEPOSIT'
            ), 0)::float AS "depositAmount",
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', rpa.id,
                'paymentId', rpa.payment_id,
                'bookingId', rpa.booking_id,
                'allocationType', rpa.allocation_type,
                'amount', rpa.amount::float,
                'notes', rpa.notes,
                'createdAt', rpa.created_at
              ))
              FROM ${allocations} rpa
              WHERE rpa.payment_id = rp.id
            ), '[]'::json) AS allocations
         FROM ${payments} rp
         JOIN ${bookings} rb ON rb.id = rp.booking_id
         LEFT JOIN ${customers} c ON c.id = rb.customer_id
         LEFT JOIN ${branches} b ON b.id = rp.branch_id
         LEFT JOIN ${users} u ON u.id = rp.received_by
         WHERE rp.id = $1::uuid
         LIMIT 1`,
        id,
      );

      if (rows.length === 0) {
        throw new NotFoundException('Rental payment not found');
      }

      const pay = rows[0];

      // Fetch booking items for receipt
      const itemRows = await tx.$queryRawUnsafe<Array<any>>(
        `SELECT
            rbi.id,
            ri.name AS "itemName",
            ri.code AS "itemCode",
            ri.category::text AS category,
            ru.unit_code AS "unitCode",
            rbi.rent_price::float AS "rentPrice",
            rbi.deposit::float AS deposit
         FROM ${bookingItems} rbi
         JOIN ${items} ri ON ri.id = rbi.rental_item_id
         JOIN ${units} ru ON ru.id = rbi.rental_unit_id
         WHERE rbi.booking_id = $1::uuid
         ORDER BY rbi.created_at ASC`,
        pay.bookingId,
      );

      // Financials breakdown
      const allAllocRows = await tx.$queryRawUnsafe<Array<{ allocationType: string; amount: number }>>(
        `SELECT allocation_type AS "allocationType", amount::float AS amount
         FROM ${allocations}
         WHERE booking_id = $1::uuid`,
        pay.bookingId,
      );

      const financials = this.calculateBookingFinancials(
        pay.bookingTotalRent,
        pay.bookingTotalDeposit,
        allAllocRows,
      );

      return {
        ...pay,
        booking: {
          id: pay.bookingId,
          reference: pay.bookingReference,
          pickupDate: pay.pickupDate,
          returnDate: pay.returnDate,
          status: pay.bookingStatus,
          totalRent: pay.bookingTotalRent,
          totalDeposit: pay.bookingTotalDeposit,
          financials,
          items: itemRows,
        },
        branch: {
          id: pay.branchId,
          name: pay.branchName,
          phone: pay.branchPhone,
          address: pay.branchAddress,
        },
      };
    });
  }

  /**
   * Financial KPIs for Rental Payments.
   */
  async getPaymentsSummary(schemaName: string, branchId?: string) {
    const payments = tenantTable(schemaName, 'rental_payments');
    const allocations = tenantTable(schemaName, 'rental_payment_allocations');
    const bookings = tenantTable(schemaName, 'rental_bookings');

    const branchFilter = branchId && branchId !== 'all' ? `AND rp.branch_id = '${branchId}'::uuid` : '';

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const summaryRows = await tx.$queryRawUnsafe<Array<any>>(
        `SELECT
            COUNT(rp.id)::int AS "totalTransactions",
            COALESCE(SUM(rp.amount), 0)::float AS "totalAmountCollected",
            COALESCE((
              SELECT SUM(rpa.amount)
              FROM ${allocations} rpa
              JOIN ${payments} rp2 ON rp2.id = rpa.payment_id
              WHERE rpa.allocation_type = 'RENT'
                ${branchId && branchId !== 'all' ? `AND rp2.branch_id = '${branchId}'::uuid` : ''}
            ), 0)::float AS "totalCollectedRent",
            COALESCE((
              SELECT GREATEST(0,
                COALESCE(SUM(CASE WHEN rpa.allocation_type = 'SECURITY_DEPOSIT' THEN rpa.amount ELSE 0 END), 0)
                - COALESCE(SUM(CASE WHEN rpa.allocation_type IN ('DAMAGE_CHARGE', 'REFUND') THEN rpa.amount ELSE 0 END), 0)
                - COALESCE((
                    SELECT SUM(rf.amount)
                    FROM "${schemaName}".rental_refunds rf
                    JOIN ${bookings} rb_ref ON rb_ref.id = rf.booking_id
                    WHERE rb_ref.status IN ('RESERVED', 'PICKED_UP', 'PARTIALLY_RETURNED')
                      ${branchId && branchId !== 'all' ? `AND rf.branch_id = '${branchId}'::uuid` : ''}
                  ), 0)
              )::float
              FROM ${allocations} rpa
              JOIN ${payments} rp2 ON rp2.id = rpa.payment_id
              JOIN ${bookings} rb ON rb.id = rpa.booking_id
              WHERE rb.status IN ('RESERVED', 'PICKED_UP', 'PARTIALLY_RETURNED')
                ${branchId && branchId !== 'all' ? `AND rp2.branch_id = '${branchId}'::uuid` : ''}
            ), 0)::float AS "totalSecurityDepositHeld"
         FROM ${payments} rp
         WHERE 1=1 ${branchFilter}`,
      );

      return (
        summaryRows[0] || {
          totalTransactions: 0,
          totalAmountCollected: 0,
          totalCollectedRent: 0,
          totalSecurityDepositHeld: 0,
        }
      );
    });
  }

  // ==========================================
  // PHASE 4: RENTAL RETURNS, INSPECTION & SETTLEMENT
  // ==========================================

  private async generateNextReturnNumber(
    tx: Prisma.TransactionClient,
    schemaName: string,
    returnsTable: string,
  ): Promise<string> {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext('rental_returns_seq_' || $1))`,
      schemaName,
    );

    let candidateCode = '';
    let isUnique = false;

    while (!isUnique) {
      const seqRows = await tx.$queryRawUnsafe<Array<{ seq: string | number }>>(
        `SELECT nextval('"${schemaName}".rental_return_code_seq') AS seq`,
      );
      const seqNum = Number(seqRows[0]?.seq ?? 1);
      candidateCode = `RRET-${String(seqNum).padStart(4, '0')}`;

      const existing = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM ${returnsTable} WHERE return_number = $1 LIMIT 1`,
        candidateCode,
      );

      if (existing.length === 0) {
        isUnique = true;
      }
    }

    return candidateCode;
  }

  private async generateNextSettlementNumber(
    tx: Prisma.TransactionClient,
    schemaName: string,
    settlementsTable: string,
  ): Promise<string> {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext('rental_settlements_seq_' || $1))`,
      schemaName,
    );

    let candidateCode = '';
    let isUnique = false;

    while (!isUnique) {
      const seqRows = await tx.$queryRawUnsafe<Array<{ seq: string | number }>>(
        `SELECT nextval('"${schemaName}".rental_settlement_code_seq') AS seq`,
      );
      const seqNum = Number(seqRows[0]?.seq ?? 1);
      candidateCode = `RSET-${String(seqNum).padStart(4, '0')}`;

      const existing = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM ${settlementsTable} WHERE settlement_number = $1 LIMIT 1`,
        candidateCode,
      );

      if (existing.length === 0) {
        isUnique = true;
      }
    }

    return candidateCode;
  }

  private async generateNextRefundNumber(
    tx: Prisma.TransactionClient,
    schemaName: string,
    refundsTable: string,
  ): Promise<string> {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext('rental_refunds_seq_' || $1))`,
      schemaName,
    );

    let candidateCode = '';
    let isUnique = false;

    while (!isUnique) {
      const seqRows = await tx.$queryRawUnsafe<Array<{ seq: string | number }>>(
        `SELECT nextval('"${schemaName}".rental_refund_code_seq') AS seq`,
      );
      const seqNum = Number(seqRows[0]?.seq ?? 1);
      candidateCode = `RREF-${String(seqNum).padStart(4, '0')}`;

      const existing = await tx.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM ${refundsTable} WHERE refund_number = $1 LIMIT 1`,
        candidateCode,
      );

      if (existing.length === 0) {
        isUnique = true;
      }
    }

    return candidateCode;
  }

  async listPendingReturns(schemaName: string, query?: ListPendingReturnsQueryDto) {
    const { page, limit, offset } = resolvePagination(query?.page, query?.limit);

    const bookings = tenantTable(schemaName, 'rental_bookings');
    const customers = tenantTable(schemaName, 'customers');
    const branches = tenantTable(schemaName, 'branches');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const allocations = tenantTable(schemaName, 'rental_payment_allocations');

    const conditions: string[] = [
      "(rb.status IN ('PICKED_UP', 'PARTIALLY_RETURNED') OR (rb.status = 'RETURNED' AND rb.settlement_status = 'UNSETTLED'))"
    ];
    const params: unknown[] = [];
    let pIdx = 1;

    if (query?.branchId && query.branchId !== 'all') {
      conditions.push(`rb.branch_id = $${pIdx++}::uuid`);
      params.push(query.branchId);
    }

    if (query?.status && query.status !== 'all') {
      conditions.push(`rb.status = $${pIdx++}`);
      params.push(query.status);
    }

    if (query?.startDate) {
      conditions.push(`rb.return_date >= $${pIdx++}::date`);
      params.push(query.startDate);
    }

    if (query?.endDate) {
      conditions.push(`rb.return_date <= $${pIdx++}::date`);
      params.push(query.endDate);
    }

    if (query?.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      conditions.push(`(
        rb.booking_reference ILIKE $${pIdx} OR
        c.name ILIKE $${pIdx} OR
        c.phone ILIKE $${pIdx} OR
        c.code ILIKE $${pIdx}
      )`);
      params.push(term);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const countRows = await tx.$queryRawUnsafe<Array<{ count: string | number }>>(
        `SELECT COUNT(DISTINCT rb.id) AS count
         FROM ${bookings} rb
         JOIN ${customers} c ON c.id = rb.customer_id
         ${whereClause}`,
        ...params,
      );
      const total = Number(countRows[0]?.count ?? 0);

      const rows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          branchId: string;
          branchName: string;
          customerId: string;
          customerName: string;
          customerPhone: string | null;
          customerCode: string;
          bookingReference: string;
          pickupDate: string;
          returnDate: string;
          status: RentalBookingStatus;
          settlementStatus: string;
          totalRent: number;
          totalDeposit: number;
          totalLateFees: number;
          totalDamageCharges: number;
          actualPickupAt: Date | null;
          totalUnits: number;
          returnedUnits: number;
          outstandingUnits: number;
          isOverdue: boolean;
          overdueDays: number;
          createdAt: Date;
        }>
      >(
        `SELECT
           rb.id,
           rb.branch_id AS "branchId",
           b.name AS "branchName",
           rb.customer_id AS "customerId",
           c.name AS "customerName",
           c.phone AS "customerPhone",
           c.code AS "customerCode",
           rb.booking_reference AS "bookingReference",
           rb.pickup_date::text AS "pickupDate",
           rb.return_date::text AS "returnDate",
           rb.status,
           rb.settlement_status AS "settlementStatus",
           rb.total_rent::float AS "totalRent",
           rb.total_deposit::float AS "totalDeposit",
           rb.total_late_fees::float AS "totalLateFees",
           rb.total_damage_charges::float AS "totalDamageCharges",
           rb.actual_pickup_at AS "actualPickupAt",
           COALESCE((
             SELECT SUM(amount)::float FROM ${allocations} rpa
             WHERE rpa.booking_id = rb.id AND rpa.allocation_type = 'RENT'
           ), 0)::float AS "paidRent",
           COALESCE((
             SELECT SUM(amount)::float FROM ${allocations} rpa
             WHERE rpa.booking_id = rb.id AND rpa.allocation_type = 'SECURITY_DEPOSIT'
           ), 0)::float AS "heldDeposit",
           GREATEST(0, rb.total_rent::float - COALESCE((
             SELECT SUM(amount)::float FROM ${allocations} rpa
             WHERE rpa.booking_id = rb.id AND rpa.allocation_type = 'RENT'
           ), 0)::float)::float AS "remainingRent",
           COUNT(rbi.id)::int AS "totalUnits",
           COALESCE(COUNT(rbi.id) FILTER (WHERE rbi.return_status = 'RETURNED'), 0)::int AS "returnedUnits",
           (COUNT(rbi.id) - COALESCE(COUNT(rbi.id) FILTER (WHERE rbi.return_status = 'RETURNED'), 0))::int AS "outstandingUnits",
           (CURRENT_DATE > rb.return_date AND (COUNT(rbi.id) - COALESCE(COUNT(rbi.id) FILTER (WHERE rbi.return_status = 'RETURNED'), 0)) > 0) AS "isOverdue",
           GREATEST(0, (CURRENT_DATE - rb.return_date)::int) AS "overdueDays",
           rb.created_at AS "createdAt"
         FROM ${bookings} rb
         JOIN ${customers} c ON c.id = rb.customer_id
         JOIN ${branches} b ON b.id = rb.branch_id
         JOIN ${bookingItems} rbi ON rbi.booking_id = rb.id
         ${whereClause}
         GROUP BY rb.id, b.name, c.name, c.phone, c.code
         ${query?.overdueOnly ? 'HAVING (CURRENT_DATE > rb.return_date AND (COUNT(rbi.id) - COALESCE(COUNT(rbi.id) FILTER (WHERE rbi.return_status = \'RETURNED\'), 0)) > 0)' : ''}
         ORDER BY (CURRENT_DATE > rb.return_date AND (COUNT(rbi.id) - COALESCE(COUNT(rbi.id) FILTER (WHERE rbi.return_status = 'RETURNED'), 0)) > 0) DESC, rb.return_date ASC
         LIMIT $${pIdx++} OFFSET $${pIdx++}`,
        ...params,
        limit,
        offset,
      );

      return buildPaginatedResponse(rows, total, page, limit);
    });
  }

  async getReturnsSummary(schemaName: string, branchId?: string) {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');

    const branchFilter = branchId && branchId !== 'all' ? `AND rb.branch_id = '${branchId}'::uuid` : '';

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const summaryRows = await tx.$queryRawUnsafe<
        Array<{
          totalPending: number;
          totalOverdue: number;
          totalPartiallyReturned: number;
          totalAwaitingSettlement: number;
          totalLateFees: number;
          totalDamageCharges: number;
        }>
      >(
        `WITH booking_unit_counts AS (
           SELECT
             rb.id,
             rb.status,
             rb.settlement_status,
             rb.return_date,
             rb.total_late_fees,
             rb.total_damage_charges,
             COUNT(rbi.id)::int AS total_units,
             COALESCE(COUNT(rbi.id) FILTER (WHERE rbi.return_status = 'RETURNED'), 0)::int AS returned_units
           FROM ${bookings} rb
           JOIN ${bookingItems} rbi ON rbi.booking_id = rb.id
           WHERE (rb.status IN ('PICKED_UP', 'PARTIALLY_RETURNED') OR (rb.status = 'RETURNED' AND rb.settlement_status = 'UNSETTLED'))
             ${branchFilter}
           GROUP BY rb.id
         )
         SELECT
           COUNT(*)::int AS "totalPending",
           COALESCE(COUNT(*) FILTER (WHERE CURRENT_DATE > return_date AND (total_units - returned_units) > 0), 0)::int AS "totalOverdue",
           COALESCE(COUNT(*) FILTER (WHERE status = 'PARTIALLY_RETURNED' AND (total_units - returned_units) > 0), 0)::int AS "totalPartiallyReturned",
           COALESCE(COUNT(*) FILTER (WHERE total_units = returned_units AND settlement_status = 'UNSETTLED'), 0)::int AS "totalAwaitingSettlement",
           COALESCE(SUM(total_late_fees), 0)::float AS "totalLateFees",
           COALESCE(SUM(total_damage_charges), 0)::float AS "totalDamageCharges"
         FROM booking_unit_counts`
      );

      return summaryRows[0] || {
        totalPending: 0,
        totalOverdue: 0,
        totalPartiallyReturned: 0,
        totalAwaitingSettlement: 0,
        totalLateFees: 0,
        totalDamageCharges: 0,
      };
    });
  }

  async getReturnDetails(schemaName: string, bookingId: string) {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const customers = tenantTable(schemaName, 'customers');
    const branches = tenantTable(schemaName, 'branches');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const items = tenantTable(schemaName, 'rental_items');
    const units = tenantTable(schemaName, 'rental_units');
    const returnItems = tenantTable(schemaName, 'rental_return_items');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const bookingRows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          branchId: string;
          branchName: string;
          customerId: string;
          customerName: string;
          customerPhone: string | null;
          customerEmail: string | null;
          customerCode: string;
          bookingReference: string;
          pickupDate: string;
          returnDate: string;
          status: RentalBookingStatus;
          settlementStatus: string;
          totalRent: number;
          totalDeposit: number;
          totalLateFees: number;
          totalDamageCharges: number;
          actualPickupAt: Date | null;
          pickupNotes: string | null;
          createdAt: Date;
        }>
      >(
        `SELECT
           rb.id,
           rb.branch_id AS "branchId",
           b.name AS "branchName",
           rb.customer_id AS "customerId",
           c.name AS "customerName",
           c.phone AS "customerPhone",
           c.email AS "customerEmail",
           c.code AS "customerCode",
           rb.booking_reference AS "bookingReference",
           rb.pickup_date::text AS "pickupDate",
           rb.return_date::text AS "returnDate",
           rb.status,
           rb.settlement_status AS "settlementStatus",
           rb.total_rent::float AS "totalRent",
           rb.total_deposit::float AS "totalDeposit",
           rb.total_late_fees::float AS "totalLateFees",
           rb.total_damage_charges::float AS "totalDamageCharges",
           rb.actual_pickup_at AS "actualPickupAt",
           rb.pickup_notes AS "pickupNotes",
           rb.created_at AS "createdAt"
         FROM ${bookings} rb
         JOIN ${customers} c ON c.id = rb.customer_id
         JOIN ${branches} b ON b.id = rb.branch_id
         WHERE rb.id = $1::uuid`,
        bookingId,
      );

      if (bookingRows.length === 0) {
        throw new NotFoundException(`Booking with ID ${bookingId} was not found`);
      }

      const booking = bookingRows[0];

      // Fetch units
      const itemRows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          bookingId: string;
          rentalItemId: string;
          itemName: string;
          itemCode: string;
          itemCategory: string;
          rentalUnitId: string;
          unitCode: string;
          unitNumber: number;
          unitStatus: string;
          conditionOut: string | null;
          handedOverAt: Date | null;
          returnStatus: string;
          returnedAt: Date | null;
          conditionIn: RentalItemCondition | null;
          inspectionNotes: string | null;
          lateFee: number;
          damageCharge: number;
          requiresMaintenance: boolean;
        }>
      >(
        `SELECT
           rbi.id,
           rbi.booking_id AS "bookingId",
           rbi.rental_item_id AS "rentalItemId",
           ri.name AS "itemName",
           ri.code AS "itemCode",
           ri.category AS "itemCategory",
           rbi.rental_unit_id AS "rentalUnitId",
           ru.unit_code AS "unitCode",
           ru.unit_number AS "unitNumber",
           ru.status AS "unitStatus",
           rbi.condition_out AS "conditionOut",
           rbi.handed_over_at AS "handedOverAt",
           rbi.return_status AS "returnStatus",
           rbi.returned_at AS "returnedAt",
           rbi.condition_in AS "conditionIn",
           rti.inspection_notes AS "inspectionNotes",
           COALESCE(rti.late_fee, 0)::float AS "lateFee",
           COALESCE(rti.damage_charge, 0)::float AS "damageCharge",
           COALESCE(rti.requires_maintenance, false) AS "requiresMaintenance"
         FROM ${bookingItems} rbi
         JOIN ${items} ri ON ri.id = rbi.rental_item_id
         JOIN ${units} ru ON ru.id = rbi.rental_unit_id
         LEFT JOIN ${returnItems} rti ON rti.booking_item_id = rbi.id
         WHERE rbi.booking_id = $1::uuid
         ORDER BY ru.unit_number ASC`,
        bookingId,
      );

      // Financial settlement summary
      const settlementSummary = await this.getDepositSettlementSummary(schemaName, bookingId);

      const paymentAllocations = tenantTable(schemaName, 'rental_payment_allocations');
      const rentAllocRows = await tx.$queryRawUnsafe<Array<{ rentPaid: number }>>(
        `SELECT COALESCE(SUM(amount), 0)::float AS "rentPaid"
         FROM ${paymentAllocations}
         WHERE booking_id = $1::uuid AND allocation_type = 'RENT'`,
        bookingId,
      );
      const paidRent = this.round2(rentAllocRows[0]?.rentPaid ?? 0);
      const remainingRent = Math.max(0, this.round2(booking.totalRent - paidRent));

      return {
        ...booking,
        paidRent,
        remainingRent,
        items: itemRows,
        settlementSummary,
      };
    });
  }

  async processRentalReturn(
    schemaName: string,
    bookingId: string,
    dto: ProcessRentalReturnDto,
    userId: string,
  ) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item must be submitted for return');
    }

    const bookings = tenantTable(schemaName, 'rental_bookings');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const returns = tenantTable(schemaName, 'rental_returns');
    const returnItems = tenantTable(schemaName, 'rental_return_items');
    const units = tenantTable(schemaName, 'rental_units');
    const payments = tenantTable(schemaName, 'rental_payments');
    const paymentAllocations = tenantTable(schemaName, 'rental_payment_allocations');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      // 1. Lock booking
      const bookingRows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          branchId: string;
          bookingReference: string;
          status: RentalBookingStatus;
          settlementStatus: string;
          returnDate: string;
          totalRent: number;
          totalDeposit: number;
          totalLateFees: number;
          totalDamageCharges: number;
        }>
      >(
        `SELECT id, branch_id AS "branchId", booking_reference AS "bookingReference", status, settlement_status AS "settlementStatus", return_date::text AS "returnDate", total_rent::float AS "totalRent", total_deposit::float AS "totalDeposit", total_late_fees::float AS "totalLateFees", total_damage_charges::float AS "totalDamageCharges"
         FROM ${bookings}
         WHERE id = $1::uuid
         FOR UPDATE`,
        bookingId,
      );

      if (bookingRows.length === 0) {
        throw new NotFoundException(`Booking with ID ${bookingId} was not found`);
      }

      const booking = bookingRows[0];

      if (booking.status !== 'PICKED_UP' && booking.status !== 'PARTIALLY_RETURNED') {
        throw new BadRequestException(
          `Returns can only be processed for bookings in PICKED_UP or PARTIALLY_RETURNED status (current: ${booking.status})`,
        );
      }

      // 2. Validate and lock each booking item
      const itemIds = dto.items.map((i) => i.bookingItemId);
      const uniqueItemIds = Array.from(new Set(itemIds));
      if (uniqueItemIds.length !== itemIds.length) {
        throw new BadRequestException('Duplicate items submitted in return payload');
      }

      const existingBookingItems = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          bookingId: string;
          rentalUnitId: string;
          returnStatus: string;
          conditionOut: string | null;
        }>
      >(
        `SELECT id, booking_id AS "bookingId", rental_unit_id AS "rentalUnitId", return_status AS "returnStatus", condition_out AS "conditionOut"
         FROM ${bookingItems}
         WHERE id = ANY($1::uuid[]) AND booking_id = $2::uuid
         FOR UPDATE`,
        uniqueItemIds,
        bookingId,
      );

      if (existingBookingItems.length !== uniqueItemIds.length) {
        throw new NotFoundException('One or more booking items do not belong to this booking');
      }

      for (const item of existingBookingItems) {
        if (item.returnStatus === 'RETURNED') {
          throw new ConflictException(`Unit with booking item ID ${item.id} has already been returned`);
        }
      }

      // 3. Generate sequential return number
      const returnNumber = await this.generateNextReturnNumber(tx, schemaName, returns);
      const actualReturnAt = dto.actualReturnAt ? new Date(dto.actualReturnAt) : new Date();

      // 4. Insert rental_returns header
      const returnInsert = await tx.$queryRawUnsafe<Array<{ id: string; createdAt: Date }>>(
        `INSERT INTO ${returns}
           (branch_id, booking_id, return_number, actual_return_at, returned_to_user_id, return_notes)
         VALUES
           ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6)
         RETURNING id, created_at AS "createdAt"`,
        booking.branchId,
        bookingId,
        returnNumber,
        actualReturnAt,
        userId,
        dto.returnNotes?.trim() || null,
      );

      const returnId = returnInsert[0].id;

      // 5. Insert return items and update unit/booking item statuses
      let batchLateFees = 0;
      let batchDamageCharges = 0;

      for (const itemDto of dto.items) {
        const itemRecord = existingBookingItems.find((b) => b.id === itemDto.bookingItemId)!;
        const conditionIn = itemDto.conditionIn || 'GOOD';
        const lateFee = Math.max(0, this.round2(Number(itemDto.lateFee || 0)));
        const damageCharge = Math.max(0, this.round2(Number(itemDto.damageCharge || 0)));
        const requiresMaintenance = Boolean(itemDto.requiresMaintenance || conditionIn === 'DAMAGED' || conditionIn === 'REQUIRES_REPAIR');

        batchLateFees = this.round2(batchLateFees + lateFee);
        batchDamageCharges = this.round2(batchDamageCharges + damageCharge);

        // Insert return item
        await tx.$executeRawUnsafe(
          `INSERT INTO ${returnItems}
             (return_id, booking_item_id, rental_unit_id, condition_in, inspection_notes, late_fee, damage_charge, requires_maintenance)
           VALUES
             ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8)`,
          returnId,
          itemRecord.id,
          itemRecord.rentalUnitId,
          conditionIn,
          itemDto.inspectionNotes?.trim() || null,
          lateFee,
          damageCharge,
          requiresMaintenance,
        );

        // Update booking item
        await tx.$executeRawUnsafe(
          `UPDATE ${bookingItems}
           SET returned_at = $1, condition_in = $2, return_status = 'RETURNED'
           WHERE id = $3::uuid`,
          actualReturnAt,
          conditionIn,
          itemRecord.id,
        );

        // Update physical unit status: AVAILABLE or MAINTENANCE directly
        const newUnitStatus = requiresMaintenance ? 'MAINTENANCE' : 'AVAILABLE';
        await tx.$executeRawUnsafe(
          `UPDATE ${units}
           SET status = $1::text::"${schemaName}".rental_unit_status, updated_at = NOW()
           WHERE id = $2::uuid`,
          newUnitStatus,
          itemRecord.rentalUnitId,
        );
      }

      // 6. Update booking total fees
      await tx.$executeRawUnsafe(
        `UPDATE ${bookings}
         SET total_late_fees = total_late_fees + $1,
             total_damage_charges = total_damage_charges + $2,
             updated_at = NOW()
         WHERE id = $3::uuid`,
        batchLateFees,
        batchDamageCharges,
        bookingId,
      );

      // 6.5. Optional Payment Collection at Return
      let collectedPaymentRecord: any = null;
      let paymentAllocatedToRent = 0;

      const rentAllocRows = await tx.$queryRawUnsafe<Array<{ rentPaid: number }>>(
        `SELECT COALESCE(SUM(amount), 0)::float AS "rentPaid"
         FROM ${paymentAllocations}
         WHERE booking_id = $1::uuid AND allocation_type = 'RENT'`,
        bookingId,
      );
      const alreadyPaidRent = this.round2(rentAllocRows[0]?.rentPaid ?? 0);
      const totalRent = this.round2(booking.totalRent || 0);
      const remainingRent = Math.max(0, this.round2(totalRent - alreadyPaidRent));

      if (dto.collectPayment && dto.paymentAmount && dto.paymentAmount > 0) {
        const paymentAmount = this.round2(dto.paymentAmount);
        paymentAllocatedToRent = Math.min(paymentAmount, remainingRent);
        const paymentNumber = await this.generateNextPaymentNumber(tx, schemaName, payments);
        const payMethod = dto.paymentMethod || 'CASH';

        const payInsert = await tx.$queryRawUnsafe<Array<{ id: string; createdAt: Date; updatedAt: Date }>>(
          `INSERT INTO ${payments}
             (branch_id, booking_id, payment_number, amount, payment_method, reference_number, notes, received_by)
           VALUES
             ($1::uuid, $2::uuid, $3, $4, $5::text::"${schemaName}".payment_method, $6, $7, $8::uuid)
           RETURNING id, created_at AS "createdAt", updated_at AS "updatedAt"`,
          booking.branchId,
          bookingId,
          paymentNumber,
          paymentAmount,
          payMethod,
          dto.referenceNumber?.trim() || null,
          dto.paymentNotes?.trim() || 'Payment collected upon item return',
          userId,
        );

        const paymentId = payInsert[0].id;

        if (paymentAllocatedToRent > 0) {
          await tx.$executeRawUnsafe(
            `INSERT INTO ${paymentAllocations}
               (payment_id, booking_id, allocation_type, amount, notes)
             VALUES
               ($1::uuid, $2::uuid, 'RENT', $3, $4)`,
            paymentId,
            bookingId,
            paymentAllocatedToRent,
            'Rental charge payment collected at return',
          );
        }

        collectedPaymentRecord = {
          id: paymentId,
          paymentNumber,
          amount: paymentAmount,
          paymentMethod: payMethod,
          referenceNumber: dto.referenceNumber?.trim() || null,
          rentAmount: paymentAllocatedToRent,
          createdAt: payInsert[0].createdAt,
        };

        await logAudit(tx, schemaName, {
          userId,
          action: 'RENTAL_PAYMENT_COLLECTED',
          entityType: 'rental_payment',
          entityId: paymentId,
          details: {
            paymentNumber,
            bookingId,
            bookingReference: booking.bookingReference,
            totalAmount: paymentAmount,
            rentAmount: paymentAllocatedToRent,
            paymentMethod: payMethod,
            collectedAtReturn: true,
          },
        });
      }

      // 7. Check if all items for this booking are returned
      const remainingUnreturned = await tx.$queryRawUnsafe<Array<{ count: string | number }>>(
        `SELECT COUNT(*)::int AS count
         FROM ${bookingItems}
         WHERE booking_id = $1::uuid AND return_status != 'RETURNED'`,
        bookingId,
      );

      const unreturnedCount = Number(remainingUnreturned[0]?.count ?? 0);
      let newBookingStatus: RentalBookingStatus = booking.status;
      let newSettlementStatus = booking.settlementStatus;

      if (unreturnedCount === 0) {
        newBookingStatus = 'RETURNED';

        const finalPaidRent = this.round2(alreadyPaidRent + paymentAllocatedToRent);
        const finalRemainingRent = Math.max(0, this.round2(totalRent - finalPaidRent));
        const finalTotalFees = this.round2(Number(booking.totalLateFees || 0) + batchLateFees + Number(booking.totalDamageCharges || 0) + batchDamageCharges);
        const finalTotalDeposit = this.round2(Number(booking.totalDeposit || 0));

        // If all rent is paid, deposit was 0, and no accrued damage/late fees, booking is complete & settled
        if (finalRemainingRent <= 0.001 && finalTotalDeposit <= 0.001 && finalTotalFees <= 0.001) {
          newSettlementStatus = 'SETTLED';
        }
      } else {
        newBookingStatus = 'PARTIALLY_RETURNED';
      }

      await tx.$executeRawUnsafe(
        `UPDATE ${bookings}
         SET status = $1::text::"${schemaName}".rental_booking_status,
             settlement_status = $2,
             updated_at = NOW()
         WHERE id = $3::uuid`,
        newBookingStatus,
        newSettlementStatus,
        bookingId,
      );

      // 8. Audit log
      await logAudit(tx, schemaName, {
        entityType: 'rental_returns',
        entityId: returnId,
        action: 'RENTAL_RETURN_PROCESSED',
        userId,
        details: {
          returnNumber,
          bookingId,
          bookingReference: booking.bookingReference,
          itemsCount: dto.items.length,
          batchLateFees,
          batchDamageCharges,
          allUnitsReturned: unreturnedCount === 0,
        },
      });

      return {
        id: returnId,
        returnNumber,
        bookingId,
        actualReturnAt,
        itemsCount: dto.items.length,
        batchLateFees,
        batchDamageCharges,
        allUnitsReturned: unreturnedCount === 0,
        newBookingStatus,
        newSettlementStatus,
        payment: collectedPaymentRecord,
      };
    });
  }

  async getBookingReturns(schemaName: string, bookingId: string) {
    const returns = tenantTable(schemaName, 'rental_returns');
    const returnItems = tenantTable(schemaName, 'rental_return_items');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const items = tenantTable(schemaName, 'rental_items');
    const units = tenantTable(schemaName, 'rental_units');
    const users = tenantTable(schemaName, 'users');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const returnRows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          returnNumber: string;
          branchId: string;
          bookingId: string;
          actualReturnAt: Date;
          returnedToUserId: string | null;
          returnedToUserName: string | null;
          returnNotes: string | null;
          createdAt: Date;
        }>
      >(
        `SELECT
           rr.id,
           rr.return_number AS "returnNumber",
           rr.branch_id AS "branchId",
           rr.booking_id AS "bookingId",
           rr.actual_return_at AS "actualReturnAt",
           rr.returned_to_user_id AS "returnedToUserId",
           u.name AS "returnedToUserName",
           rr.return_notes AS "returnNotes",
           rr.created_at AS "createdAt"
         FROM ${returns} rr
         LEFT JOIN ${users} u ON u.id = rr.returned_to_user_id
         WHERE rr.booking_id = $1::uuid
         ORDER BY rr.actual_return_at DESC`,
        bookingId,
      );

      const returnIds = returnRows.map((r) => r.id);
      if (returnIds.length === 0) return [];

      const itemRows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          returnId: string;
          bookingItemId: string;
          rentalUnitId: string;
          unitCode: string;
          unitNumber: number;
          itemName: string;
          itemCode: string;
          conditionOut: string | null;
          conditionIn: RentalItemCondition;
          inspectionNotes: string | null;
          lateFee: number;
          damageCharge: number;
          requiresMaintenance: boolean;
          createdAt: Date;
        }>
      >(
        `SELECT
           rti.id,
           rti.return_id AS "returnId",
           rti.booking_item_id AS "bookingItemId",
           rti.rental_unit_id AS "rentalUnitId",
           ru.unit_code AS "unitCode",
           ru.unit_number AS "unitNumber",
           ri.name AS "itemName",
           ri.code AS "itemCode",
           rbi.condition_out AS "conditionOut",
           rti.condition_in AS "conditionIn",
           rti.inspection_notes AS "inspectionNotes",
           rti.late_fee::float AS "lateFee",
           rti.damage_charge::float AS "damageCharge",
           rti.requires_maintenance AS "requiresMaintenance",
           rti.created_at AS "createdAt"
         FROM ${returnItems} rti
         JOIN ${bookingItems} rbi ON rbi.id = rti.booking_item_id
         JOIN ${items} ri ON ri.id = rbi.rental_item_id
         JOIN ${units} ru ON ru.id = rti.rental_unit_id
         WHERE rti.return_id = ANY($1::uuid[])
         ORDER BY ru.unit_number ASC`,
        returnIds,
      );

      return returnRows.map((ret) => ({
        ...ret,
        items: itemRows.filter((item) => item.returnId === ret.id),
      }));
    });
  }

  async getDepositSettlementSummary(schemaName: string, bookingId: string) {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const paymentAllocations = tenantTable(schemaName, 'rental_payment_allocations');
    const returnItems = tenantTable(schemaName, 'rental_return_items');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const settlements = tenantTable(schemaName, 'rental_deposit_settlements');
    const refunds = tenantTable(schemaName, 'rental_refunds');
    const users = tenantTable(schemaName, 'users');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      // 1. Booking basic
      const bookingRows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          status: RentalBookingStatus;
          settlementStatus: string;
          totalDeposit: number;
          totalRent: number;
        }>
      >(
        `SELECT id, status, settlement_status AS "settlementStatus", total_deposit::float AS "totalDeposit", total_rent::float AS "totalRent"
         FROM ${bookings}
         WHERE id = $1::uuid`,
        bookingId,
      );

      if (bookingRows.length === 0) {
        throw new NotFoundException(`Booking with ID ${bookingId} was not found`);
      }
      const booking = bookingRows[0];

      // 2. Deposit collected from allocations
      const depRows = await tx.$queryRawUnsafe<Array<{ depositCollected: number }>>(
        `SELECT COALESCE(SUM(amount), 0)::float AS "depositCollected"
         FROM ${paymentAllocations}
         WHERE booking_id = $1::uuid AND allocation_type = 'SECURITY_DEPOSIT'`,
        bookingId,
      );
      const depositCollected = this.round2(depRows[0]?.depositCollected ?? 0);

      // 3. Late fees and damage charges from return items
      const feeRows = await tx.$queryRawUnsafe<
        Array<{ totalLateFees: number; totalDamageCharges: number }>
      >(
        `SELECT
           COALESCE(SUM(rti.late_fee), 0)::float AS "totalLateFees",
           COALESCE(SUM(rti.damage_charge), 0)::float AS "totalDamageCharges"
         FROM ${returnItems} rti
         JOIN ${bookingItems} rbi ON rbi.id = rti.booking_item_id
         WHERE rbi.booking_id = $1::uuid`,
        bookingId,
      );
      const totalLateFees = this.round2(feeRows[0]?.totalLateFees ?? 0);
      const totalDamageCharges = this.round2(feeRows[0]?.totalDamageCharges ?? 0);
      const totalCharges = this.round2(totalLateFees + totalDamageCharges);

      // 4. Calculate settlement math
      const depositDeducted = Math.min(depositCollected, totalCharges);
      const refundableBalance = Math.max(0, this.round2(depositCollected - totalCharges));
      const additionalAmountDue = Math.max(0, this.round2(totalCharges - depositCollected));

      // 5. Existing settlement if any
      const settlementRows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          settlementNumber: string;
          branchId: string;
          bookingId: string;
          depositCollected: number;
          totalLateFees: number;
          totalDamageCharges: number;
          depositDeducted: number;
          depositRefunded: number;
          additionalAmountDue: number;
          settlementStatus: string;
          settledByUserId: string | null;
          settledByUserName: string | null;
          settledAt: Date;
          notes: string | null;
        }>
      >(
        `SELECT
           rs.id,
           rs.settlement_number AS "settlementNumber",
           rs.branch_id AS "branchId",
           rs.booking_id AS "bookingId",
           rs.deposit_collected::float AS "depositCollected",
           rs.total_late_fees::float AS "totalLateFees",
           rs.total_damage_charges::float AS "totalDamageCharges",
           rs.deposit_deducted::float AS "depositDeducted",
           rs.deposit_refunded::float AS "depositRefunded",
           rs.additional_amount_due::float AS "additionalAmountDue",
           rs.settlement_status AS "settlementStatus",
           rs.settled_by_user_id AS "settledByUserId",
           u.name AS "settledByUserName",
           rs.settled_at AS "settledAt",
           rs.notes
         FROM ${settlements} rs
         LEFT JOIN ${users} u ON u.id = rs.settled_by_user_id
         WHERE rs.booking_id = $1::uuid
         ORDER BY rs.settled_at DESC
         LIMIT 1`,
        bookingId,
      );

      // 6. Refunds if any
      const refundRows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          refundNumber: string;
          bookingId: string;
          settlementId: string | null;
          branchId: string;
          amount: number;
          paymentMethod: RentalPaymentMethod;
          refundStatus: string;
          refundedByUserId: string | null;
          refundedByUserName: string | null;
          refundedAt: Date;
          notes: string | null;
          idempotencyKey: string | null;
        }>
      >(
        `SELECT
           rf.id,
           rf.refund_number AS "refundNumber",
           rf.booking_id AS "bookingId",
           rf.settlement_id AS "settlementId",
           rf.branch_id AS "branchId",
           rf.amount::float AS "amount",
           rf.payment_method AS "paymentMethod",
           rf.refund_status AS "refundStatus",
           rf.refunded_by_user_id AS "refundedByUserId",
           u.name AS "refundedByUserName",
           rf.refunded_at AS "refundedAt",
           rf.notes,
           rf.idempotency_key AS "idempotencyKey"
         FROM ${refunds} rf
         LEFT JOIN ${users} u ON u.id = rf.refunded_by_user_id
         WHERE rf.booking_id = $1::uuid
         ORDER BY rf.refunded_at DESC`,
        bookingId,
      );

      // 7. Check if all items returned
      const countRows = await tx.$queryRawUnsafe<
        Array<{ totalCount: number; returnedCount: number }>
      >(
        `SELECT
           COUNT(*)::int AS "totalCount",
           COALESCE(COUNT(*) FILTER (WHERE return_status = 'RETURNED'), 0)::int AS "returnedCount"
         FROM ${bookingItems}
         WHERE booking_id = $1::uuid`,
        bookingId,
      );

      const totalItems = countRows[0]?.totalCount ?? 0;
      const returnedItems = countRows[0]?.returnedCount ?? 0;
      const allItemsReturned = totalItems > 0 && totalItems === returnedItems;

      return {
        bookingId,
        depositCollected,
        totalLateFees,
        totalDamageCharges,
        totalCharges,
        depositDeducted,
        refundableBalance,
        additionalAmountDue,
        allItemsReturned,
        totalItems,
        returnedItems,
        isSettled: booking.settlementStatus === 'SETTLED' || settlementRows.length > 0,
        settlement: settlementRows[0] || null,
        refunds: refundRows,
      };
    });
  }

  async settleRentalDeposit(
    schemaName: string,
    bookingId: string,
    dto: SettleRentalDepositDto,
    userId: string,
  ) {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const settlements = tenantTable(schemaName, 'rental_deposit_settlements');
    const refunds = tenantTable(schemaName, 'rental_refunds');
    const paymentAllocations = tenantTable(schemaName, 'rental_payment_allocations');
    const returnItems = tenantTable(schemaName, 'rental_return_items');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      // 1. Lock booking
      const bookingRows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          branchId: string;
          bookingReference: string;
          status: RentalBookingStatus;
          settlementStatus: string;
          totalRent: number;
        }>
      >(
        `SELECT id, branch_id AS "branchId", booking_reference AS "bookingReference", status, settlement_status AS "settlementStatus", total_rent::float AS "totalRent"
         FROM ${bookings}
         WHERE id = $1::uuid
         FOR UPDATE`,
        bookingId,
      );

      if (bookingRows.length === 0) {
        throw new NotFoundException(`Booking with ID ${bookingId} was not found`);
      }
      const booking = bookingRows[0];

      if (booking.settlementStatus === 'SETTLED') {
        throw new BadRequestException('Security deposit for this booking is already settled');
      }

      // 2. Check all items returned
      const countRows = await tx.$queryRawUnsafe<
        Array<{ totalCount: number; returnedCount: number }>
      >(
        `SELECT
           COUNT(*)::int AS "totalCount",
           COALESCE(COUNT(*) FILTER (WHERE return_status = 'RETURNED'), 0)::int AS "returnedCount"
         FROM ${bookingItems}
         WHERE booking_id = $1::uuid`,
        bookingId,
      );

      const totalItems = countRows[0]?.totalCount ?? 0;
      const returnedItems = countRows[0]?.returnedCount ?? 0;
      if (totalItems !== returnedItems) {
        throw new BadRequestException(
          `Cannot settle deposit until all items have been returned (${returnedItems}/${totalItems} returned)`,
        );
      }

      // Verify that all rental charges are paid before marking financially settled
      const rentAllocRows = await tx.$queryRawUnsafe<Array<{ rentPaid: number }>>(
        `SELECT COALESCE(SUM(amount), 0)::float AS "rentPaid"
         FROM ${paymentAllocations}
         WHERE booking_id = $1::uuid AND allocation_type = 'RENT'`,
        bookingId,
      );
      const rentPaid = this.round2(rentAllocRows[0]?.rentPaid ?? 0);
      const bookingRent = this.round2(booking.totalRent);
      const remainingRent = Math.max(0, this.round2(bookingRent - rentPaid));

      if (remainingRent > 0) {
        throw new BadRequestException(
          `Cannot finalize financial settlement: Outstanding rental balance of LKR ${remainingRent.toFixed(2)} must be collected first.`,
        );
      }

      // 3. Compute financial amounts
      const depRows = await tx.$queryRawUnsafe<Array<{ depositCollected: number }>>(
        `SELECT COALESCE(SUM(amount), 0)::float AS "depositCollected"
         FROM ${paymentAllocations}
         WHERE booking_id = $1::uuid AND allocation_type = 'SECURITY_DEPOSIT'`,
        bookingId,
      );
      const depositCollected = this.round2(depRows[0]?.depositCollected ?? 0);

      const feeRows = await tx.$queryRawUnsafe<
        Array<{ totalLateFees: number; totalDamageCharges: number }>
      >(
        `SELECT
           COALESCE(SUM(rti.late_fee), 0)::float AS "totalLateFees",
           COALESCE(SUM(rti.damage_charge), 0)::float AS "totalDamageCharges"
         FROM ${returnItems} rti
         JOIN ${bookingItems} rbi ON rbi.id = rti.booking_item_id
         WHERE rbi.booking_id = $1::uuid`,
        bookingId,
      );
      const totalLateFees = this.round2(feeRows[0]?.totalLateFees ?? 0);
      const totalDamageCharges = this.round2(feeRows[0]?.totalDamageCharges ?? 0);
      const totalCharges = this.round2(totalLateFees + totalDamageCharges);

      const depositDeducted = Math.min(depositCollected, totalCharges);
      const refundableBalance = Math.max(0, this.round2(depositCollected - totalCharges));
      const additionalAmountDue = Math.max(0, this.round2(totalCharges - depositCollected));

      // 4. Generate settlement code
      const settlementNumber = await this.generateNextSettlementNumber(tx, schemaName, settlements);

      // 5. Insert settlement record
      const setInsert = await tx.$queryRawUnsafe<Array<{ id: string; createdAt: Date }>>(
        `INSERT INTO ${settlements}
           (settlement_number, branch_id, booking_id, deposit_collected, total_late_fees, total_damage_charges, deposit_deducted, deposit_refunded, additional_amount_due, settlement_status, settled_by_user_id, notes)
         VALUES
           ($1, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, 'COMPLETED', $10::uuid, $11)
         RETURNING id, created_at AS "createdAt"`,
        settlementNumber,
        booking.branchId,
        bookingId,
        depositCollected,
        totalLateFees,
        totalDamageCharges,
        depositDeducted,
        refundableBalance,
        additionalAmountDue,
        userId,
        dto.notes?.trim() || null,
      );

      const settlementId = setInsert[0].id;
      let refundRecord: RentalRefundRecord | null = null;

      // 6. Record refund if refundableBalance > 0
      if (refundableBalance > 0) {
        const refundNumber = await this.generateNextRefundNumber(tx, schemaName, refunds);
        const refundMethod = dto.refundMethod || 'CASH';

        const refInsert = await tx.$queryRawUnsafe<Array<{ id: string; createdAt: Date }>>(
          `INSERT INTO ${refunds}
             (refund_number, booking_id, settlement_id, branch_id, amount, payment_method, refund_status, refunded_by_user_id, notes, idempotency_key)
           VALUES
             ($1, $2::uuid, $3::uuid, $4::uuid, $5, $6::text::"${schemaName}".payment_method, 'COMPLETED', $7::uuid, $8, $9)
           RETURNING id, created_at AS "createdAt"`,
          refundNumber,
          bookingId,
          settlementId,
          booking.branchId,
          refundableBalance,
          refundMethod,
          userId,
          dto.notes?.trim() || 'Security deposit refund on settlement',
          dto.idempotencyKey?.trim() || null,
        );

        refundRecord = {
          id: refInsert[0].id,
          refundNumber,
          bookingId,
          settlementId,
          branchId: booking.branchId,
          amount: refundableBalance,
          paymentMethod: refundMethod,
          refundStatus: 'COMPLETED',
          refundedByUserId: userId,
          refundedAt: refInsert[0].createdAt,
          notes: dto.notes?.trim() || null,
          idempotencyKey: dto.idempotencyKey?.trim() || null,
        };
      }

      // 7. Update booking status to RETURNED and settlement_status to SETTLED
      await tx.$executeRawUnsafe(
        `UPDATE ${bookings}
         SET status = 'RETURNED', settlement_status = 'SETTLED', updated_at = NOW()
         WHERE id = $1::uuid`,
        bookingId,
      );

      // 8. Audit log
      await logAudit(tx, schemaName, {
        entityType: 'rental_deposit_settlements',
        entityId: settlementId,
        action: 'RENTAL_DEPOSIT_SETTLED',
        userId,
        details: {
          settlementNumber,
          bookingId,
          bookingReference: booking.bookingReference,
          depositCollected,
          totalCharges,
          depositDeducted,
          refundableBalance,
          additionalAmountDue,
        },
      });

      return {
        id: settlementId,
        settlementNumber,
        bookingId,
        depositCollected,
        totalLateFees,
        totalDamageCharges,
        totalCharges,
        depositDeducted,
        depositRefunded: refundableBalance,
        additionalAmountDue,
        settlementStatus: 'COMPLETED',
        refund: refundRecord,
      };
    });
  }

  async recordRentalRefund(
    schemaName: string,
    bookingId: string,
    dto: RecordRentalRefundDto,
    userId: string,
  ) {
    const refunds = tenantTable(schemaName, 'rental_refunds');
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const paymentAllocations = tenantTable(schemaName, 'rental_payment_allocations');

    const refundAmount = this.round2(Number(dto.amount));
    if (refundAmount <= 0) {
      throw new BadRequestException('Refund amount must be greater than 0');
    }

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      // 1. Idempotency check
      if (dto.idempotencyKey?.trim()) {
        const existing = await tx.$queryRawUnsafe<
          Array<{
            id: string;
            refundNumber: string;
            bookingId: string;
            settlementId: string | null;
            branchId: string;
            amount: number;
            paymentMethod: RentalPaymentMethod;
            refundStatus: string;
            refundedByUserId: string | null;
            refundedAt: Date;
            notes: string | null;
            idempotencyKey: string | null;
          }>
        >(
          `SELECT
             id,
             refund_number AS "refundNumber",
             booking_id AS "bookingId",
             settlement_id AS "settlementId",
             branch_id AS "branchId",
             amount::float AS "amount",
             payment_method AS "paymentMethod",
             refund_status AS "refundStatus",
             refunded_by_user_id AS "refundedByUserId",
             refunded_at AS "refundedAt",
             notes,
             idempotency_key AS "idempotencyKey"
           FROM ${refunds}
           WHERE idempotency_key = $1 LIMIT 1`,
          dto.idempotencyKey.trim(),
        );

        if (existing.length > 0) {
          return existing[0];
        }
      }

      // 2. Lock booking
      const bookingRows = await tx.$queryRawUnsafe<
        Array<{ id: string; branchId: string; bookingReference: string }>
      >(
        `SELECT id, branch_id AS "branchId", booking_reference AS "bookingReference"
         FROM ${bookings}
         WHERE id = $1::uuid
         FOR UPDATE`,
        bookingId,
      );

      if (bookingRows.length === 0) {
        throw new NotFoundException(`Booking with ID ${bookingId} was not found`);
      }
      const booking = bookingRows[0];

      // 3. Check remaining refundable deposit liability
      const depRows = await tx.$queryRawUnsafe<Array<{ depositCollected: number }>>(
        `SELECT COALESCE(SUM(amount), 0)::float AS "depositCollected"
         FROM ${paymentAllocations}
         WHERE booking_id = $1::uuid AND allocation_type = 'SECURITY_DEPOSIT'`,
        bookingId,
      );
      const depositCollected = this.round2(depRows[0]?.depositCollected ?? 0);

      const pastRefundRows = await tx.$queryRawUnsafe<Array<{ totalRefunded: number }>>(
        `SELECT COALESCE(SUM(amount), 0)::float AS "totalRefunded"
         FROM ${refunds}
         WHERE booking_id = $1::uuid`,
        bookingId,
      );
      const totalRefunded = this.round2(pastRefundRows[0]?.totalRefunded ?? 0);
      const maxRefundable = Math.max(0, this.round2(depositCollected - totalRefunded));

      if (refundAmount > maxRefundable) {
        throw new BadRequestException(
          `Refund amount (${refundAmount}) exceeds maximum refundable deposit liability (${maxRefundable})`,
        );
      }

      // 4. Generate refund code
      const refundNumber = await this.generateNextRefundNumber(tx, schemaName, refunds);
      const refundMethod = dto.paymentMethod || 'CASH';

      // 5. Insert refund
      const refInsert = await tx.$queryRawUnsafe<Array<{ id: string; createdAt: Date }>>(
        `INSERT INTO ${refunds}
           (refund_number, booking_id, branch_id, amount, payment_method, refund_status, refunded_by_user_id, notes, idempotency_key)
         VALUES
           ($1, $2::uuid, $3::uuid, $4, $5::text::"${schemaName}".payment_method, 'COMPLETED', $6::uuid, $7, $8)
         RETURNING id, created_at AS "createdAt"`,
        refundNumber,
        bookingId,
        booking.branchId,
        refundAmount,
        refundMethod,
        userId,
        dto.notes?.trim() || null,
        dto.idempotencyKey?.trim() || null,
      );

      const refundRecord: RentalRefundRecord = {
        id: refInsert[0].id,
        refundNumber,
        bookingId,
        settlementId: null,
        branchId: booking.branchId,
        amount: refundAmount,
        paymentMethod: refundMethod,
        refundStatus: 'COMPLETED',
        refundedByUserId: userId,
        refundedAt: refInsert[0].createdAt,
        notes: dto.notes?.trim() || null,
        idempotencyKey: dto.idempotencyKey?.trim() || null,
      };

      // 6. Audit log
      await logAudit(tx, schemaName, {
        entityType: 'rental_refunds',
        entityId: refundRecord.id,
        action: 'RENTAL_REFUND_RECORDED',
        userId,
        details: {
          refundNumber,
          bookingId,
          bookingReference: booking.bookingReference,
          amount: refundAmount,
          paymentMethod: refundMethod,
        },
      });

      return refundRecord;
    });
  }

  async getReturnReceipt(schemaName: string, returnId: string) {
    const returns = tenantTable(schemaName, 'rental_returns');
    const returnItems = tenantTable(schemaName, 'rental_return_items');
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const customers = tenantTable(schemaName, 'customers');
    const branches = tenantTable(schemaName, 'branches');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const items = tenantTable(schemaName, 'rental_items');
    const units = tenantTable(schemaName, 'rental_units');
    const users = tenantTable(schemaName, 'users');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const returnRows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          returnNumber: string;
          actualReturnAt: Date;
          returnNotes: string | null;
          bookingId: string;
          bookingReference: string;
          pickupDate: string;
          expectedReturnDate: string;
          branchName: string;
          branchPhone: string | null;
          branchAddress: string | null;
          customerName: string;
          customerPhone: string | null;
          customerCode: string;
          inspectorName: string | null;
        }>
      >(
        `SELECT
           rr.id,
           rr.return_number AS "returnNumber",
           rr.actual_return_at AS "actualReturnAt",
           rr.return_notes AS "returnNotes",
           rb.id AS "bookingId",
           rb.booking_reference AS "bookingReference",
           rb.pickup_date::text AS "pickupDate",
           rb.return_date::text AS "expectedReturnDate",
           b.name AS "branchName",
           b.phone AS "branchPhone",
           b.address AS "branchAddress",
           c.name AS "customerName",
           c.phone AS "customerPhone",
           c.code AS "customerCode",
           u.name AS "inspectorName"
         FROM ${returns} rr
         JOIN ${bookings} rb ON rb.id = rr.booking_id
         JOIN ${branches} b ON b.id = rr.branch_id
         JOIN ${customers} c ON c.id = rb.customer_id
         LEFT JOIN ${users} u ON u.id = rr.returned_to_user_id
         WHERE rr.id = $1::uuid`,
        returnId,
      );

      if (returnRows.length === 0) {
        throw new NotFoundException(`Return transaction with ID ${returnId} was not found`);
      }

      const ret = returnRows[0];

      const itemRows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          unitCode: string;
          itemName: string;
          itemCode: string;
          conditionOut: string | null;
          conditionIn: RentalItemCondition;
          inspectionNotes: string | null;
          lateFee: number;
          damageCharge: number;
        }>
      >(
        `SELECT
           rti.id,
           ru.unit_code AS "unitCode",
           ri.name AS "itemName",
           ri.code AS "itemCode",
           rbi.condition_out AS "conditionOut",
           rti.condition_in AS "conditionIn",
           rti.inspection_notes AS "inspectionNotes",
           rti.late_fee::float AS "lateFee",
           rti.damage_charge::float AS "damageCharge"
         FROM ${returnItems} rti
         JOIN ${bookingItems} rbi ON rbi.id = rti.booking_item_id
         JOIN ${items} ri ON ri.id = rbi.rental_item_id
         JOIN ${units} ru ON ru.id = rti.rental_unit_id
         WHERE rti.return_id = $1::uuid`,
        returnId,
      );

      const totalLateFees = itemRows.reduce((sum, i) => this.round2(sum + i.lateFee), 0);
      const totalDamageCharges = itemRows.reduce((sum, i) => this.round2(sum + i.damageCharge), 0);
      const totalCharges = this.round2(totalLateFees + totalDamageCharges);

      return {
        salonName: 'Dart Smart Salon',
        returnNumber: ret.returnNumber,
        actualReturnAt: ret.actualReturnAt,
        returnNotes: ret.returnNotes,
        bookingReference: ret.bookingReference,
        pickupDate: ret.pickupDate,
        expectedReturnDate: ret.expectedReturnDate,
        branch: {
          name: ret.branchName,
          phone: ret.branchPhone,
          address: ret.branchAddress,
        },
        customer: {
          name: ret.customerName,
          phone: ret.customerPhone,
          code: ret.customerCode,
        },
        inspectorName: ret.inspectorName,
        items: itemRows,
        totalLateFees,
        totalDamageCharges,
        totalCharges,
      };
    });
  }

  async updateRentalUnitAfterCleaning(
    schemaName: string,
    unitId: string,
    dto: UpdateRentalUnitClearanceDto,
    userId: string,
  ) {
    const units = tenantTable(schemaName, 'rental_units');
    const items = tenantTable(schemaName, 'rental_items');
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      // 1. Check unit
      const unitRows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          rentalItemId: string;
          unitCode: string;
          status: string;
          itemName: string;
        }>
      >(
        `SELECT ru.id, ru.rental_item_id AS "rentalItemId", ru.unit_code AS "unitCode", ru.status, ri.name AS "itemName"
         FROM ${units} ru
         JOIN ${items} ri ON ri.id = ru.rental_item_id
         WHERE ru.id = $1::uuid`,
        unitId,
      );

      if (unitRows.length === 0) {
        throw new NotFoundException(`Rental unit with ID ${unitId} was not found`);
      }
      const unit = unitRows[0];

      // 2. Check future reservations
      const upcomingRows = await tx.$queryRawUnsafe<
        Array<{ bookingReference: string; pickupDate: string; returnDate: string }>
      >(
        `SELECT rb.booking_reference AS "bookingReference", rb.pickup_date::text AS "pickupDate", rb.return_date::text AS "returnDate"
         FROM ${bookingItems} rbi
         JOIN ${bookings} rb ON rb.id = rbi.booking_id
         WHERE rbi.rental_unit_id = $1::uuid
           AND rb.status = 'RESERVED'
           AND rb.return_date >= CURRENT_DATE
         ORDER BY rb.pickup_date ASC
         LIMIT 1`,
        unitId,
      );

      let warning: string | null = null;
      if (upcomingRows.length > 0 && dto.status === 'MAINTENANCE') {
        warning = `Operational Warning: Unit ${unit.unitCode} is reserved under booking ${upcomingRows[0].bookingReference} from ${upcomingRows[0].pickupDate} to ${upcomingRows[0].returnDate}. Please expedite maintenance before pickup.`;
      }

      // 3. Update status
      await tx.$executeRawUnsafe(
        `UPDATE ${units}
         SET status = $1::text::"${schemaName}".rental_unit_status, updated_at = NOW()
         WHERE id = $2::uuid`,
        dto.status,
        unitId,
      );

      // 4. Audit log
      await logAudit(tx, schemaName, {
        entityType: 'rental_units',
        entityId: unitId,
        action: 'RENTAL_UNIT_CLEARANCE_UPDATED',
        userId,
        details: {
          unitCode: unit.unitCode,
          oldStatus: unit.status,
          newStatus: dto.status,
          notes: dto.notes?.trim() || null,
          hasUpcomingReservation: upcomingRows.length > 0,
        },
      });

      return {
        unitId,
        unitCode: unit.unitCode,
        itemName: unit.itemName,
        previousStatus: unit.status,
        newStatus: dto.status,
        warning,
      };
    });
  }


  // ==========================================
  // PHASE 5: RENTAL OVERVIEW, HISTORY & REPORTS
  // ==========================================

  async getRentalOverview(schemaName: string, query?: RentalOverviewQueryDto) {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const units = tenantTable(schemaName, 'rental_units');
    const payments = tenantTable(schemaName, 'rental_payments');
    const allocations = tenantTable(schemaName, 'rental_payment_allocations');
    const returns = tenantTable(schemaName, 'rental_returns');
    const returnItems = tenantTable(schemaName, 'rental_return_items');
    const refunds = tenantTable(schemaName, 'rental_refunds');

    const branchFilter = query?.branchId && query.branchId !== 'all' ? `AND rb.branch_id = '${query.branchId}'::uuid` : '';
    const unitBranchFilter = query?.branchId && query.branchId !== 'all' ? `AND ru.branch_id = '${query.branchId}'::uuid` : '';
    const payBranchFilter = query?.branchId && query.branchId !== 'all' ? `AND rp.branch_id = '${query.branchId}'::uuid` : '';

    const dateFilter = [
      query?.startDate ? `rb.pickup_date >= '${query.startDate}'::date` : null,
      query?.endDate ? `rb.pickup_date <= '${query.endDate}'::date` : null,
    ].filter(Boolean).map((c) => `AND ${c}`).join(' ');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      // 1. Bookings KPIs
      const bookingStats = await tx.$queryRawUnsafe<
        Array<{
          totalBookings: number;
          activeReservations: number;
          currentlyRentedCount: number;
          totalRentalRevenue: number;
        }>
      >(
        `SELECT
           COUNT(rb.id)::int AS "totalBookings",
           COALESCE(COUNT(rb.id) FILTER (WHERE rb.status = 'RESERVED'), 0)::int AS "activeReservations",
           COALESCE(COUNT(rb.id) FILTER (WHERE rb.status IN ('PICKED_UP', 'PARTIALLY_RETURNED')), 0)::int AS "currentlyRentedCount",
           COALESCE(SUM(rb.total_rent) FILTER (WHERE rb.status != 'CANCELLED'), 0)::float AS "totalRentalRevenue"
         FROM ${bookings} rb
         WHERE 1=1 ${branchFilter} ${dateFilter}`
      );

      // 2. Physical Units KPIs
      const unitStats = await tx.$queryRawUnsafe<
        Array<{
          currentlyRentedUnits: number;
          availableUnits: number;
          maintenanceUnits: number;
          cleaningUnits: number;
        }>
      >(
        `SELECT
           COALESCE(COUNT(ru.id) FILTER (WHERE ru.status = 'RENTED'), 0)::int AS "currentlyRentedUnits",
           COALESCE(COUNT(ru.id) FILTER (WHERE ru.status = 'AVAILABLE'), 0)::int AS "availableUnits",
           COALESCE(COUNT(ru.id) FILTER (WHERE ru.status = 'MAINTENANCE'), 0)::int AS "maintenanceUnits",
           COALESCE(COUNT(ru.id) FILTER (WHERE ru.status = 'CLEANING'), 0)::int AS "cleaningUnits"
         FROM ${units} ru
         WHERE 1=1 ${unitBranchFilter}`
      );

      // 3. Overdue Units KPI
      const overdueStats = await tx.$queryRawUnsafe<Array<{ overdueUnits: number }>>(
        `SELECT COALESCE(COUNT(rbi.id), 0)::int AS "overdueUnits"
         FROM ${bookingItems} rbi
         JOIN ${bookings} rb ON rb.id = rbi.booking_id
         WHERE rb.status IN ('PICKED_UP', 'PARTIALLY_RETURNED')
           AND CURRENT_DATE > rb.return_date
           AND rbi.return_status != 'RETURNED'
           ${branchFilter}`
      );

      // 4. Additional Charges in Period (Late Fees + Damage Charges)
      const feeStats = await tx.$queryRawUnsafe<
        Array<{ totalLateFees: number; totalDamageCharges: number }>
      >(
        `SELECT
           COALESCE(SUM(rti.late_fee), 0)::float AS "totalLateFees",
           COALESCE(SUM(rti.damage_charge), 0)::float AS "totalDamageCharges"
         FROM ${returnItems} rti
         JOIN ${returns} rr ON rr.id = rti.return_id
         JOIN ${bookings} rb ON rb.id = rr.booking_id
         WHERE 1=1 ${branchFilter} ${dateFilter}`
      );

      const totalLateFees = feeStats[0]?.totalLateFees ?? 0;
      const totalDamageCharges = feeStats[0]?.totalDamageCharges ?? 0;
      const earnedRentalCharges = bookingStats[0]?.totalRentalRevenue ?? 0;
      const totalEarnedRevenue = this.round2(earnedRentalCharges + totalLateFees + totalDamageCharges);

      // 5. Payments, Outstanding Balance & Security Deposits Held
      const payStats = await tx.$queryRawUnsafe<
        Array<{
          totalRentPaid: number;
          totalDepositHeld: number;
          totalRefunded: number;
        }>
      >(
        `SELECT
           COALESCE(SUM(rpa.amount) FILTER (WHERE rpa.allocation_type = 'RENT'), 0)::float AS "totalRentPaid",
           COALESCE(SUM(rpa.amount) FILTER (WHERE rpa.allocation_type = 'SECURITY_DEPOSIT'), 0)::float AS "totalDepositHeld",
           COALESCE(SUM(rpa.amount) FILTER (WHERE rpa.allocation_type IN ('DAMAGE_CHARGE', 'REFUND')), 0)::float AS "totalRefunded"
         FROM ${allocations} rpa
         JOIN ${payments} rp ON rp.id = rpa.payment_id
         JOIN ${bookings} rb ON rb.id = rpa.booking_id
         WHERE rb.status != 'CANCELLED' ${branchFilter} ${dateFilter}`
      );

      const rentPaid = payStats[0]?.totalRentPaid ?? 0;
      const outstandingRentalPayments = Math.max(0, this.round2(totalEarnedRevenue - rentPaid));

      // Net Security Deposits Held
      const depositHeldRows = await tx.$queryRawUnsafe<Array<{ netDepositHeld: number }>>(
        `SELECT GREATEST(0,
           COALESCE(SUM(CASE WHEN rpa.allocation_type = 'SECURITY_DEPOSIT' THEN rpa.amount ELSE 0 END), 0)
           - COALESCE(SUM(CASE WHEN rpa.allocation_type IN ('DAMAGE_CHARGE', 'REFUND') THEN rpa.amount ELSE 0 END), 0)
           - COALESCE((
               SELECT SUM(rf.amount) FROM ${refunds} rf
               JOIN ${bookings} rbf ON rbf.id = rf.booking_id
               WHERE rbf.status IN ('RESERVED', 'PICKED_UP', 'PARTIALLY_RETURNED')
                 ${query?.branchId && query.branchId !== 'all' ? `AND rf.branch_id = '${query.branchId}'::uuid` : ''}
             ), 0)
         )::float AS "netDepositHeld"
         FROM ${allocations} rpa
         JOIN ${bookings} rb ON rb.id = rpa.booking_id
         WHERE rb.status IN ('RESERVED', 'PICKED_UP', 'PARTIALLY_RETURNED')
           ${branchFilter}`
      );

      const securityDepositsHeld = this.round2(depositHeldRows[0]?.netDepositHeld ?? 0);

      return {
        totalBookings: bookingStats[0]?.totalBookings ?? 0,
        activeReservations: bookingStats[0]?.activeReservations ?? 0,
        currentlyRentedUnits: unitStats[0]?.currentlyRentedUnits ?? 0,
        overdueRentalUnits: overdueStats[0]?.overdueUnits ?? 0,
        availableUnits: unitStats[0]?.availableUnits ?? 0,
        rentalRevenue: totalEarnedRevenue,
        outstandingRentalPayments,
        securityDepositsHeld,
        maintenanceUnits: unitStats[0]?.maintenanceUnits ?? 0,
        cleaningUnits: unitStats[0]?.cleaningUnits ?? 0,
      };
    });
  }

  async getUpcomingPickups(schemaName: string, branchId?: string, limit: number = 6) {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const customers = tenantTable(schemaName, 'customers');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const allocations = tenantTable(schemaName, 'rental_payment_allocations');

    const branchFilter = branchId && branchId !== 'all' ? `AND rb.branch_id = '${branchId}'::uuid` : '';

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const rows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          bookingReference: string;
          customerId: string;
          customerName: string;
          customerPhone: string | null;
          customerCode: string;
          pickupDate: string;
          returnDate: string;
          itemCount: number;
          totalRent: number;
          totalDeposit: number;
          rentPaid: number;
          depositPaid: number;
        }>
      >(
        `SELECT
           rb.id,
           rb.booking_reference AS "bookingReference",
           rb.customer_id AS "customerId",
           c.name AS "customerName",
           c.phone AS "customerPhone",
           c.code AS "customerCode",
           rb.pickup_date::text AS "pickupDate",
           rb.return_date::text AS "returnDate",
           COUNT(rbi.id)::int AS "itemCount",
           rb.total_rent::float AS "totalRent",
           rb.total_deposit::float AS "totalDeposit",
           COALESCE((
             SELECT SUM(rpa.amount) FROM ${allocations} rpa
             WHERE rpa.booking_id = rb.id AND rpa.allocation_type = 'RENT'
           ), 0)::float AS "rentPaid",
           COALESCE((
             SELECT SUM(rpa.amount) FROM ${allocations} rpa
             WHERE rpa.booking_id = rb.id AND rpa.allocation_type = 'SECURITY_DEPOSIT'
           ), 0)::float AS "depositPaid"
         FROM ${bookings} rb
         JOIN ${customers} c ON c.id = rb.customer_id
         JOIN ${bookingItems} rbi ON rbi.booking_id = rb.id
         WHERE rb.status = 'RESERVED'
           AND rb.pickup_date >= CURRENT_DATE
           ${branchFilter}
         GROUP BY rb.id, c.name, c.phone, c.code
         ORDER BY rb.pickup_date ASC
         LIMIT $1`,
        limit,
      );

      return rows.map((r) => {
        const isRentPaid = r.rentPaid >= r.totalRent;
        const isDepositPaid = r.depositPaid >= r.totalDeposit;
        let paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' = 'UNPAID';
        if (isRentPaid && isDepositPaid) {
          paymentStatus = 'PAID';
        } else if (r.rentPaid > 0 || r.depositPaid > 0) {
          paymentStatus = 'PARTIALLY_PAID';
        }

        return {
          ...r,
          paymentStatus,
        };
      });
    });
  }

  async getExpectedReturns(schemaName: string, branchId?: string, limit: number = 6) {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const customers = tenantTable(schemaName, 'customers');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');

    const branchFilter = branchId && branchId !== 'all' ? `AND rb.branch_id = '${branchId}'::uuid` : '';

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      return tx.$queryRawUnsafe<
        Array<{
          id: string;
          bookingReference: string;
          customerName: string;
          customerPhone: string | null;
          pickupDate: string;
          returnDate: string;
          totalUnits: number;
          returnedUnits: number;
          outstandingUnits: number;
        }>
      >(
        `SELECT
           rb.id,
           rb.booking_reference AS "bookingReference",
           c.name AS "customerName",
           c.phone AS "customerPhone",
           rb.pickup_date::text AS "pickupDate",
           rb.return_date::text AS "returnDate",
           COUNT(rbi.id)::int AS "totalUnits",
           COALESCE(COUNT(rbi.id) FILTER (WHERE rbi.return_status = 'RETURNED'), 0)::int AS "returnedUnits",
           (COUNT(rbi.id) - COALESCE(COUNT(rbi.id) FILTER (WHERE rbi.return_status = 'RETURNED'), 0))::int AS "outstandingUnits"
         FROM ${bookings} rb
         JOIN ${customers} c ON c.id = rb.customer_id
         JOIN ${bookingItems} rbi ON rbi.booking_id = rb.id
         WHERE rb.status IN ('PICKED_UP', 'PARTIALLY_RETURNED')
           ${branchFilter}
         GROUP BY rb.id, c.name, c.phone
         HAVING (COUNT(rbi.id) - COALESCE(COUNT(rbi.id) FILTER (WHERE rbi.return_status = 'RETURNED'), 0)) > 0
         ORDER BY rb.return_date ASC
         LIMIT $1`,
        limit,
      );
    });
  }

  async getOverdueBookings(schemaName: string, branchId?: string, limit: number = 6) {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const customers = tenantTable(schemaName, 'customers');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');

    const branchFilter = branchId && branchId !== 'all' ? `AND rb.branch_id = '${branchId}'::uuid` : '';

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      return tx.$queryRawUnsafe<
        Array<{
          id: string;
          bookingReference: string;
          customerName: string;
          customerPhone: string | null;
          returnDate: string;
          overdueDays: number;
          outstandingUnits: number;
          totalRent: number;
          totalDeposit: number;
        }>
      >(
        `SELECT
           rb.id,
           rb.booking_reference AS "bookingReference",
           c.name AS "customerName",
           c.phone AS "customerPhone",
           rb.return_date::text AS "returnDate",
           GREATEST(0, (CURRENT_DATE - rb.return_date)::int) AS "overdueDays",
           (COUNT(rbi.id) - COALESCE(COUNT(rbi.id) FILTER (WHERE rbi.return_status = 'RETURNED'), 0))::int AS "outstandingUnits",
           rb.total_rent::float AS "totalRent",
           rb.total_deposit::float AS "totalDeposit"
         FROM ${bookings} rb
         JOIN ${customers} c ON c.id = rb.customer_id
         JOIN ${bookingItems} rbi ON rbi.booking_id = rb.id
         WHERE rb.status IN ('PICKED_UP', 'PARTIALLY_RETURNED')
           AND CURRENT_DATE > rb.return_date
           ${branchFilter}
         GROUP BY rb.id, c.name, c.phone
         HAVING (COUNT(rbi.id) - COALESCE(COUNT(rbi.id) FILTER (WHERE rbi.return_status = 'RETURNED'), 0)) > 0
         ORDER BY rb.return_date ASC
         LIMIT $1`,
        limit,
      );
    });
  }

  async getRecentRentalActivity(schemaName: string, branchId?: string, limit: number = 8) {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const returns = tenantTable(schemaName, 'rental_returns');
    const payments = tenantTable(schemaName, 'rental_payments');
    const customers = tenantTable(schemaName, 'customers');

    const branchFilter = branchId && branchId !== 'all' ? `AND branch_id = '${branchId}'::uuid` : '';

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      return tx.$queryRawUnsafe<
        Array<{
          id: string;
          type: 'BOOKING' | 'PICKUP' | 'RETURN' | 'PAYMENT';
          title: string;
          subtitle: string;
          timestamp: Date;
          referenceNumber: string;
          amount?: number;
        }>
      >(
        `(
           SELECT
             rb.id,
             'BOOKING'::text AS type,
             'Booking Reserved'::text AS title,
             c.name AS subtitle,
             rb.created_at AS timestamp,
             rb.booking_reference AS "referenceNumber",
             rb.total_rent::float AS amount
           FROM ${bookings} rb
           JOIN ${customers} c ON c.id = rb.customer_id
           WHERE 1=1 ${branchFilter}
         )
         UNION ALL
         (
           SELECT
             rb.id,
             'PICKUP'::text AS type,
             'Units Handed Over / Picked Up'::text AS title,
             c.name AS subtitle,
             rb.actual_pickup_at AS timestamp,
             rb.booking_reference AS "referenceNumber",
             NULL::float AS amount
           FROM ${bookings} rb
           JOIN ${customers} c ON c.id = rb.customer_id
           WHERE rb.actual_pickup_at IS NOT NULL ${branchFilter}
         )
         UNION ALL
         (
           SELECT
             rr.id,
             'RETURN'::text AS type,
             'Units Returned & Inspected'::text AS title,
             rr.return_number AS subtitle,
             rr.actual_return_at AS timestamp,
             rr.return_number AS "referenceNumber",
             NULL::float AS amount
           FROM ${returns} rr
           WHERE 1=1 ${branchFilter}
         )
         UNION ALL
         (
           SELECT
             rp.id,
             'PAYMENT'::text AS type,
             'Payment Collected'::text AS title,
             rp.payment_number AS subtitle,
             rp.created_at AS timestamp,
             rp.payment_number AS "referenceNumber",
             rp.amount::float AS amount
           FROM ${payments} rp
           WHERE 1=1 ${branchFilter}
         )
         ORDER BY timestamp DESC
         LIMIT $1`,
        limit,
      );
    });
  }

  async getRentalHistory(schemaName: string, query?: RentalHistoryQueryDto) {
    const { page, limit, offset } = resolvePagination(query?.page, query?.limit);

    const bookings = tenantTable(schemaName, 'rental_bookings');
    const customers = tenantTable(schemaName, 'customers');
    const branches = tenantTable(schemaName, 'branches');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const items = tenantTable(schemaName, 'rental_items');
    const units = tenantTable(schemaName, 'rental_units');
    const allocations = tenantTable(schemaName, 'rental_payment_allocations');
    const payments = tenantTable(schemaName, 'rental_payments');
    const refunds = tenantTable(schemaName, 'rental_refunds');

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let pIdx = 1;

    if (query?.branchId && query.branchId !== 'all') {
      conditions.push(`rb.branch_id = $${pIdx++}::uuid`);
      params.push(query.branchId);
    }

    if (query?.status && query.status !== 'all') {
      conditions.push(`rb.status = $${pIdx++}`);
      params.push(query.status);
    }

    if (query?.startDate) {
      conditions.push(`rb.pickup_date >= $${pIdx++}::date`);
      params.push(query.startDate);
    }

    if (query?.endDate) {
      conditions.push(`rb.pickup_date <= $${pIdx++}::date`);
      params.push(query.endDate);
    }

    if (query?.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      conditions.push(`(
        rb.booking_reference ILIKE $${pIdx} OR
        c.name ILIKE $${pIdx} OR
        c.phone ILIKE $${pIdx} OR
        c.code ILIKE $${pIdx} OR
        EXISTS (
          SELECT 1 FROM ${bookingItems} rbi_s
          JOIN ${items} ri_s ON ri_s.id = rbi_s.rental_item_id
          JOIN ${units} ru_s ON ru_s.id = rbi_s.rental_unit_id
          WHERE rbi_s.booking_id = rb.id AND (ri_s.name ILIKE $${pIdx} OR ru_s.unit_code ILIKE $${pIdx})
        )
      )`);
      params.push(term);
      pIdx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const countRows = await tx.$queryRawUnsafe<Array<{ count: string | number }>>(
        `SELECT COUNT(DISTINCT rb.id) AS count
         FROM ${bookings} rb
         JOIN ${customers} c ON c.id = rb.customer_id
         ${whereClause}`,
        ...params,
      );
      const total = Number(countRows[0]?.count ?? 0);

      const rows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          branchId: string;
          branchName: string;
          customerId: string;
          customerName: string;
          customerPhone: string | null;
          customerCode: string;
          bookingReference: string;
          pickupDate: string;
          returnDate: string;
          status: RentalBookingStatus;
          settlementStatus: string;
          totalRent: number;
          totalDeposit: number;
          totalLateFees: number;
          totalDamageCharges: number;
          actualPickupAt: Date | null;
          rentPaid: number;
          depositPaid: number;
          totalRefunded: number;
          itemCount: number;
          createdAt: Date;
        }>
      >(
        `SELECT
           rb.id,
           rb.branch_id AS "branchId",
           b.name AS "branchName",
           rb.customer_id AS "customerId",
           c.name AS "customerName",
           c.phone AS "customerPhone",
           c.code AS "customerCode",
           rb.booking_reference AS "bookingReference",
           rb.pickup_date::text AS "pickupDate",
           rb.return_date::text AS "returnDate",
           rb.status,
           rb.settlement_status AS "settlementStatus",
           rb.total_rent::float AS "totalRent",
           rb.total_deposit::float AS "totalDeposit",
           rb.total_late_fees::float AS "totalLateFees",
           rb.total_damage_charges::float AS "totalDamageCharges",
           rb.actual_pickup_at AS "actualPickupAt",
           COALESCE((
             SELECT SUM(rpa.amount) FROM ${allocations} rpa
             WHERE rpa.booking_id = rb.id AND rpa.allocation_type = 'RENT'
           ), 0)::float AS "rentPaid",
           COALESCE((
             SELECT SUM(rpa.amount) FROM ${allocations} rpa
             WHERE rpa.booking_id = rb.id AND rpa.allocation_type = 'SECURITY_DEPOSIT'
           ), 0)::float AS "depositPaid",
           COALESCE((
             SELECT SUM(rf.amount) FROM ${refunds} rf
             WHERE rf.booking_id = rb.id
           ), 0)::float AS "totalRefunded",
           COUNT(rbi.id)::int AS "itemCount",
           rb.created_at AS "createdAt"
         FROM ${bookings} rb
         JOIN ${customers} c ON c.id = rb.customer_id
         JOIN ${branches} b ON b.id = rb.branch_id
         JOIN ${bookingItems} rbi ON rbi.booking_id = rb.id
         ${whereClause}
         GROUP BY rb.id, b.name, c.name, c.phone, c.code
         ORDER BY rb.created_at DESC
         LIMIT $${pIdx++} OFFSET $${pIdx++}`,
        ...params,
        limit,
        offset,
      );

      // Fetch items for the page
      const bookingIds = rows.map((r) => r.id);
      let itemsByBooking: Record<string, any[]> = {};

      if (bookingIds.length > 0) {
        const itemRows = await tx.$queryRawUnsafe<
          Array<{
            bookingId: string;
            itemName: string;
            itemCode: string;
            unitCode: string;
            unitNumber: number;
            rentPrice: number;
            deposit: number;
            returnStatus: string;
            conditionOut: string | null;
            conditionIn: string | null;
          }>
        >(
          `SELECT
             rbi.booking_id AS "bookingId",
             ri.name AS "itemName",
             ri.code AS "itemCode",
             ru.unit_code AS "unitCode",
             ru.unit_number AS "unitNumber",
             rbi.rent_price::float AS "rentPrice",
             rbi.deposit::float AS "deposit",
             rbi.return_status AS "returnStatus",
             rbi.condition_out AS "conditionOut",
             rbi.condition_in AS "conditionIn"
           FROM ${bookingItems} rbi
           JOIN ${items} ri ON ri.id = rbi.rental_item_id
           JOIN ${units} ru ON ru.id = rbi.rental_unit_id
           WHERE rbi.booking_id = ANY($1::uuid[])`,
          bookingIds,
        );

        for (const it of itemRows) {
          if (!itemsByBooking[it.bookingId]) itemsByBooking[it.bookingId] = [];
          itemsByBooking[it.bookingId].push(it);
        }
      }

      const enrichedRows = rows.map((r) => {
        const totalCharges = this.round2(r.totalRent + r.totalLateFees + r.totalDamageCharges);
        const netBalance = Math.max(0, this.round2(totalCharges - r.rentPaid));

        let paymentStatus = 'UNPAID';
        if (netBalance === 0) {
          paymentStatus = 'PAID';
        } else if (r.rentPaid > 0) {
          paymentStatus = 'PARTIAL';
        }

        return {
          ...r,
          totalCharges,
          netBalance,
          paymentStatus,
          items: itemsByBooking[r.id] || [],
        };
      });

      return buildPaginatedResponse(enrichedRows, total, page, limit);
    });
  }

  async getCustomerRentalHistory(schemaName: string, customerId: string) {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const customers = tenantTable(schemaName, 'customers');
    const branches = tenantTable(schemaName, 'branches');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const items = tenantTable(schemaName, 'rental_items');
    const units = tenantTable(schemaName, 'rental_units');
    const allocations = tenantTable(schemaName, 'rental_payment_allocations');
    const payments = tenantTable(schemaName, 'rental_payments');
    const refunds = tenantTable(schemaName, 'rental_refunds');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      // 1. Customer Info
      const custRows = await tx.$queryRawUnsafe<
        Array<{ id: string; name: string; phone: string | null; email: string | null; customerCode: string }>
      >(
        `SELECT id, name, phone, email, code AS "customerCode"
         FROM ${customers} WHERE id = $1::uuid`,
        customerId,
      );

      if (custRows.length === 0) {
        throw new NotFoundException(`Customer with ID ${customerId} was not found`);
      }
      const customer = custRows[0];

      // 2. Customer Aggregates
      const aggRows = await tx.$queryRawUnsafe<
        Array<{
          totalBookings: number;
          totalSpent: number;
          totalRefunded: number;
          activeRentalsCount: number;
        }>
      >(
        `SELECT
           COUNT(rb.id)::int AS "totalBookings",
           COALESCE(SUM(rb.total_rent) FILTER (WHERE rb.status != 'CANCELLED'), 0)::float AS "totalSpent",
           COALESCE((
             SELECT SUM(rf.amount) FROM ${refunds} rf
             JOIN ${bookings} rb2 ON rb2.id = rf.booking_id
             WHERE rb2.customer_id = $1::uuid
           ), 0)::float AS "totalRefunded",
           COALESCE(COUNT(rb.id) FILTER (WHERE rb.status IN ('RESERVED', 'PICKED_UP', 'PARTIALLY_RETURNED')), 0)::int AS "activeRentalsCount"
         FROM ${bookings} rb
         WHERE rb.customer_id = $1::uuid`,
        customerId,
      );

      // 3. Complete Bookings List for customer
      const bookingRows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          bookingReference: string;
          branchName: string;
          pickupDate: string;
          returnDate: string;
          status: string;
          settlementStatus: string;
          totalRent: number;
          totalDeposit: number;
          totalLateFees: number;
          totalDamageCharges: number;
          rentPaid: number;
          depositPaid: number;
          createdAt: Date;
        }>
      >(
        `SELECT
           rb.id,
           rb.booking_reference AS "bookingReference",
           b.name AS "branchName",
           rb.pickup_date::text AS "pickupDate",
           rb.return_date::text AS "returnDate",
           rb.status,
           rb.settlement_status AS "settlementStatus",
           rb.total_rent::float AS "totalRent",
           rb.total_deposit::float AS "totalDeposit",
           rb.total_late_fees::float AS "totalLateFees",
           rb.total_damage_charges::float AS "totalDamageCharges",
           COALESCE((
             SELECT SUM(rpa.amount) FROM ${allocations} rpa
             WHERE rpa.booking_id = rb.id AND rpa.allocation_type = 'RENT'
           ), 0)::float AS "rentPaid",
           COALESCE((
             SELECT SUM(rpa.amount) FROM ${allocations} rpa
             WHERE rpa.booking_id = rb.id AND rpa.allocation_type = 'SECURITY_DEPOSIT'
           ), 0)::float AS "depositPaid",
           rb.created_at AS "createdAt"
         FROM ${bookings} rb
         JOIN ${branches} b ON b.id = rb.branch_id
         WHERE rb.customer_id = $1::uuid
         ORDER BY rb.created_at DESC`,
        customerId,
      );

      return {
        customer,
        summary: aggRows[0] || {
          totalBookings: 0,
          totalSpent: 0,
          totalRefunded: 0,
          activeRentalsCount: 0,
        },
        bookings: bookingRows,
      };
    });
  }

  async getUnitRentalHistory(schemaName: string, unitId: string) {
    const units = tenantTable(schemaName, 'rental_units');
    const items = tenantTable(schemaName, 'rental_items');
    const branches = tenantTable(schemaName, 'branches');
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const customers = tenantTable(schemaName, 'customers');
    const returnItems = tenantTable(schemaName, 'rental_return_items');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      // 1. Physical Unit details
      const unitRows = await tx.$queryRawUnsafe<
        Array<{
          id: string;
          unitCode: string;
          unitNumber: number;
          status: string;
          branchName: string;
          itemId: string;
          itemName: string;
          itemCode: string;
          category: string;
          rentPrice: number;
          deposit: number;
        }>
      >(
        `SELECT
           ru.id,
           ru.unit_code AS "unitCode",
           ru.unit_number AS "unitNumber",
           ru.status,
           b.name AS "branchName",
           ri.id AS "itemId",
           ri.name AS "itemName",
           ri.code AS "itemCode",
           ri.category,
           ri.rent_price::float AS "rentPrice",
           ri.deposit::float AS "deposit"
         FROM ${units} ru
         JOIN ${items} ri ON ri.id = ru.rental_item_id
         JOIN ${branches} b ON b.id = ru.branch_id
         WHERE ru.id = $1::uuid`,
        unitId,
      );

      if (unitRows.length === 0) {
        throw new NotFoundException(`Rental unit with ID ${unitId} was not found`);
      }
      const unit = unitRows[0];

      // 2. Unit Rental History Log
      const historyRows = await tx.$queryRawUnsafe<
        Array<{
          bookingId: string;
          bookingReference: string;
          customerName: string;
          customerPhone: string | null;
          pickupDate: string;
          returnDate: string;
          actualPickupAt: Date | null;
          returnedAt: Date | null;
          conditionOut: string | null;
          conditionIn: string | null;
          inspectionNotes: string | null;
          lateFee: number;
          damageCharge: number;
          requiresMaintenance: boolean;
          bookingStatus: string;
        }>
      >(
        `SELECT
           rb.id AS "bookingId",
           rb.booking_reference AS "bookingReference",
           c.name AS "customerName",
           c.phone AS "customerPhone",
           rb.pickup_date::text AS "pickupDate",
           rb.return_date::text AS "returnDate",
           rb.actual_pickup_at AS "actualPickupAt",
           rbi.returned_at AS "returnedAt",
           rbi.condition_out AS "conditionOut",
           rbi.condition_in AS "conditionIn",
           rti.inspection_notes AS "inspectionNotes",
           COALESCE(rti.late_fee, 0)::float AS "lateFee",
           COALESCE(rti.damage_charge, 0)::float AS "damageCharge",
           COALESCE(rti.requires_maintenance, false) AS "requiresMaintenance",
           rb.status AS "bookingStatus"
         FROM ${bookingItems} rbi
         JOIN ${bookings} rb ON rb.id = rbi.booking_id
         JOIN ${customers} c ON c.id = rb.customer_id
         LEFT JOIN ${returnItems} rti ON rti.booking_item_id = rbi.id
         WHERE rbi.rental_unit_id = $1::uuid
         ORDER BY rb.pickup_date DESC`,
        unitId,
      );

      return {
        unit,
        totalRentalsCount: historyRows.length,
        history: historyRows,
      };
    });
  }

  async getRentalReportsSummary(schemaName: string, query?: RentalReportsQueryDto) {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const units = tenantTable(schemaName, 'rental_units');
    const payments = tenantTable(schemaName, 'rental_payments');
    const allocations = tenantTable(schemaName, 'rental_payment_allocations');
    const returnItems = tenantTable(schemaName, 'rental_return_items');
    const returns = tenantTable(schemaName, 'rental_returns');
    const refunds = tenantTable(schemaName, 'rental_refunds');

    const branchFilter = query?.branchId && query.branchId !== 'all' ? `AND rb.branch_id = '${query.branchId}'::uuid` : '';
    const unitBranchFilter = query?.branchId && query.branchId !== 'all' ? `AND ru.branch_id = '${query.branchId}'::uuid` : '';

    const dateFilter = [
      query?.startDate ? `rb.pickup_date >= '${query.startDate}'::date` : null,
      query?.endDate ? `rb.pickup_date <= '${query.endDate}'::date` : null,
    ].filter(Boolean).map((c) => `AND ${c}`).join(' ');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      // 1. Total Rentals (Confirmed vs Cancelled)
      const rentalCounts = await tx.$queryRawUnsafe<
        Array<{
          totalBookings: number;
          confirmedBookings: number;
          cancelledBookings: number;
          totalRentRevenue: number;
        }>
      >(
        `SELECT
           COUNT(rb.id)::int AS "totalBookings",
           COALESCE(COUNT(rb.id) FILTER (WHERE rb.status != 'CANCELLED'), 0)::int AS "confirmedBookings",
           COALESCE(COUNT(rb.id) FILTER (WHERE rb.status = 'CANCELLED'), 0)::int AS "cancelledBookings",
           COALESCE(SUM(rb.total_rent) FILTER (WHERE rb.status != 'CANCELLED'), 0)::float AS "totalRentRevenue"
         FROM ${bookings} rb
         WHERE 1=1 ${branchFilter} ${dateFilter}`
      );

      // 2. Late fees & Damage charges
      const feeRows = await tx.$queryRawUnsafe<
        Array<{ totalLateFees: number; totalDamageCharges: number }>
      >(
        `SELECT
           COALESCE(SUM(rti.late_fee), 0)::float AS "totalLateFees",
           COALESCE(SUM(rti.damage_charge), 0)::float AS "totalDamageCharges"
         FROM ${returnItems} rti
         JOIN ${returns} rr ON rr.id = rti.return_id
         JOIN ${bookings} rb ON rb.id = rr.booking_id
         WHERE 1=1 ${branchFilter} ${dateFilter}`
      );

      const totalLateFees = feeRows[0]?.totalLateFees ?? 0;
      const totalDamageCharges = feeRows[0]?.totalDamageCharges ?? 0;
      const rentalCharges = rentalCounts[0]?.totalRentRevenue ?? 0;
      const rentalRevenue = this.round2(rentalCharges + totalLateFees + totalDamageCharges);

      // 3. Cash collected & refunds
      const payRows = await tx.$queryRawUnsafe<
        Array<{
          cashCollected: number;
          rentPaid: number;
          depositCollected: number;
        }>
      >(
        `SELECT
           COALESCE(SUM(rp.amount), 0)::float AS "cashCollected",
           COALESCE(SUM(rpa.amount) FILTER (WHERE rpa.allocation_type = 'RENT'), 0)::float AS "rentPaid",
           COALESCE(SUM(rpa.amount) FILTER (WHERE rpa.allocation_type = 'SECURITY_DEPOSIT'), 0)::float AS "depositCollected"
         FROM ${payments} rp
         JOIN ${bookings} rb ON rb.id = rp.booking_id
         LEFT JOIN ${allocations} rpa ON rpa.payment_id = rp.id
         WHERE rb.status != 'CANCELLED' ${branchFilter} ${dateFilter}`
      );

      const refundRows = await tx.$queryRawUnsafe<
        Array<{ depositRefunded: number }>
      >(
        `SELECT COALESCE(SUM(rf.amount), 0)::float AS "depositRefunded"
         FROM ${refunds} rf
         JOIN ${bookings} rb ON rb.id = rf.booking_id
         WHERE 1=1 ${branchFilter} ${dateFilter}`
      );

      const cashCollected = payRows[0]?.cashCollected ?? 0;
      const rentPaid = payRows[0]?.rentPaid ?? 0;
      const depositsRefunded = refundRows[0]?.depositRefunded ?? 0;
      const outstandingReceivables = Math.max(0, this.round2(rentalRevenue - rentPaid));

      // 4. Physical unit counts
      const unitCounts = await tx.$queryRawUnsafe<
        Array<{
          currentlyRentedCount: number;
          availableItemsCount: number;
          overdueItemsCount: number;
        }>
      >(
        `SELECT
           COALESCE(COUNT(ru.id) FILTER (WHERE ru.status = 'RENTED'), 0)::int AS "currentlyRentedCount",
           COALESCE(COUNT(ru.id) FILTER (WHERE ru.status = 'AVAILABLE'), 0)::int AS "availableItemsCount",
           COALESCE((
             SELECT COUNT(rbi.id) FROM ${bookingItems} rbi
             JOIN ${bookings} rb ON rb.id = rbi.booking_id
             WHERE rb.status IN ('PICKED_UP', 'PARTIALLY_RETURNED')
               AND CURRENT_DATE > rb.return_date
               AND rbi.return_status != 'RETURNED'
               ${branchFilter}
           ), 0)::int AS "overdueItemsCount"
         FROM ${units} ru
         WHERE 1=1 ${unitBranchFilter}`
      );

      return {
        totalRentals: rentalCounts[0]?.totalBookings ?? 0,
        confirmedBookings: rentalCounts[0]?.confirmedBookings ?? 0,
        cancelledBookings: rentalCounts[0]?.cancelledBookings ?? 0,
        rentalRevenue,
        rentalCharges,
        totalLateFees,
        totalDamageCharges,
        cashCollected,
        depositsRefunded,
        outstandingReceivables,
        currentlyRentedCount: unitCounts[0]?.currentlyRentedCount ?? 0,
        availableItemsCount: unitCounts[0]?.availableItemsCount ?? 0,
        overdueItemsCount: unitCounts[0]?.overdueItemsCount ?? 0,
      };
    });
  }

  async getRentalActivityTrend(schemaName: string, query?: RentalReportsQueryDto) {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const returns = tenantTable(schemaName, 'rental_returns');

    const branchFilter = query?.branchId && query.branchId !== 'all' ? `AND branch_id = '${query.branchId}'::uuid` : '';
    const dateFilter = [
      query?.startDate ? `created_at >= '${query.startDate}'::date` : null,
      query?.endDate ? `created_at <= '${query.endDate}'::date` : null,
    ].filter(Boolean).map((c) => `AND ${c}`).join(' ');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      return tx.$queryRawUnsafe<
        Array<{
          date: string;
          confirmedBookings: number;
          cancelledBookings: number;
          pickedUpCount: number;
        }>
      >(
        `SELECT
           TO_CHAR(created_at, 'YYYY-MM-DD') AS date,
           COALESCE(COUNT(*) FILTER (WHERE status != 'CANCELLED'), 0)::int AS "confirmedBookings",
           COALESCE(COUNT(*) FILTER (WHERE status = 'CANCELLED'), 0)::int AS "cancelledBookings",
           COALESCE(COUNT(*) FILTER (WHERE status IN ('PICKED_UP', 'PARTIALLY_RETURNED', 'RETURNED')), 0)::int AS "pickedUpCount"
         FROM ${bookings}
         WHERE 1=1 ${branchFilter} ${dateFilter}
         GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
         ORDER BY date ASC
         LIMIT 31`
      );
    });
  }

  async getRentalRevenueTrend(schemaName: string, query?: RentalReportsQueryDto) {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const returns = tenantTable(schemaName, 'rental_returns');
    const returnItems = tenantTable(schemaName, 'rental_return_items');
    const payments = tenantTable(schemaName, 'rental_payments');

    const branchFilter = query?.branchId && query.branchId !== 'all' ? `AND rb.branch_id = '${query.branchId}'::uuid` : '';
    const dateFilter = [
      query?.startDate ? `rb.created_at >= '${query.startDate}'::date` : null,
      query?.endDate ? `rb.created_at <= '${query.endDate}'::date` : null,
    ].filter(Boolean).map((c) => `AND ${c}`).join(' ');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      return tx.$queryRawUnsafe<
        Array<{
          date: string;
          rentalCharges: number;
          additionalFees: number;
          totalRevenue: number;
        }>
      >(
        `SELECT
           TO_CHAR(rb.created_at, 'YYYY-MM-DD') AS date,
           COALESCE(SUM(rb.total_rent) FILTER (WHERE rb.status != 'CANCELLED'), 0)::float AS "rentalCharges",
           COALESCE(SUM(rb.total_late_fees + rb.total_damage_charges), 0)::float AS "additionalFees",
           COALESCE(SUM(rb.total_rent + rb.total_late_fees + rb.total_damage_charges) FILTER (WHERE rb.status != 'CANCELLED'), 0)::float AS "totalRevenue"
         FROM ${bookings} rb
         WHERE 1=1 ${branchFilter} ${dateFilter}
         GROUP BY TO_CHAR(rb.created_at, 'YYYY-MM-DD')
         ORDER BY date ASC
         LIMIT 31`
      );
    });
  }

  async getRentalCategoryBreakdown(schemaName: string, query?: RentalReportsQueryDto) {
    const bookings = tenantTable(schemaName, 'rental_bookings');
    const bookingItems = tenantTable(schemaName, 'rental_booking_items');
    const items = tenantTable(schemaName, 'rental_items');

    const branchFilter = query?.branchId && query.branchId !== 'all' ? `AND rb.branch_id = '${query.branchId}'::uuid` : '';
    const dateFilter = [
      query?.startDate ? `rb.pickup_date >= '${query.startDate}'::date` : null,
      query?.endDate ? `rb.pickup_date <= '${query.endDate}'::date` : null,
    ].filter(Boolean).map((c) => `AND ${c}`).join(' ');

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const rows = await tx.$queryRawUnsafe<
        Array<{
          category: string;
          bookingCount: number;
          unitsRented: number;
          rentalRevenue: number;
        }>
      >(
        `SELECT
           ri.category,
           COUNT(DISTINCT rb.id)::int AS "bookingCount",
           COUNT(rbi.id)::int AS "unitsRented",
           COALESCE(SUM(rbi.rent_price), 0)::float AS "rentalRevenue"
         FROM ${bookingItems} rbi
         JOIN ${bookings} rb ON rb.id = rbi.booking_id
         JOIN ${items} ri ON ri.id = rbi.rental_item_id
         WHERE rb.status != 'CANCELLED' ${branchFilter} ${dateFilter}
         GROUP BY ri.category
         ORDER BY "rentalRevenue" DESC`
      );

      const totalRevenue = rows.reduce((sum, r) => sum + r.rentalRevenue, 0);

      return rows.map((r) => ({
        ...r,
        percentage: totalRevenue > 0 ? Math.round((r.rentalRevenue / totalRevenue) * 100) : 0,
      }));
    });
  }

  async getRentalUnitStatusDistribution(schemaName: string, branchId?: string) {
    const units = tenantTable(schemaName, 'rental_units');
    const branchFilter = branchId && branchId !== 'all' ? `WHERE branch_id = '${branchId}'::uuid` : '';

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const rows = await tx.$queryRawUnsafe<
        Array<{ status: string; count: number }>
      >(
        `SELECT status, COUNT(*)::int AS count
         FROM ${units}
         ${branchFilter}
         GROUP BY status`
      );

      const total = rows.reduce((sum, r) => sum + r.count, 0);

      const allStatuses = ['AVAILABLE', 'RESERVED', 'RENTED', 'CLEANING', 'MAINTENANCE', 'INACTIVE'];
      return allStatuses.map((st) => {
        const found = rows.find((r) => r.status === st);
        const count = found ? found.count : 0;
        return {
          status: st,
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        };
      });
    });
  }

  async exportRentalReportCsv(
    schemaName: string,
    query?: RentalReportsQueryDto & { reportType?: string },
  ) {
    const reportType = query?.reportType || 'bookings';

    if (reportType === 'revenue') {
      const revData = await this.getRentalRevenueTrend(schemaName, query);
      const headers = ['Date', 'Rental Charges (LKR)', 'Additional Fees (LKR)', 'Total Revenue (LKR)'];
      const lines = revData.map((d) => [d.date, d.rentalCharges, d.additionalFees, d.totalRevenue].join(','));
      return [headers.join(','), ...lines].join('\n');
    }

    if (reportType === 'categories') {
      const catData = await this.getRentalCategoryBreakdown(schemaName, query);
      const headers = ['Category', 'Bookings Count', 'Units Rented', 'Rental Revenue (LKR)', 'Share (%)'];
      const lines = catData.map((d) => [d.category, d.bookingCount, d.unitsRented, d.rentalRevenue, d.percentage].join(','));
      return [headers.join(','), ...lines].join('\n');
    }

    // Default: Bookings
    const histData = await this.getRentalHistory(schemaName, {
      branchId: query?.branchId,
      startDate: query?.startDate,
      endDate: query?.endDate,
      limit: 100,
    });
    const headers = [
      'Booking Reference',
      'Customer',
      'Phone',
      'Branch',
      'Pickup Date',
      'Return Date',
      'Status',
      'Rental Total (LKR)',
      'Deposit (LKR)',
      'Rent Paid (LKR)',
      'Outstanding Balance (LKR)',
    ];
    const lines = histData.data.map((b: any) =>
      [
        b.bookingReference,
        `"${b.customerName}"`,
        b.customerPhone || '',
        `"${b.branchName}"`,
        b.pickupDate,
        b.returnDate,
        b.status,
        b.totalRent,
        b.totalDeposit,
        b.rentPaid,
        b.netBalance,
      ].join(','),
    );
    return [headers.join(','), ...lines].join('\n');
  }



  /**
   * Resolve public frontend base URL
   */
  getBaseCatalogUrl(): string {
    const configured = this.configService?.get<string>('FRONTEND_URL')?.trim();
    if (configured) {
      return configured.replace(/\/$/, '');
    }
    return 'http://localhost:5173';
  }

  buildCatalogUrl(shareToken: string): string {
    return `${this.getBaseCatalogUrl()}/rentals/catalog/${shareToken}`;
  }

  /**
   * Preview items for catalog creation (sanitized active items only)
   */
  async previewCatalogItems(schemaName: string, dto: PreviewRentalCatalogQueryDto) {
    const items = tenantTable(schemaName, 'rental_items');
    const categories = tenantTable(schemaName, 'rental_categories');

    const conditions: string[] = ["ri.status = 'ACTIVE'"];
    const params: unknown[] = [];
    let idx = 1;

    if (dto.branchId && dto.branchId !== 'all') {
      conditions.push(`(ri.branch_id = $${idx++}::uuid OR ri.branch_id IS NULL)`);
      params.push(dto.branchId);
    }

    if (dto.selectionType === 'CATEGORY') {
      if (dto.categoryName) {
        conditions.push(`ri.category::text = $${idx++}`);
        params.push(dto.categoryName);
      } else if (dto.categoryId) {
        conditions.push(`EXISTS (SELECT 1 FROM ${categories} c WHERE c.id = $${idx++}::uuid AND (c.name = ri.category::text OR c.code = ri.category::text))`);
        params.push(dto.categoryId);
      }
    } else if (dto.selectionType === 'SELECTED_ITEMS') {
      const itemIds = Array.isArray(dto.selectedItemIds) ? dto.selectedItemIds.filter(Boolean) : [];
      if (itemIds.length === 0) {
        return { items: [], total: 0 };
      }
      conditions.push(`ri.id = ANY($${idx++}::uuid[])`);
      params.push(itemIds);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    return this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
      const rows = await tx.$queryRawUnsafe<Array<{
        id: string;
        code: string;
        name: string;
        category: string;
        size: string | null;
        color: string | null;
        rentPrice: number;
        deposit: number;
        imageUrl: string | null;
        notes: string | null;
      }>>(
        `SELECT
            ri.id,
            ri.code,
            ri.name,
            ri.category::text AS category,
            ri.size,
            ri.color,
            ri.rent_price::float AS "rentPrice",
            ri.deposit::float AS deposit,
            ri.image_url AS "imageUrl",
            ri.notes
         FROM ${items} ri
         LEFT JOIN ${categories} rc ON (rc.name = ri.category::text OR rc.code = ri.category::text)
         ${whereClause}
           AND (rc.id IS NULL OR rc.is_active = TRUE)
         ORDER BY ri.name ASC`,
        ...params,
      );

      return {
        items: rows,
        total: rows.length,
      };
    });
  }

  /**
   * Create a new shareable rental catalog
   */
  async createCatalogShare(
    tenantId: string,
    schemaName: string,
    dto: CreateRentalCatalogShareDto,
    userId?: string,
    userName?: string,
  ) {
    if (!this.prisma) {
      throw new BadRequestException('Database client not available');
    }

    if (dto.selectionType === 'SELECTED_ITEMS') {
      if (!Array.isArray(dto.selectedItemIds) || dto.selectedItemIds.length === 0) {
        throw new BadRequestException('Please select at least one rental item to share');
      }
    }

    let defaultPhone = dto.contactPhone?.trim() || null;
    let defaultEmail = dto.contactEmail?.trim() || null;

    if (!defaultPhone || !defaultEmail) {
      if (dto.branchId) {
        const branches = tenantTable(schemaName, 'branches');
        const branchRows = await this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
          return tx.$queryRawUnsafe<Array<{ phone: string | null; email: string | null }>>(
            `SELECT phone, email FROM ${branches} WHERE id = $1::uuid LIMIT 1`,
            dto.branchId,
          );
        });
        if (branchRows.length > 0) {
          if (!defaultPhone && branchRows[0].phone) defaultPhone = branchRows[0].phone;
          if (!defaultEmail && branchRows[0].email) defaultEmail = branchRows[0].email;
        }
      }

      if (!defaultPhone || !defaultEmail) {
        const tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { phone: true, email: true },
        });
        if (tenant) {
          if (!defaultPhone && tenant.phone) defaultPhone = tenant.phone;
          if (!defaultEmail && tenant.email) defaultEmail = tenant.email;
        }
      }
    }

    let categoryName = dto.categoryName?.trim() || null;
    if (dto.selectionType === 'CATEGORY' && dto.categoryId && !categoryName) {
      const cats = tenantTable(schemaName, 'rental_categories');
      const catRows = await this.tenantSchemaService.withTenantSchema(schemaName, async ({ tx }) => {
        return tx.$queryRawUnsafe<Array<{ name: string }>>(
          `SELECT name FROM ${cats} WHERE id = $1::uuid LIMIT 1`,
          dto.categoryId,
        );
      });
      if (catRows.length > 0) {
        categoryName = catRows[0].name;
      }
    }

    const shareToken = randomBytes(24).toString('hex');
    const days = dto.expiresInDays && dto.expiresInDays > 0 ? dto.expiresInDays : 30;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const share = await this.prisma.rentalCatalogShare.create({
      data: {
        tenantId,
        schemaName,
        branchId: dto.branchId || null,
        title: dto.title.trim(),
        shareToken,
        selectionType: dto.selectionType,
        categoryId: dto.categoryId || null,
        categoryName,
        selectedItemIds: dto.selectedItemIds ?? undefined,
        showPrices: dto.showPrices ?? true,
        contactPhone: defaultPhone,
        contactEmail: defaultEmail,
        notes: dto.notes?.trim() || null,
        createdBy: userId || null,
        createdByName: userName || null,
        expiresAt,
      },
    });

    const shareUrl = this.buildCatalogUrl(shareToken);

    return {
      ...share,
      shareUrl,
    };
  }

  /**
   * List rental catalog shares for a tenant
   */
  async listCatalogShares(tenantId: string, query?: ListRentalCatalogSharesQueryDto) {
    if (!this.prisma) {
      throw new BadRequestException('Database client not available');
    }

    const page = query?.page ? Math.max(1, Number(query.page)) : 1;
    const limit = query?.limit ? Math.min(100, Math.max(1, Number(query.limit))) : 15;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (query?.branchId && query.branchId !== 'all') {
      where.branchId = query.branchId;
    }

    const now = new Date();
    if (query?.status === 'ACTIVE') {
      where.revokedAt = null;
      where.OR = [{ expiresAt: null }, { expiresAt: { gt: now } }];
    } else if (query?.status === 'REVOKED') {
      where.revokedAt = { not: null };
    } else if (query?.status === 'EXPIRED') {
      where.revokedAt = null;
      where.expiresAt = { lte: now };
    }

    const [total, records] = await Promise.all([
      this.prisma.rentalCatalogShare.count({ where }),
      this.prisma.rentalCatalogShare.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data = records.map((r) => {
      let isExpired = false;
      let isRevoked = Boolean(r.revokedAt);
      if (r.expiresAt && r.expiresAt <= now) {
        isExpired = true;
      }

      let status = 'ACTIVE';
      if (isRevoked) status = 'REVOKED';
      else if (isExpired) status = 'EXPIRED';

      return {
        ...r,
        status,
        shareUrl: this.buildCatalogUrl(r.shareToken),
      };
    });

    return buildPaginatedResponse(data, total, page, limit);
  }

  /**
   * Revoke an active catalog share
   */
  async revokeCatalogShare(tenantId: string, shareId: string, userId?: string) {
    if (!this.prisma) {
      throw new BadRequestException('Database client not available');
    }

    const share = await this.prisma.rentalCatalogShare.findFirst({
      where: { id: shareId, tenantId },
    });

    if (!share) {
      throw new NotFoundException('Rental catalog share not found');
    }

    if (share.revokedAt) {
      return {
        message: 'Catalog is already revoked',
        share: {
          ...share,
          status: 'REVOKED',
          shareUrl: this.buildCatalogUrl(share.shareToken),
        },
      };
    }

    const updated = await this.prisma.rentalCatalogShare.update({
      where: { id: shareId },
      data: { revokedAt: new Date() },
    });

    return {
      message: 'Rental catalog share revoked successfully',
      share: {
        ...updated,
        status: 'REVOKED',
        shareUrl: this.buildCatalogUrl(updated.shareToken),
      },
    };
  }

  /**
   * Public retrieval of a rental catalog by shareToken (unauthenticated, safe)
   */
  async getPublicCatalog(shareToken: string) {
    if (!this.prisma) {
      throw new BadRequestException('Database client not available');
    }

    const share = await this.prisma.rentalCatalogShare.findUnique({
      where: { shareToken },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            phone: true,
            email: true,
            status: true,
            primaryColor: true,
          },
        },
      },
    });

    if (!share) {
      throw new NotFoundException('Rental catalog not found or invalid link');
    }

    const now = new Date();
    if (share.revokedAt) {
      return {
        status: 'REVOKED',
        message: 'This catalog link has been deactivated by the salon.',
        salon: {
          name: share.tenant.name,
          logoUrl: share.tenant.logoUrl,
          primaryColor: share.tenant.primaryColor,
        },
      };
    }

    if (share.expiresAt && share.expiresAt <= now) {
      return {
        status: 'EXPIRED',
        message: 'This rental catalog link has expired. Please contact the salon for an updated catalog.',
        salon: {
          name: share.tenant.name,
          logoUrl: share.tenant.logoUrl,
          primaryColor: share.tenant.primaryColor,
          phone: share.contactPhone || share.tenant.phone,
        },
      };
    }

    if (share.tenant.status !== 'ACTIVE') {
      throw new NotFoundException('Catalog is currently unavailable');
    }

    const hasRentals = await this.prisma.tenantFeature.findFirst({
      where: {
        tenantId: share.tenantId,
        isEnabled: true,
        feature: { code: 'RENTALS', status: 'ACTIVE' },
      },
    });

    if (!hasRentals) {
      throw new NotFoundException('Rental catalog service is currently disabled for this salon');
    }

    let branchInfo: { name: string; phone: string | null; email: string | null; address: string | null } | null = null;
    if (share.branchId) {
      const branches = tenantTable(share.schemaName, 'branches');
      const branchRows = await this.tenantSchemaService.withTenantSchema(share.schemaName, async ({ tx }) => {
        return tx.$queryRawUnsafe<Array<{ name: string; phone: string | null; email: string | null; address: string | null }>>(
          `SELECT name, phone, email, address FROM ${branches} WHERE id = $1::uuid LIMIT 1`,
          share.branchId,
        );
      });
      if (branchRows.length > 0) {
        branchInfo = branchRows[0];
      }
    }

    const itemsTable = tenantTable(share.schemaName, 'rental_items');
    const categoriesTable = tenantTable(share.schemaName, 'rental_categories');

    const conditions: string[] = ["ri.status = 'ACTIVE'"];
    const params: unknown[] = [];
    let idx = 1;

    if (share.selectionType === 'CATEGORY' && share.categoryName) {
      conditions.push(`ri.category::text = $${idx++}`);
      params.push(share.categoryName);
    } else if (share.selectionType === 'SELECTED_ITEMS') {
      const selectedIds = Array.isArray(share.selectedItemIds)
        ? (share.selectedItemIds as string[])
        : typeof share.selectedItemIds === 'string'
        ? JSON.parse(share.selectedItemIds as string)
        : [];
      if (selectedIds.length === 0) {
        return {
          status: 'ACTIVE',
          catalog: {
            id: share.id,
            title: share.title,
            shareToken: share.shareToken,
            selectionType: share.selectionType,
            categoryName: share.categoryName,
            showPrices: share.showPrices,
            notes: share.notes,
            createdAt: share.createdAt,
            expiresAt: share.expiresAt,
          },
          salon: {
            name: share.tenant.name,
            logoUrl: share.tenant.logoUrl,
            primaryColor: share.tenant.primaryColor,
            phone: share.contactPhone || branchInfo?.phone || share.tenant.phone || null,
            email: share.contactEmail || branchInfo?.email || share.tenant.email || null,
            branchName: branchInfo?.name || null,
            branchAddress: branchInfo?.address || null,
          },
          items: [],
          categories: [],
          totalItems: 0,
        };
      }
      conditions.push(`ri.id = ANY($${idx++}::uuid[])`);
      params.push(selectedIds);
    }

    if (share.branchId) {
      conditions.push(`(ri.branch_id = $${idx++}::uuid OR ri.branch_id IS NULL)`);
      params.push(share.branchId);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const rows = await this.tenantSchemaService.withTenantSchema(share.schemaName, async ({ tx }) => {
      return tx.$queryRawUnsafe<Array<{
        id: string;
        code: string;
        name: string;
        category: string;
        size: string | null;
        color: string | null;
        rentPrice: number | null;
        notes: string | null;
        imageUrl: string | null;
      }>>(
        `SELECT
            ri.id,
            ri.code,
            ri.name,
            ri.category::text AS category,
            ri.size,
            ri.color,
            ${share.showPrices ? 'ri.rent_price::float' : 'NULL::float'} AS "rentPrice",
            ri.notes,
            ri.image_url AS "imageUrl"
         FROM ${itemsTable} ri
         LEFT JOIN ${categoriesTable} rc ON (rc.name = ri.category::text OR rc.code = ri.category::text)
         ${whereClause}
           AND (rc.id IS NULL OR rc.is_active = TRUE)
         ORDER BY ri.category ASC, ri.name ASC`,
        ...params,
      );
    });

    const categories = Array.from(new Set(rows.map((r) => r.category).filter(Boolean)));

    return {
      status: 'ACTIVE',
      catalog: {
        id: share.id,
        title: share.title,
        shareToken: share.shareToken,
        selectionType: share.selectionType,
        categoryName: share.categoryName,
        showPrices: share.showPrices,
        notes: share.notes,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
      },
      salon: {
        name: share.tenant.name,
        logoUrl: share.tenant.logoUrl,
        primaryColor: share.tenant.primaryColor,
        phone: share.contactPhone || branchInfo?.phone || share.tenant.phone || null,
        email: share.contactEmail || branchInfo?.email || share.tenant.email || null,
        branchName: branchInfo?.name || null,
        branchAddress: branchInfo?.address || null,
      },
      items: rows,
      categories,
      totalItems: rows.length,
    };
  }

}
