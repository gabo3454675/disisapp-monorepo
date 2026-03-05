/**
 * Tipos compartidos alineados con el schema de Prisma (server).
 * IDs numéricos y organizationId como referencia multi-tenant.
 */

// ------------------------------------------
// User (Prisma: User)
// ------------------------------------------
export interface User {
  id: number;
  email: string;
  fullName?: string | null;
  name?: string; // alias para compatibilidad
  organizationId?: number; // JWT / sesión activa (tenant)
  role: UserRole;
  isActive: boolean;
  isSuperAdmin?: boolean;
  requiresPasswordChange?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  SELLER = 'SELLER',
  WAREHOUSE = 'WAREHOUSE',
  USER = 'USER', // alias si se usa en UI
}

// ------------------------------------------
// Organization / Tenant (Prisma: Organization)
// ------------------------------------------
export interface Tenant {
  id: number;
  name: string;
  slug: string;
  subdomain?: string;
  isActive?: boolean;
  plan?: string;
  currencyCode?: string;
  currencySymbol?: string;
  exchangeRate?: number;
  rateUpdatedAt?: Date | string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// ------------------------------------------
// Invoice (Prisma: Invoice, InvoiceStatus)
// ------------------------------------------
export enum InvoiceStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export interface Invoice {
  id: number;
  companyId?: number; // legacy
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
  // Campos opcionales de respuesta API
  invoiceNumber?: string;
  issueDate?: Date;
  dueDate?: Date;
  subtotal?: number;
  tax?: number;
  total?: number;
}

// ------------------------------------------
// Customer (Prisma: Customer)
// ------------------------------------------
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

// ------------------------------------------
// Product (Prisma: Product)
// ------------------------------------------
export interface Product {
  id: number;
  companyId?: number;
  organizationId?: number | null;
  name: string;
  description?: string | null;
  sku?: string | null;
  barcode?: string | null;
  costPrice?: number | string;
  salePrice: number | string;
  price?: number; // alias para salePrice
  salePriceCurrency?: string;
  stock: number;
  imageUrl?: string | null;
  minStock?: number;
  isExempt?: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ------------------------------------------
// InvoiceItem (Prisma: InvoiceItem)
// ------------------------------------------
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

// ------------------------------------------
// API Response Types
// ------------------------------------------
export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ------------------------------------------
// Auth Types (LoginResponse: user.id number, JWT con organizationId)
// ------------------------------------------
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: {
    id: number;
    email: string;
    fullName?: string | null;
    name?: string;
    organizationId?: number;
    isSuperAdmin?: boolean;
    organizations?: Array<{ id: number; name: string; slug: string; plan?: string; role?: string; currencyCode?: string; currencySymbol?: string; exchangeRate?: number; rateUpdatedAt?: string | null }>;
    companies?: Array<{ id: number; name: string; taxId?: string; logoUrl?: string | null; currency: string; role: string }>;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  tenantName: string;
}
