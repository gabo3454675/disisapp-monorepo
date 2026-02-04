'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2, Search, FileText, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { InvoiceDetailSheet } from '@/components/invoice-detail-sheet';
import { AssignTaskModal } from '@/components/assign-task-modal';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

interface InvoiceItem {
  id: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product: {
    id: number;
    name: string;
  };
}

interface Customer {
  id: number;
  name: string;
  taxId?: string | null;
}

interface Invoice {
  id: number;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  customer: Customer | null;
  items: InvoiceItem[];
}

export default function InvoicesPage() {
  const { selectedCompanyId } = useAuthStore();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailInvoiceId, setDetailInvoiceId] = useState<number | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignModalInvoiceId, setAssignModalInvoiceId] = useState<number | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!selectedCompanyId) return;

    try {
      setLoading(true);
      const response = await apiClient.get<Invoice[]>('/invoices');
      setInvoices(response.data);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      alert('Error al cargar las facturas');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleDownloadPDF = async (invoiceId: number) => {
    try {
      const response = await apiClient.get(`/invoices/${invoiceId}/pdf`, {
        responseType: 'blob',
      });

      // Crear un blob y abrir en nueva pestaña
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
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Error al descargar la factura');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('es-VE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const query = searchQuery.toLowerCase();
    return (
      invoice.id.toString().includes(query) ||
      invoice.customer?.name.toLowerCase().includes(query) ||
      formatCurrency(Number(invoice.totalAmount)).toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Facturas</h1>
          <p className="text-muted-foreground">Historial de facturas generadas</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Historial de Facturas</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar facturas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredInvoices.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">
                {searchQuery ? 'No se encontraron facturas' : 'No hay facturas registradas'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">#{invoice.id}</TableCell>
                      <TableCell>{invoice.customer?.name || 'Cliente General'}</TableCell>
                      <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(Number(invoice.totalAmount))}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            invoice.status === 'PAID'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : invoice.status === 'PENDING'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          }`}
                        >
                          {invoice.status === 'PAID'
                            ? 'Pagada'
                            : invoice.status === 'PENDING'
                              ? 'Pendiente'
                              : 'Cancelada'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDetailInvoiceId(invoice.id);
                              setDetailSheetOpen(true);
                            }}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Ver detalle
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAssignModalInvoiceId(invoice.id);
                              setAssignModalOpen(true);
                            }}
                          >
                            <UserPlus className="mr-2 h-4 w-4" />
                            Asignar Revisión
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadPDF(invoice.id)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            PDF
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <InvoiceDetailSheet
        invoiceId={detailInvoiceId}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onRefresh={fetchInvoices}
      />

      {assignModalInvoiceId != null && (
        <AssignTaskModal
          open={assignModalOpen}
          onOpenChange={(open) => {
            setAssignModalOpen(open);
            if (!open) setAssignModalInvoiceId(null);
          }}
          invoiceId={assignModalInvoiceId}
          onSuccess={fetchInvoices}
        />
      )}
    </div>
  );
}
