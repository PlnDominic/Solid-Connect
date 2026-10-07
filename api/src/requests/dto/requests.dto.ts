import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
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

  /** Providers quote from this, so it must actually describe the job. */
  @IsString()
  @MinLength(10)
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

  /** Real GPS (or Accra chip centroid) for PostGIS matching. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  locationLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  locationLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(500)
  matchRadiusMeters?: number;

  /** When set, only this provider is notified (direct request). */
  @IsOptional()
  @IsUUID()
  preferredProviderId?: string;

  /** The appointment the customer picked from the provider's open slots (ISO). */
  @IsOptional()
  @IsISO8601()
  preferredTime?: string;

  /** Phase K: request placed on behalf of an organization. */
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;
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
