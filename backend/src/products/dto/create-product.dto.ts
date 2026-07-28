import { Type } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MaxLength(180)
  canonical_name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  package_size?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  package_unit?: string;

  @IsOptional()
  @IsObject()
  attributes_json?: Record<string, unknown>;
}
