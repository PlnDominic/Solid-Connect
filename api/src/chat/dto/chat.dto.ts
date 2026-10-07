import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SendMessageDto {
  // Optional - image-only or voice-only messages have none. Service-layer
  // validation still rejects a message with no text, image, or audio.
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  /** Public URL from the chat-audio storage bucket (0058). */
  @IsOptional()
  @IsUrl()
  audioUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(600)
  audioDurationSeconds?: number;
}

export class CreateThreadDto {
  @IsOptional()
  @IsUUID()
  requestId?: string;

  @IsOptional()
  @IsUUID()
  jobId?: string;

  @IsUUID()
  peerId!: string;

  @IsIn(['customer', 'provider'])
  asRole!: 'customer' | 'provider';
}
