import { IsString, IsNotEmpty, IsOptional, IsNumber, IsPositive, Min, IsIn, IsBoolean } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @IsPositive()
  @IsNotEmpty()
  salePrice: number;

  /** Moneda en que se registra el precio: USD o VES (Bolívares). Por defecto USD. */
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

  @IsOptional()
  @IsBoolean()
  isBundle?: boolean;

  /** [{ "productId": number, "quantity": number }] — cantidades por unidad de combo */
  @IsOptional()
  bundleComponents?: unknown;
}
