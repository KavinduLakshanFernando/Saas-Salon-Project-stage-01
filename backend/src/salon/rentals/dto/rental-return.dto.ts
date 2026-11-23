import {
  IsArray,
  IsBoolean,
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
import { ALL_RENTAL_PAYMENT_METHODS, RentalPaymentMethod } from './rental-payment.dto';

export const ALL_RENTAL_ITEM_CONDITIONS = [
  'GOOD',
  'MINOR_DAMAGE',
  'DAMAGED',
  'REQUIRES_REPAIR',
] as const;

export type RentalItemCondition = (typeof ALL_RENTAL_ITEM_CONDITIONS)[number];

export const ALL_CLEARANCE_STATUSES = [
  'AVAILABLE',
  'CLEANING',
  'MAINTENANCE',
] as const;

export type RentalClearanceStatus = (typeof ALL_CLEARANCE_STATUSES)[number];

export class ProcessReturnItemDto {
  @IsUUID(undefined, { message: 'Valid bookingItemId is required' })
  bookingItemId: string;

  @IsOptional()
  @IsIn(ALL_RENTAL_ITEM_CONDITIONS, {
    message: 'conditionIn must be GOOD, MINOR_DAMAGE, DAMAGED, or REQUIRES_REPAIR',
  })
  conditionIn?: RentalItemCondition;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  inspectionNotes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'lateFee cannot be negative' })
  lateFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'damageCharge cannot be negative' })
  damageCharge?: number;

  @IsOptional()
  @IsBoolean()
  requiresMaintenance?: boolean;
}

export class ProcessRentalReturnDto {
  @IsOptional()
  @IsString()
  actualReturnAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  returnNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;

  @IsArray({ message: 'items must be an array of return items' })
  @ValidateNested({ each: true })
  @Type(() => ProcessReturnItemDto)
  items: ProcessReturnItemDto[];

  @IsOptional()
  @IsBoolean()
  collectPayment?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'paymentAmount must be greater than 0' })
  paymentAmount?: number;

  @IsOptional()
  @IsIn(ALL_RENTAL_PAYMENT_METHODS, {
    message: 'paymentMethod must be CASH, CARD, BANK_TRANSFER, or OTHER',
  })
  paymentMethod?: RentalPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  paymentNotes?: string;
}

export class SettleRentalDepositDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;

  @IsOptional()
  @IsIn(ALL_RENTAL_PAYMENT_METHODS, {
    message: 'refundMethod must be CASH, CARD, BANK_TRANSFER, or OTHER',
  })
  refundMethod?: RentalPaymentMethod;
}

export class RecordRentalRefundDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Refund amount must be greater than 0' })
  amount: number;

  @IsOptional()
  @IsIn(ALL_RENTAL_PAYMENT_METHODS, {
    message: 'paymentMethod must be CASH, CARD, BANK_TRANSFER, or OTHER',
  })
  paymentMethod?: RentalPaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  idempotencyKey?: string;
}

export class UpdateRentalUnitClearanceDto {
  @IsIn(ALL_CLEARANCE_STATUSES, {
    message: 'status must be AVAILABLE, CLEANING, or MAINTENANCE',
  })
  status: RentalClearanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ListPendingReturnsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Boolean)
  overdueOnly?: boolean;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate?: string;
}

