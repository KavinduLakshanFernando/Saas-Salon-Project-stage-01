import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentGatewayProvider } from '@prisma/client';

export class CreateSmsPackageDto {
  @IsString()
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  credits!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  currency?: string = 'LKR';

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number = 0;
}

export class UpdateSmsPackageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  credits?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  displayOrder?: number;
}

export class AdjustCreditsDto {
  @Type(() => Number)
  @IsInt()
  amount!: number;

  @IsString()
  reason!: string;
}

export class SetLowBalanceThresholdDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  threshold!: number;
}

export class PurchaseSmsPackageDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsUUID()
  packageId?: string;

  @IsOptional()
  @IsEnum(PaymentGatewayProvider)
  gateway?: PaymentGatewayProvider = PaymentGatewayProvider.PAYHERE;
}

export class SmsPaginationQueryDto {
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
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class AddManualPaymentCreditsDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  credits?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: 'BANK_TRANSFER' | 'CASH' | 'CHEQUE' | 'OTHER' = 'BANK_TRANSFER';

  @IsString()
  paymentReference!: string;

  @IsString()
  paymentDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class DeactivateSmsDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ActivateSmsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  credits?: number = 0;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddCreditsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  credits!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListSalonsSmsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  plan?: string;

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
}
