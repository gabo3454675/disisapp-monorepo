export class TaxpayerResponseDto {
  id: number;
  rif: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  tenantId: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

