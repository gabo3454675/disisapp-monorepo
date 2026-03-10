export { apiClient } from './client';
export { default } from './client';

export { invoiceService } from './invoices';
export type {
  HistoryResponse,
  HistoryParams,
  HistoryInvoice,
  DailySummaryItem,
  CreateInvoicePayload,
  CreateInvoiceResponse,
} from './invoices';

export { authService } from './auth';
export type {
  LoginPayload,
  RegisterPayload,
  CompletePasswordResetPayload,
  SwitchOrganizationResponse,
} from './auth';
