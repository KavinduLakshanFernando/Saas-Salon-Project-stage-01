import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export const RENTAL_CATEGORIES = [
  'Saree',
  'Frock',
  'Jewellery',
  'Veil',
  'Crown',
  'Jacket',
  'Accessory',
  'Other',
] as const;

export type RentalCategory = (typeof RENTAL_CATEGORIES)[number];

export const RENTAL_ITEM_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type RentalItemStatus = (typeof RENTAL_ITEM_STATUSES)[number];

export const ALL_RENTAL_UNIT_STATUSES = [
  'AVAILABLE',
  'RESERVED',
  'RENTED',
  'CLEANING',
  'MAINTENANCE',
  'INACTIVE',
] as const;
export type RentalUnitStatus = (typeof ALL_RENTAL_UNIT_STATUSES)[number];

/** Statuses that can be manually assigned by salon staff in Phase 1 */
export const MANUALLY_ASSIGNABLE_UNIT_STATUSES = [
  'AVAILABLE',
  'CLEANING',
  'MAINTENANCE',
  'INACTIVE',
] as const;

export class CreateRentalItemDto {
  @IsString()
  @MinLength(1, { message: 'Item name is required' })
  name: string;

  @IsString()
  @MinLength(1, { message: 'Category is required' })
  category: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsNumber({}, { message: 'Rent price must be a valid number' })
  @Min(0, { message: 'Rent price cannot be negative' })
  @Type(() => Number)
  rentPrice: number;

  @IsOptional()
  @IsNumber({}, { message: 'Deposit must be a valid number' })
  @Min(0, { message: 'Deposit cannot be negative' })
  @Type(() => Number)
  deposit?: number;

  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1, { message: 'Quantity must be at least 1' })
  @Type(() => Number)
  quantity: number;

  @IsUUID('4', { message: 'A valid branch must be selected' })
  branchId: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class UpdateRentalItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Item name cannot be empty' })
  name?: string;

  @IsOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Rent price must be a valid number' })
  @Min(0, { message: 'Rent price cannot be negative' })
  @Type(() => Number)
  rentPrice?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Deposit must be a valid number' })
  @Min(0, { message: 'Deposit cannot be negative' })
  @Type(() => Number)
  deposit?: number;

  @IsOptional()
  @IsUUID('4', { message: 'A valid branch must be selected' })
  branchId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class UpdateRentalItemStatusDto {
  @IsIn(RENTAL_ITEM_STATUSES, {
    message: 'Status must be ACTIVE or INACTIVE',
  })
  status: RentalItemStatus;
}

export class AddRentalUnitsDto {
  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1, { message: 'Quantity must be at least 1' })
  @Type(() => Number)
  quantity: number;

  @IsOptional()
  @IsUUID('4', { message: 'Branch ID must be a valid UUID' })
  branchId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateRentalUnitDto {
  @IsOptional()
  @IsIn(ALL_RENTAL_UNIT_STATUSES, {
    message: `Status must be one of: ${ALL_RENTAL_UNIT_STATUSES.join(', ')}`,
  })
  status?: RentalUnitStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Branch ID must be a valid UUID' })
  branchId?: string;
}

export class ListRentalItemsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  unitStatus?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
