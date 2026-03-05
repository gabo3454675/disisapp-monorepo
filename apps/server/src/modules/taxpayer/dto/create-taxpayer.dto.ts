import { IsString, IsNotEmpty, IsInt, IsOptional, IsEmail, IsBoolean } from 'class-validator';

export class CreateTaxpayerDto {
  @IsString()
  @IsNotEmpty()
  rif: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @IsNotEmpty()
  tenantId: number;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

