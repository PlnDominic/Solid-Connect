import { IsIn, IsOptional, IsString, IsUUID, IsUrl, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  // Optional now - an image-only message has none. Service-layer
  // validation still rejects a message with neither.
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;
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
