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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InvoiceDetailSheet } from '@/components/invoice-detail-sheet';
import { Loader2, MoreVertical, FileText, Printer, Calendar, Building2, DollarSign, Receipt } from 'lucide-react';
import { apiClient, invoiceService } from '@/lib/api';
import type { HistoryResponse, HistoryInvoice } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermission } from '@/hooks/usePermission';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';

function getDefaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function HistoryPage() {
  const { selectedOrganizationId, selectedCompanyId, getOrganizations, selectOrganization, user } = useAuthStore();
  const { canManageCustomers } = usePermission();
  const { formatForDisplay } = useDisplayCurrency();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const organizations = getOrganizations();

  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);
  const [filterOrgId, setFilterOrgId] = useState<number | null>(null);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailInvoiceId, setDetailInvoiceId] = useState<number | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const activeOrgId = selectedOrganizationId || selectedCompanyId;

  const fetchHistory = useCallback(async () => {
    if (!activeOrgId) return;
    try {
      setLoading(true);
      const params = {
        startDate: startDate + 'T00:00:00.000Z',
        endDate: endDate + 'T23:59:59.999Z',
        ...(filterOrgId != null && filterOrgId !== activeOrgId && isSuperAdmin && { organizationId: filterOrgId }),
      };
      const data = await invoiceService.getHistory(params);
      setData(data);
    } catch (error) {
      console.error('Error fetching history:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, startDate, endDate, filterOrgId, isSuperAdmin]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    if (!isSuperAdmin && activeOrgId != null) setFilterOrgId(activeOrgId);
  }, [activeOrgId, isSuperAdmin]);

  const handleDownloadPDF = async (invoiceId: number) => {
    try {
      const response = await invoiceService.getPdf(invoiceId);
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
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      const msg = err.response?.data?.message ?? 'Error al descargar la factura';
      alert(typeof msg === 'string' ? msg : 'Error al descargar la factura');
    }
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

  const paymentMethodLabels: Record<string, string> = {
    CASH: 'Efectivo $',
    CASH_USD: 'Efectivo $',
    CASH_BS: 'Efectivo Bs',
    PAGO_MOVIL: 'Pago Móvil Bs',
    ZELLE: 'Zelle $',
    CARD: 'Tarjeta',
    CREDIT: 'Crédito',
    MIXED: 'Mixto',
  };

  const getPaymentMethodDisplay = (inv: HistoryInvoice): string => {
    if (inv.paymentLines && inv.paymentLines.length > 0) {
      return inv.paymentLines
        .map((p: { method: string; amount: number; currency: string }) => {
          const label = paymentMethodLabels[p.method] ?? p.method;
          const sym = p.currency === 'VES' ? 'Bs' : '$';
          return `${label} ${Number(p.amount).toFixed(2)} ${sym}`;
        })
        .join(' + ');
    }
    const m = (inv.paymentMethod || 'CASH').toUpperCase();
    return paymentMethodLabels[m] ?? inv.paymentMethod ?? '—';
  };

  const totalSalesPeriod = data?.invoices?.reduce((sum, inv) => sum + Number(inv.totalAmount), 0) ?? 0;
  const invoicesCount = data?.invoices?.length ?? 0;

  if (!canManageCustomers) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Historial de Ventas</h1>
          <p className="text-muted-foreground">Consulta ventas por rango de fechas y por empresa</p>
        </div>

        {/* Filtros: rango de fechas y empresa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Calendar className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row flex-wrap gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="startDate">Desde</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:w-auto"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="endDate">Hasta</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-auto"
              />
            </div>
            {(organizations.length > 1 || isSuperAdmin) && (
              <div className="flex flex-col gap-2 min-w-[200px]">
                <Label className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" />
                  Empresa
                </Label>
                <Select
                  value={filterOrgId != null ? String(filterOrgId) : (activeOrgId != null ? String(activeOrgId) : '')}
                  onValueChange={(v) => {
                    const id = v ? parseInt(v, 10) : null;
                    setFilterOrgId(id);
                    if (!isSuperAdmin && id != null) selectOrganization(id);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas / actual" />
                  </SelectTrigger>
                  <SelectContent>
                    {(organizations as Array<{ id: number; name?: string; nombre?: string }>).map((org) => (
                      <SelectItem key={org.id} value={String(org.id)}>
                        {org.name ?? org.nombre ?? `Org ${org.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end">
              <Button onClick={fetchHistory} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Buscar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tarjetas de resumen del periodo (solo cobro real, sin IVA/IGTF) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Ventas Totales del Periodo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatForDisplay(totalSalesPeriod)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Facturas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{invoicesCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabla de ventas */}
        <Card>
          <CardHeader>
            <CardTitle>Ventas del periodo</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !data?.invoices?.length ? (
              <p className="text-center py-12 text-muted-foreground">
                No hay ventas en el rango seleccionado
              </p>
            ) : (
              <>
                <div className="md:hidden space-y-3">
                  {data.invoices.map((invoice: HistoryInvoice) => (
                    <Card key={invoice.id} className="p-4">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <p className="font-semibold">#{invoice.id}</p>
                          <p className="text-sm text-muted-foreground">
                            {invoice.customer?.name || 'Cliente General'} · {formatDate(typeof invoice.createdAt === 'string' ? invoice.createdAt : new Date(invoice.createdAt).toISOString())}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            (String(invoice.status) === 'PAID')
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : String(invoice.status) === 'PENDING'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          }`}
                        >
                          {String(invoice.status) === 'PAID' ? 'Pagada' : String(invoice.status) === 'PENDING' ? 'Pendiente' : 'Cancelada'}
                        </span>
                      </div>
                      <p className="font-bold text-primary mb-2">{formatForDisplay(Number(invoice.totalAmount))}</p>
                      <p className="text-xs text-muted-foreground mb-2">{getPaymentMethodDisplay(invoice)}</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setDetailInvoiceId(Number(invoice.id)); setDetailSheetOpen(true); }}>
                            <FileText className="mr-2 h-4 w-4" />
                            Revisar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadPDF(Number(invoice.id))}>
                            <Printer className="mr-2 h-4 w-4" />
                            Imprimir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Card>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Monto Total</TableHead>
                        <TableHead>Método de pago</TableHead>
                        <TableHead>Estatus</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.invoices.map((invoice: HistoryInvoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="text-muted-foreground">{formatDate(typeof invoice.createdAt === 'string' ? invoice.createdAt : new Date(invoice.createdAt).toISOString())}</TableCell>
                          <TableCell>{invoice.customer?.name || 'Cliente General'}</TableCell>
                          <TableCell className="font-semibold">
                            {formatForDisplay(Number(invoice.totalAmount))}
                          </TableCell>
                          <TableCell>{getPaymentMethodDisplay(invoice)}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                String(invoice.status) === 'PAID'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                  : String(invoice.status) === 'PENDING'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                              }`}
                            >
                              {String(invoice.status) === 'PAID' ? 'Pagada' : String(invoice.status) === 'PENDING' ? 'Pendiente' : 'Cancelada'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setDetailInvoiceId(Number(invoice.id)); setDetailSheetOpen(true); }}>
                                  <FileText className="mr-2 h-4 w-4" />
                                  Revisar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadPDF(Number(invoice.id))}>
                                  <Printer className="mr-2 h-4 w-4" />
                                  Imprimir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <InvoiceDetailSheet
        invoiceId={detailInvoiceId}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onRefresh={fetchHistory}
      />
    </div>
  );
}
