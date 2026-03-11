/**
 * Tipos usados por el client, alineados con @billing-system/shared.
 * Definidos aquí para que el build funcione en Render sin depender del workspace.
 */

export interface LoginResponse {
  access_token: string;
  user: {
    id: number;
    email: string;
    fullName?: string | null;
    name?: string;
    organizationId?: number;
    isSuperAdmin?: boolean;
    organizations?: Array<{
      id: number;
      name: string;
      slug: string;
      plan?: string;
      role?: string;
      currencyCode?: string;
      currencySymbol?: string;
      exchangeRate?: number;
      rateUpdatedAt?: string | null;
    }>;
    companies?: Array<{
      id: number;
      name: string;
      taxId?: string;
      logoUrl?: string | null;
      currency: string;
      role: string;
    }>;
  };
}

export enum InvoiceStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export interface Invoice {
  id: number;
  companyId?: number;
  organizationId?: number | null;
  customerId?: number | null;
  sellerId?: number;
  totalAmount: number | string;
  status: InvoiceStatus;
  paymentMethod?: string;
  paymentStatus?: string;
  notes?: string | null;
  pdfUrl?: string | null;
  publicToken?: string | null;
  createdAt: Date;
  updatedAt: Date;
  invoiceNumber?: string;
  issueDate?: Date;
  dueDate?: Date;
  subtotal?: number;
  tax?: number;
  total?: number;
}

export interface Customer {
  id: number;
  companyId?: number;
  organizationId?: number | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  isActive?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface InvoiceItem {
  id: number;
  invoiceId: number;
  productId: number;
  quantity: number;
  unitPrice: number | string;
  subtotal: number | string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
