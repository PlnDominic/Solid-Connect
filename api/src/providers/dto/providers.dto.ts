import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ServiceAreaDto {
  @IsEnum(['RADIUS', 'CITY'])
  type!: 'RADIUS' | 'CITY';

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  radiusMeters?: number;

  @IsOptional()
  @IsString()
  cityName?: string;
}

export class ReplaceServiceAreasDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceAreaDto)
  areas!: ServiceAreaDto[];
}

export class AvailabilityModeDto {
  @IsEnum(['AVAILABLE_NOW', 'UNAVAILABLE', 'SCHEDULE', 'PAUSED'])
  mode!: 'AVAILABLE_NOW' | 'UNAVAILABLE' | 'SCHEDULE' | 'PAUSED';
}

export class WeeklySlotDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  /** HH:MM or HH:MM:SS */
  @IsString()
  startTime!: string;

  @IsString()
  endTime!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

export class ReplaceWeeklyAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WeeklySlotDto)
  slots!: WeeklySlotDto[];
}

export class SetSkillsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  skillIds!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  yearsExperience?: number;
}

export class SetCategoriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  categoryIds!: string[];
}

export class SearchProvidersQueryDto {
  @Type(() => Number)
  @IsNumber()
  lng!: number;

  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(500)
  radiusMeters?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  minVerification?: string;
}
