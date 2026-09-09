import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class CreateQuoteDto {
  @IsUUID()
  requestId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  price!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  etaLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ReviseQuoteDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  price!: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  etaLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class AcceptQuoteDto {
  @IsUUID()
  quoteId!: string;
}
