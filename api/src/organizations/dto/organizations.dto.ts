import { Type } from 'class-transformer';
import {
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

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  area?: string;
}

export class AddMemberDto {
  @IsUUID()
  profileId!: string;

  @IsOptional()
  @IsIn(['admin', 'member'])
  role?: 'admin' | 'member';
}

export class UpdateMemberDto {
  @IsIn(['admin', 'member'])
  role!: 'admin' | 'member';
}

export class CreateProjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  locationLabel?: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  locationLabel?: string;

  @IsOptional()
  @IsIn(['open', 'in_progress', 'completed', 'cancelled'])
  status?: 'open' | 'in_progress' | 'completed' | 'cancelled';
}

export class CreateWorkforceRequestDto {
  @IsString()
  @MinLength(1)
  categoryId!: string;

  @IsString()
  @MinLength(1)
  categoryLabel!: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsString()
  @MinLength(2)
  locationLabel!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  budget!: number;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  preferredProviderId?: string;
}

export class CreateRecurringServiceDto {
  @IsString()
  @MinLength(1)
  categoryId!: string;

  @IsString()
  @MinLength(1)
  categoryLabel!: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsString()
  @MinLength(2)
  locationLabel!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  budget!: number;

  @IsIn(['weekly', 'biweekly', 'monthly'])
  cadence!: 'weekly' | 'biweekly' | 'monthly';

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsString()
  nextRunAt?: string;
}

export class UpdateRecurringServiceDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsIn(['weekly', 'biweekly', 'monthly'])
  cadence?: 'weekly' | 'biweekly' | 'monthly';

  @IsOptional()
  @IsString()
  nextRunAt?: string;
}
