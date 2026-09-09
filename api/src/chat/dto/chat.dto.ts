import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  text!: string;
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
