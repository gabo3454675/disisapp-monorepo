'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AssignTaskModal } from '@/components/assign-task-modal';
import { TaskResolutionBar } from '@/components/task-resolution-bar';
import apiClient from '@/lib/api';
import { Loader2, UserPlus, Download, MessageCircle, CheckCircle } from 'lucide-react';

interface InvoiceItem {
  id: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product: { id: number; name: string };
}

interface Customer {
  id: number;
  name: string;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface PaymentLine {
  method: string;
  amount: number;
  currency: string;
}

interface Invoice {
  id: number;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  montoUsd?: number | null;
  montoBs?: number | null;
  paymentLines?: PaymentLine[];
  notes?: string | null;
  createdAt: string;
  customer: Customer | null;
  items: InvoiceItem[];
  publicUrl?: string;
}

interface InvoiceDetailSheetProps {
  invoiceId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: number | null;
  onRefresh?: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat('es-VE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateString));

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Efectivo $',
  CASH_USD: 'Efectivo $',
  CASH_BS: 'Efectivo Bs',
  PAGO_MOVIL: 'Pago Móvil Bs',
  ZELLE: 'Zelle $',
  CARD: 'Tarjeta',
  CREDIT: 'Crédito',
  MIXED: 'Mixto',
};

function getPaymentDisplay(inv: Invoice): string {
  if (inv.paymentLines && inv.paymentLines.length > 0) {
    return inv.paymentLines
      .map((p) => {
        const label = PAYMENT_LABELS[p.method] ?? p.method;
        const sym = p.currency === 'VES' ? 'Bs' : '$';
        return `${label} ${Number(p.amount).toFixed(2)} ${sym}`;
      })
      .join(' + ');
  }
  const m = (inv.paymentMethod || 'CASH').toUpperCase();
  return PAYMENT_LABELS[m] ?? inv.paymentMethod ?? '—';
}

export function InvoiceDetailSheet({
  invoiceId,
  open,
  onOpenChange,
  taskId = null,
  onRefresh,
}: InvoiceDetailSheetProps) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  useEffect(() => {
    if (!open || !invoiceId) {
      setInvoice(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    apiClient
      .get<Invoice>(`/invoices/${invoiceId}`)
      .then((res) => {
        if (!cancelled) setInvoice(res.data);
      })
      .catch(() => {
        if (!cancelled) setInvoice(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, invoiceId]);

  const handleDownloadPDF = async () => {
    if (!invoiceId) return;
    try {
      const response = await apiClient.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
      const contentType = response.headers?.['content-type'] ?? '';
      if (contentType.includes('application/json')) {
        const text = await (response.data as Blob).text();
        const data = JSON.parse(text);
        alert(data?.message ?? 'Error al descargar la factura');
        return;
      }
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = `factura-${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(error.response?.data?.message ?? 'Error al descargar la factura');
    }
  };

  const statusLabel =
    invoice?.status === 'PAID' ? 'Pagada' : invoice?.status === 'PENDING' ? 'Pendiente' : 'Cancelada';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Detalle de la factura</SheetTitle>
            <SheetDescription>
              {invoiceId ? `Factura #${invoiceId}` : 'Cargando...'}
            </SheetDescription>
          </SheetHeader>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && invoice && (
            <div className="mt-6 space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="secondary"
                  className={
                    invoice.status === 'PAID'
                      ? 'bg-green-500/20 text-green-400'
                      : invoice.status === 'PENDING'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                  }
                >
                  {statusLabel}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatDate(invoice.createdAt)}
                </span>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Cliente</p>
                <p className="font-medium">{invoice.customer?.name || 'Cliente general'}</p>
                {invoice.customer?.phone && (
                  <p className="text-sm text-muted-foreground">{invoice.customer.phone}</p>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Método de pago</p>
                <p className="font-medium">{getPaymentDisplay(invoice)}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Items</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead className="text-right">P. unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product.name}</TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(item.unitPrice))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(item.subtotal))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <p className="text-lg font-semibold">
                  Total: {formatCurrency(Number(invoice.totalAmount))}
                </p>
              </div>

              {taskId && (
                <TaskResolutionBar
                  taskId={taskId}
                  invoiceId={invoice.id}
                  customerPhone={invoice.customer?.phone ?? undefined}
                  onDownloadPDF={handleDownloadPDF}
                  onDone={onRefresh}
                />
              )}

              {!taskId && (
                <div className="pt-4 border-t">
                  <Button
                    variant="default"
                    className="w-full sm:w-auto"
                    onClick={() => setAssignModalOpen(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Asignar revisión
                  </Button>
                </div>
              )}
            </div>
          )}

          {!loading && !invoice && invoiceId && (
            <p className="text-sm text-muted-foreground py-8">No se pudo cargar la factura.</p>
          )}
        </SheetContent>
      </Sheet>

      <AssignTaskModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        invoiceId={invoiceId ?? 0}
        onSuccess={() => {
          onRefresh?.();
          onOpenChange(false);
        }}
      />
    </>
  );
}
