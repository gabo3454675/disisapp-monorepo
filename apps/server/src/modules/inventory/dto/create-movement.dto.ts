import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { IsIn } from 'class-validator';

/** Tipos de salida permitidos para este endpoint (Autoconsumo y Mermas). */
export const OUTFLOW_MOVEMENT_TYPES = [
  'AUTOCONSUMO',
  'MERMA_VENCIDO',
  'MERMA_DANADO',
] as const;

export type OutflowMovementType = (typeof OUTFLOW_MOVEMENT_TYPES)[number];

export class CreateMovementDto {
  @IsIn(OUTFLOW_MOVEMENT_TYPES, {
    message: `type debe ser uno de: ${OUTFLOW_MOVEMENT_TYPES.join(', ')}`,
  })
  type: OutflowMovementType;

  @IsInt()
  @Min(1, { message: 'quantity debe ser al menos 1' })
  quantity: number;

  @IsInt()
  @Min(1, { message: 'productId es requerido' })
  productId: number;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'reason no puede superar 500 caracteres' })
  reason?: string;
}
