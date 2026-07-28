import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateShoppingListDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  status?: 'active' | 'archived' | 'completed';
}
