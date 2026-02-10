import { IsString, IsOptional, IsNumber, IsPositive, Min, IsIn } from 'class-validator';

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  salePrice?: number;

  @IsString()
  @IsOptional()
  @IsIn(['USD', 'VES'], { message: 'salePriceCurrency debe ser USD o VES' })
  salePriceCurrency?: 'USD' | 'VES';

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  costPrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minStock?: number;
}
