import type { AxiosResponse } from 'axios';
import type { Invoice, InvoiceItem, Customer } from '@billing-system/shared';
import { apiClient } from './client';

/** Respuesta del endpoint GET /invoices/history. id explícito para compatibilidad con build. */
export interface HistoryInvoice extends Omit<Invoice, 'id'> {
  id: number;
  totalAmount: number | string;
  paymentMethod?: string;
  customer: Customer | null;
  items: (InvoiceItem & { product: { id: number; name: string } })[];
  paymentLines?: { method: string; amount: number; currency: string }[];
  montoUsd?: number | null;
  montoBs?: number | null;
}

export interface DailySummaryItem {
  date: string;
  totalSales: number;
  byPaymentMethod: Record<string, number>;
}

export interface HistoryResponse {
  organizationId: number;
  startDate: string;
  endDate: string;
  dailySummary: DailySummaryItem[];
  invoices: HistoryInvoice[];
}

export interface HistoryParams {
  startDate: string;
  endDate: string;
  organizationId?: number;
}

/** Payload para crear factura (POST /invoices) */
export interface CreateInvoicePayload {
  customerId?: number;
  paymentMethod?: string;
  payments?: { method: string; amount: number; currency: string }[];
  items: { productId: number; quantity: number }[];
}

export interface CreateInvoiceResponse {
  id: number;
  [key: string]: unknown;
}

/**
 * Servicio de facturas. Centraliza las llamadas al API y tipa respuestas con shared.
 */
export const invoiceService = {
  /** Listado de facturas de la organización actual */
  getAll(): Promise<Invoice[]> {
    return apiClient.get<Invoice[]>('/invoices').then((res) => res.data);
  },

  /** Historial de ventas por rango de fechas (y opcionalmente por organización para Super Admin) */
  getHistory(params: HistoryParams): Promise<HistoryResponse> {
    const query: Record<string, string> = {
      startDate: params.startDate,
      endDate: params.endDate,
    };
    if (params.organizationId != null) {
      query.organizationId = String(params.organizationId);
    }
    return apiClient.get<HistoryResponse>('/invoices/history', { params: query }).then((res) => res.data);
  },

  /** PDF de una factura. Devuelve la respuesta para que el llamador pueda leer headers (content-type) y detectar errores JSON. */
  getPdf(invoiceId: number): Promise<AxiosResponse<Blob>> {
    return apiClient.get<Blob>(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
  },

  /** Crear factura (POS o sincronización). Devuelve la factura creada con id. */
  create(payload: CreateInvoicePayload): Promise<CreateInvoiceResponse> {
    return apiClient.post<CreateInvoiceResponse>('/invoices', payload).then((res) => res.data);
  },

  /** Eliminar una factura */
  delete(invoiceId: number): Promise<void> {
    return apiClient.delete(`/invoices/${invoiceId}`).then(() => undefined);
  },

  /** Limpiar datos de prueba (solo desarrollo). */
  clearTestData(): Promise<{ message: string; deleted?: number }> {
    return apiClient.post<{ message: string; deleted?: number }>('/invoices/clear-test-data').then((res) => res.data);
  },
};
