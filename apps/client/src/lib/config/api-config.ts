/**
 * URL base del API. Única fuente de verdad para el client.
 * Usar en layout, apiClient y páginas públicas (pago por token).
 */
export const API_BASE_URL =
  typeof process.env.NEXT_PUBLIC_API_URL === 'string' && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : 'http://localhost:3001/api';

/** Rutas públicas de facturas (por token) — evita strings manuales en páginas */
export const publicInvoiceRoutes = {
  byToken: (token: string) => `${API_BASE_URL}/invoices/public/${token}`,
  pdf: (token: string) => `${API_BASE_URL}/invoices/public/${token}/pdf`,
  markPaid: (token: string) => `${API_BASE_URL}/invoices/public/${token}/mark-paid`,
} as const;
