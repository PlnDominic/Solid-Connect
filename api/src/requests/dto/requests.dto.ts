import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRequestDto {
  @IsString()
  @MinLength(1)
  categoryId!: string;

  @IsString()
  @MinLength(1)
  categoryLabel!: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  photos?: string[];

  /** @deprecated Prefer `budget` — kept for older clients. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMin?: number;

  /** @deprecated Prefer `budget` — kept for older clients. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  budgetMax?: number;

  /** Customer's stated budget (GHS). Must fall within the category band. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  budget?: number;

  @IsString()
  @MinLength(2)
  locationLabel!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(500)
  matchRadiusMeters?: number;

  /** When set, only this provider is notified (direct request). */
  @IsOptional()
  @IsUUID()
  preferredProviderId?: string;
}

export class RejectDirectRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}

export class RequestIdParamDto {
  @IsUUID()
  id!: string;
}
