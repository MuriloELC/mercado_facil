import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ScrapeAfterCaptchaDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000000)
  page_html?: string;
}
