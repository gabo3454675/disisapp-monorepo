import { IsArray, IsNotEmpty, ValidateNested, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceItemDto {
  @IsInt()
  @Min(1)
  productId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateInvoiceDto {
  @IsOptional()
  @IsInt()
  customerId?: number;

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];

  @IsOptional()
  notes?: string;

  /** Si se envía "CREDIT", la venta es a crédito (verifica límite y crea tarea de cobranza). */
  @IsOptional()
  paymentMethod?: string;
}
