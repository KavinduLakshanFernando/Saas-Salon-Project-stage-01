import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export const CATALOG_SELECTION_TYPES = ['ALL', 'CATEGORY', 'SELECTED_ITEMS'] as const;
export type CatalogSelectionType = (typeof CATALOG_SELECTION_TYPES)[number];

export class CreateRentalCatalogShareDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsIn(CATALOG_SELECTION_TYPES)
  selectionType: CatalogSelectionType;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  selectedItemIds?: string[];

  @IsOptional()
  @IsBoolean()
  showPrices?: boolean;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expiresInDays?: number;
}

export class ListRentalCatalogSharesQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsIn(['ALL', 'ACTIVE', 'REVOKED', 'EXPIRED'])
  status?: 'ALL' | 'ACTIVE' | 'REVOKED' | 'EXPIRED';
}

export class PreviewRentalCatalogQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsIn(CATALOG_SELECTION_TYPES)
  selectionType: CatalogSelectionType;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsOptional()
  @IsArray()
  selectedItemIds?: string[];
}

