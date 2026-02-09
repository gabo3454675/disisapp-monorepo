import Dexie, { type Table } from 'dexie';

/** Payload para crear factura (compatible con POST /invoices) */
export interface PendingInvoicePayload {
  customerId?: number;
  items: { productId: number; quantity: number }[];
  notes?: string;
}

/** Registro en IndexedDB: factura pendiente de sincronizar */
export interface PendingInvoiceRecord {
  id?: number;
  payload: PendingInvoicePayload;
  createdAt: number;
  synced?: boolean;
}

export class DisisDB extends Dexie {
  pendingInvoices!: Table<PendingInvoiceRecord, number>;

  constructor() {
    super('disis-offline');
    this.version(1).stores({
      pendingInvoices: '++id, createdAt, synced',
    });
  }
}

export const db = new DisisDB();
