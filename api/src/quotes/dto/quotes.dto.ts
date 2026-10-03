import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** One line of a quote's price breakdown (0055). */
export class QuoteItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount!: number;
}

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

  /** Optional breakdown; the database checks it adds up to `price`. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items?: QuoteItemDto[];

  /** The start time the provider proposes (ISO). */
  @IsOptional()
  @IsISO8601()
  proposedStart?: string | null;
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
