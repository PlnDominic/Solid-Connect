import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

const REASONS = ['not_completed', 'poor_quality', 'overcharged', 'no_show', 'other'] as const;

export class CreateReviewDto {
  @IsUUID()
  jobId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class CreateDisputeDto {
  @IsUUID()
  jobId!: string;

  @IsIn(REASONS)
  reason!: (typeof REASONS)[number];

  @IsString()
  @MinLength(8)
  @MaxLength(1000)
  description!: string;
}
