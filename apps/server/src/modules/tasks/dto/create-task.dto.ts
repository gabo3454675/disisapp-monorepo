import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';
import { TaskStatus, TaskPriority } from '@prisma/client';

export class CreateTaskDto {
  @IsString()
  @MinLength(1, { message: 'El título es requerido' })
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsInt()
  assignedToId: number;

  @IsOptional()
  @IsInt()
  invoiceId?: number;
}
