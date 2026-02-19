'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Loader2, CreditCard, DollarSign, Download, AlertCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { usePermission } from '@/hooks/usePermission';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface CustomerCredit {
  id: number;
  customerId: number;
  limitAmount: number;
  currentBalance: number;
  status: string;
  creditDueDays: number;
  customer: { id: number; name: string; email?: string | null };
}

interface CreditTransaction {
  id: number;
  type: string;
  amountUsd: number;
  amountBs: number;
  exchangeRate: number;
  description: string | null;
  createdAt: string;
  invoiceId: number | null;
  invoice?: { id: number; totalAmount: number } | null;
}

export default function CreditsPage() {
  const { selectedCompanyId } = useAuthStore();
  const exchangeRate = useExchangeRate();
  const { canManageCustomers, isSuperAdmin, isAdmin } = usePermission();
  const { formatForDisplay } = useDisplayCurrency();
  const canEditCreditLimit = isSuperAdmin || isAdmin;
  const [credits, setCredits] = useState<CustomerCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCredit, setSelectedCredit] = useState<CustomerCredit | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmountUsd, setPaymentAmountUsd] = useState('');
  const [paymentAmountBs, setPaymentAmountBs] = useState('');
  const [paymentDesc, setPaymentDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [newLimit, setNewLimit] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);

  const fetchCredits = useCallback(async () => {
    if (!selectedCompanyId) return;
    try {
      setLoading(true);
      const res = await apiClient.get<CustomerCredit[]>('/credits');
      setCredits(res.data);
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar cuentas por cobrar');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  useEffect(() => {
    if (!selectedCredit) {
      setTransactions([]);
      return;
    }
    setLoadingTx(true);
    apiClient
      .get<CreditTransaction[]>(`/credits/${selectedCredit.id}/transactions`)
      .then((res) => setTransactions(res.data))
      .catch(() => toast.error('Error al cargar movimientos'))
      .finally(() => setLoadingTx(false));
  }, [selectedCredit]);

  const filteredCredits = credits.filter((c) =>
    c.customer.name.toLowerCase().includes(search.toLowerCase())
  );

  if (!canManageCustomers) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No tienes permisos para acceder a esta sección.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleOpenPayment = () => {
    if (!selectedCredit) return;
    const balance = Number(selectedCredit.currentBalance);
    setPaymentAmountUsd('');
    setPaymentAmountBs('');
    setPaymentDesc('');
    setPaymentDialogOpen(true);
  };

  const handlePaymentAmountUsdChange = (v: string) => {
    setPaymentAmountUsd(v);
    const num = parseFloat(v);
    if (!isNaN(num)) setPaymentAmountBs((num * exchangeRate).toFixed(2));
    else setPaymentAmountBs('');
  };

  const handleRegisterPayment = async () => {
    if (!selectedCredit) return;
    const amountUsd = parseFloat(paymentAmountUsd);
    const amountBs = parseFloat(paymentAmountBs);
    if (isNaN(amountUsd) || amountUsd <= 0) {
      toast.error('Ingrese un monto válido en USD');
      return;
    }
    const balance = Number(selectedCredit.currentBalance);
    if (amountUsd > balance) {
      toast.error('El abono no puede ser mayor al saldo deudor');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.post(`/credits/${selectedCredit.id}/payment`, {
        amountUsd,
        amountBs: isNaN(amountBs) ? amountUsd * exchangeRate : amountBs,
        exchangeRate,
        description: paymentDesc || undefined,
      });
      toast.success('Abono registrado');
      setPaymentDialogOpen(false);
      fetchCredits();
      const tx = res.data as { id: number };
      try {
        const pdfRes = await apiClient.get(`/credits/transactions/${tx.id}/receipt-pdf`, { responseType: 'blob' });
        const blob = new Blob([pdfRes.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank');
        window.URL.revokeObjectURL(url);
      } catch {
        toast.info('Abono guardado. Puede descargar el recibo desde el historial.');
      }
      setSelectedCredit((prev) =>
        prev ? { ...prev, currentBalance: balance - amountUsd } : null
      );
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al registrar abono');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('es-VE', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">Cuentas por Cobrar</h1>
        <p className="text-muted-foreground">Créditos a clientes y registro de abonos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Clientes con crédito
            </CardTitle>
            <CardDescription>Busque y seleccione un cliente para ver saldo y registrar abonos</CardDescription>
            <div className="relative pt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCredits.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">
                {search ? 'No hay coincidencias' : 'No hay cuentas de crédito'}
              </p>
            ) : (
              <ul className="space-y-2 max-h-[320px] overflow-y-auto">
                {filteredCredits.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedCredit(c)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        selectedCredit?.id === c.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{c.customer.name}</span>
                        <span className="text-sm font-semibold text-primary">
                          {formatForDisplay(Number(c.currentBalance))} deuda
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Límite: {formatForDisplay(Number(c.limitAmount))}
                        {c.status !== 'ACTIVE' && (
                          <span className="text-destructive ml-2">Suspendido</span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalle y abonos</CardTitle>
            <CardDescription>
              {selectedCredit
                ? `${selectedCredit.customer.name} · Saldo: ${formatForDisplay(Number(selectedCredit.currentBalance))}`
                : 'Seleccione un cliente'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedCredit ? (
              <p className="text-muted-foreground text-center py-8">
                Elija un cliente de la lista para ver movimientos y registrar abonos.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleOpenPayment} disabled={Number(selectedCredit.currentBalance) <= 0}>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Registrar abono
                  </Button>
                  {canEditCreditLimit && (
                    <Button variant="outline" onClick={() => { setNewLimit(String(selectedCredit.limitAmount)); setLimitDialogOpen(true); }}>
                      Cambiar límite
                    </Button>
                  )}
                </div>
                <div>
                  <h4 className="font-medium mb-2">Historial de movimientos</h4>
                  {loadingTx ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin movimientos</p>
                  ) : (
                    <ul className="space-y-2 max-h-[240px] overflow-y-auto">
                      {transactions.map((tx) => (
                        <li
                          key={tx.id}
                          className="flex justify-between items-center text-sm py-2 border-b border-border last:border-0"
                        >
                          <div>
                            <span className={tx.type === 'CHARGE' ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}>
                              {tx.type === 'CHARGE' ? 'Cargo' : 'Abono'}
                            </span>
                            {tx.description && (
                              <span className="text-muted-foreground ml-2">{tx.description}</span>
                            )}
                            <div className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</div>
                          </div>
                          <div className="text-right">
                            <span className="font-medium">{formatForDisplay(Number(tx.amountUsd))}</span>
                            {tx.type === 'PAYMENT' && (
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs"
                                onClick={async () => {
                                  try {
                                    const r = await apiClient.get(`/credits/transactions/${tx.id}/receipt-pdf`, { responseType: 'blob' });
                                    const blob = new Blob([r.data], { type: 'application/pdf' });
                                    const url = window.URL.createObjectURL(blob);
                                    window.open(url, '_blank');
                                    window.URL.revokeObjectURL(url);
                                  } catch {
                                    toast.error('Error al descargar recibo');
                                  }
                                }}
                              >
                                Recibo PDF
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar límite de crédito</DialogTitle>
            <DialogDescription>
              {selectedCredit?.customer.name}. Solo administradores pueden modificar el límite. El nuevo límite no puede ser menor al saldo deudor actual.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newLimit">Nuevo límite (USD)</Label>
              <Input
                id="newLimit"
                type="number"
                step="0.01"
                min="0"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimitDialogOpen(false)}>Cancelar</Button>
            <Button
              disabled={savingLimit || !newLimit || parseFloat(newLimit) < Number(selectedCredit?.currentBalance ?? 0)}
              onClick={async () => {
                if (!selectedCredit) return;
                const num = parseFloat(newLimit);
                if (isNaN(num) || num < 0) return;
                setSavingLimit(true);
                try {
                  await apiClient.patch(`/credits/${selectedCredit.id}/limit`, { limitAmount: num });
                  toast.success('Límite actualizado');
                  setLimitDialogOpen(false);
                  fetchCredits();
                  setSelectedCredit((prev) => prev ? { ...prev, limitAmount: num } : null);
                } catch (err: any) {
                  toast.error(err.response?.data?.message || 'Error al actualizar límite');
                } finally {
                  setSavingLimit(false);
                }
              }}
            >
              {savingLimit ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar abono</DialogTitle>
            <DialogDescription>
              {selectedCredit?.customer.name}. Saldo actual: {selectedCredit && formatForDisplay(Number(selectedCredit.currentBalance))}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amountUsd">Monto (USD)</Label>
              <Input
                id="amountUsd"
                type="number"
                step="0.01"
                min="0"
                value={paymentAmountUsd}
                onChange={(e) => handlePaymentAmountUsdChange(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amountBs">Equivalente (BS)</Label>
              <Input
                id="amountBs"
                type="number"
                step="0.01"
                min="0"
                value={paymentAmountBs}
                onChange={(e) => setPaymentAmountBs(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="desc">Descripción (opcional)</Label>
              <Input
                id="desc"
                value={paymentDesc}
                onChange={(e) => setPaymentDesc(e.target.value)}
                placeholder="Ej. Abono factura #12"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRegisterPayment} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar y descargar recibo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
