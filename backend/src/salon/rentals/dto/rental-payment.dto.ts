import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const ALL_RENTAL_PAYMENT_METHODS = [
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'OTHER',
] as const;

export type RentalPaymentMethod = (typeof ALL_RENTAL_PAYMENT_METHODS)[number];

export const ALL_ALLOCATION_TYPES = [
  'RENT',
  'SECURITY_DEPOSIT',
  'DAMAGE_CHARGE',
  'REFUND',
] as const;

export type RentalAllocationType = (typeof ALL_ALLOCATION_TYPES)[number];

export class CreateRentalPaymentDto {
  @IsUUID(undefined, { message: 'Valid bookingId is required' })
  bookingId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount must be a valid number with at most 2 decimal places' })
  @Min(0.01, { message: 'Payment amount must be greater than 0' })
  amount: number;

  @IsIn(ALL_RENTAL_PAYMENT_METHODS, {
    message: 'paymentMethod must be one of CASH, CARD, BANK_TRANSFER, OTHER',
  })
  paymentMethod: RentalPaymentMethod;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'rentAmount cannot be negative' })
  rentAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'depositAmount cannot be negative' })
  depositAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}

export class PickupPaymentDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsIn(ALL_RENTAL_PAYMENT_METHODS)
  paymentMethod?: RentalPaymentMethod;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ConfirmRentalPickupDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'actualPickupDate must be in YYYY-MM-DD format' })
  actualPickupDate?: string;

  @IsOptional()
  @IsString()
  pickupNotes?: string;

  @IsOptional()
  @IsString()
  conditionOut?: string;

  @IsOptional()
  allowPendingDeposit?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PickupPaymentDto)
  payment?: PickupPaymentDto;
}

export class ListRentalPaymentsQueryDto {
  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be in YYYY-MM-DD format' })
  startDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be in YYYY-MM-DD format' })
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 15;
}

