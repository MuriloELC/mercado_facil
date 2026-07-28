import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateShoppingListDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
