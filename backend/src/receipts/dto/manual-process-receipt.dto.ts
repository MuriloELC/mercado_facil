import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ManualCanonicalProductDto {
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
  @IsNumber()
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

export class ManualMarketDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsString()
  @MaxLength(120)
  city!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  chain_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string;
  @IsOptional()
  @IsString()
  @MaxLength(120)
  neighborhood?: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  address_line?: string;
  @IsOptional()
  @IsString()
  @MaxLength(12)
  postal_code?: string;
}

export class ManualReceiptItemDto {
  @IsString()
  @MaxLength(220)
  raw_description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  unit_price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  total_price?: number;

  @IsOptional()
  @IsUUID()
  canonical_product_id?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualCanonicalProductDto)
  canonical_product?: ManualCanonicalProductDto;

  @IsOptional()
  @IsIn(['manual', 'rag_confirmed'])
  classification_source?: 'manual' | 'rag_confirmed';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  classification_confidence?: number;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  alias_text?: string;
}

export class ManualProcessReceiptDto {
  @IsOptional()
  @IsUUID()
  market_id?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ManualMarketDto)
  market?: ManualMarketDto;

  @IsOptional()
  @IsDateString()
  purchase_date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total_amount?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ManualReceiptItemDto)
  items!: ManualReceiptItemDto[];
}
