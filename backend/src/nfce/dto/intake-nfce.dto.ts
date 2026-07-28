import { IsOptional, IsString, MaxLength } from 'class-validator';

export class IntakeNfceDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  ocr_hint_text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  qr_text?: string;
}
