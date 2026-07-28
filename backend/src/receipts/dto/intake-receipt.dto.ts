import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class IntakeReceiptDto {
  @IsOptional()
  @IsIn(['qrcode', 'image', 'manual'])
  source_type?: 'qrcode' | 'image' | 'manual';

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  qr_text?: string;
}
