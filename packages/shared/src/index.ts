// User Types
export interface User {
  id: string;
  email: string;
  name?: string;
  tenantId: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
}

// Tenant Types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  subdomain?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Invoice Types
export interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate?: Date;
  status: InvoiceStatus;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  tenantId: string;
  customerId?: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

// Customer Types
export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  isActive: boolean;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Product Types
export interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  price: number;
  stock: number;
  isActive: boolean;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Invoice Item Types
export interface InvoiceItem {
  id: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  description?: string;
  invoiceId: string;
  productId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
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

// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    tenantId: string;
    name?: string;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  tenantName: string;
}
