import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SmsRechargeRequestStatus } from '@prisma/client';

export class CreateSmsRechargeRequestDto {
  @IsOptional()
  @IsUUID()
  packageId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  requestedCredits?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ownerMessage?: string;
}

export class ListRechargeRequestsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(SmsRechargeRequestStatus)
  status?: SmsRechargeRequestStatus;

  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class FulfillRechargeRequestDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  credits?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNotes?: string;
}

export class RejectRechargeRequestDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}
