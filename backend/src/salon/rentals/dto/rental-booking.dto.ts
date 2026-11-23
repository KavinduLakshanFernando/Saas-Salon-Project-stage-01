import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ALL_RENTAL_PAYMENT_METHODS, RentalPaymentMethod } from './rental-payment.dto';

export const ALL_RENTAL_BOOKING_STATUSES = [
  'RESERVED',
  'PICKED_UP',
  'PARTIALLY_RETURNED',
  'RETURNED',
  'CANCELLED',
] as const;

export type RentalBookingStatus = (typeof ALL_RENTAL_BOOKING_STATUSES)[number];


export class BookingAdvancePaymentDto {
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
  @IsIn(ALL_RENTAL_PAYMENT_METHODS, {
    message: 'paymentMethod must be CASH, CARD, BANK_TRANSFER, or OTHER',
  })
  paymentMethod?: RentalPaymentMethod;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class CreateRentalBookingDto {
  @IsUUID(undefined, { message: 'Valid branchId is required' })
  branchId: string;

  @IsUUID(undefined, { message: 'Valid customerId is required' })
  customerId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'pickupDate must be in YYYY-MM-DD format' })
  pickupDate: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'returnDate must be in YYYY-MM-DD format' })
  returnDate: string;

  @IsArray()
  @ArrayNotEmpty({ message: 'At least one physical unit copy must be selected' })
  @IsUUID(undefined, { each: true, message: 'Each unitId must be a valid UUID' })
  unitIds: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'securityDeposit cannot be negative' })
  securityDeposit?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => BookingAdvancePaymentDto)
  advancePayment?: BookingAdvancePaymentDto;
}

export class CancelRentalBookingDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ListRentalBookingsQueryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  status?: string;

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

export class CheckAvailabilityQueryDto {
  @IsUUID(undefined, { message: 'Valid branchId is required' })
  branchId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'pickupDate must be in YYYY-MM-DD format' })
  pickupDate: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'returnDate must be in YYYY-MM-DD format' })
  returnDate: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

