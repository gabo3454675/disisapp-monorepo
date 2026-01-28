import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';
import { ExpenseStatus } from '@prisma/client';

export class CreateExpenseDto {
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @IsEnum(ExpenseStatus)
  @IsOptional()
  status?: ExpenseStatus;

  @IsInt()
  @IsOptional()
  supplierId?: number;

  @IsInt()
  @IsNotEmpty()
  categoryId: number;
}
