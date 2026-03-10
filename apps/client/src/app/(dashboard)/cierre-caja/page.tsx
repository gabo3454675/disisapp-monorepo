'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Loader2,
  Wallet,
  Receipt,
  DoorOpen,
  DoorClosed,
  History,
  Printer,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';

interface CierreAbierto {
  id: number;
  fechaApertura: string;
  montoInicial: number;
  ventasEfectivo: number;
  ventasDigitales: number;
  ventasEfectivoUsd: number;
  ventasEfectivoBs: number;
  ventasPagoMovil: number;
  ventasPos: number;
  autoconsumos: number;
  user?: { id: number; fullName?: string; email?: string };
  notaAutoconsumos?: string;
}

interface CierreCerrado {
  id: number;
  fechaApertura: string;
  fechaCierre: string;
  estado: string;
  montoInicial: number;
  montoFisico?: number | null;
  montoFisicoUsd?: number | null;
  montoFisicoVes?: number | null;
  diferencia?: number | null;
  diferenciaUsd?: number | null;
  diferenciaVes?: number | null;
  totalUsd?: number | null;
  totalVes?: number | null;
  impreso?: boolean | null;
  observaciones?: string | null;
  user?: { id: number; fullName?: string; email?: string };
}

export default function CierreCajaPage() {
  const { formatForDisplay } = useDisplayCurrency();
  const [abierto, setAbierto] = useState<CierreAbierto | null | undefined>(undefined);
  const [historial, setHistorial] = useState<CierreCerrado[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successClose, setSuccessClose] = useState<CierreCerrado | null>(null);

  // Form apertura
  const [montoInicial, setMontoInicial] = useState<string>('0');
  // Form cierre
  const [montoFisicoUsd, setMontoFisicoUsd] = useState<string>('');
  const [montoFisicoVes, setMontoFisicoVes] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');

  const fetchAbierto = useCallback(async () => {
    try {
      const res = await apiClient.get<CierreAbierto | null>('/cierre-caja/abierto');
      setAbierto(res.data ?? null);
    } catch (e: unknown) {
      setAbierto(null);
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Error al cargar turno';
      setError(String(msg));
    }
  }, []);

  const fetchHistorial = useCallback(async () => {
    try {
      const res = await apiClient.get<CierreCerrado[]>('/cierre-caja', {
        params: { estado: 'CLOSED', limit: 20 },
      });
      setHistorial(Array.isArray(res.data) ? res.data : []);
    } catch {
      setHistorial([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchAbierto(), fetchHistorial()]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [fetchAbierto, fetchHistorial]);

  const handleApertura = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    const num = parseFloat(montoInicial) || 0;
    if (num < 0) {
      setError('El monto inicial no puede ser negativo.');
      setSending(false);
      return;
    }
    try {
      await apiClient.post('/cierre-caja/apertura', { montoInicial: num });
      setMontoInicial('0');
      await fetchAbierto();
      await fetchHistorial();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Error al abrir turno';
      setError(String(msg));
    } finally {
      setSending(false);
    }
  };

  const handleCerrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSuccessClose(null);
    const usd = parseFloat(montoFisicoUsd) || 0;
    const ves = parseFloat(montoFisicoVes) || 0;
    try {
      const res = await apiClient.post<CierreCerrado>('/cierre-caja/cerrar', {
        montoFisicoUsd: usd,
        montoFisicoVes: ves,
        observaciones: observaciones.trim() || undefined,
      });
      setSuccessClose(res.data);
      setMontoFisicoUsd('');
      setMontoFisicoVes('');
      setObservaciones('');
      await fetchAbierto();
      await fetchHistorial();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { message?: string } } }).response?.data?.message
        : 'Error al cerrar turno';
      setError(String(msg));
    } finally {
      setSending(false);
    }
  };

  const handleImprimir = async (cierreId: number) => {
    try {
      const res = await apiClient.get<{ ticketText: string; resumenUrl: string; qrDataUrl: string }>(
        `/cierre-caja/${cierreId}/ticket`,
        { params: { ancho: 80 } },
      );
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(
          `<pre style="font-family: monospace; white-space: pre-wrap; padding: 8px;">${res.data.ticketText}</pre>` +
          (res.data.resumenUrl ? `<p><a href="${res.data.resumenUrl}" target="_blank">Ver resumen digital</a></p>` : ''),
        );
        w.document.close();
      }
    } catch {
      setError('No se pudo generar el ticket.');
    }
  };

  if (loading && abierto === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Cierre de caja</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Abre o cierra tu turno. El mismo turno abierto en la app se puede ver y cerrar aquí.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {successClose && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <DoorClosed className="h-5 w-5" />
              Turno cerrado correctamente
            </CardTitle>
            <CardDescription>
              Diferencia USD: {formatForDisplay(successClose.diferenciaUsd ?? successClose.diferencia ?? 0)} · 
              Diferencia Bs: {formatForDisplay(successClose.diferenciaVes ?? 0)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleImprimir(successClose.id)}
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimir ticket
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSuccessClose(null)}>
              Cerrar aviso
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Turno abierto: X-Report y formulario de cierre */}
      {abierto && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Turno abierto (X-Report)
            </CardTitle>
            <CardDescription>
              Cajero: {abierto.user?.fullName || abierto.user?.email || '—'} · 
              Apertura: {new Date(abierto.fechaApertura).toLocaleString('es')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-md border bg-muted/30 p-3">
                <span className="text-muted-foreground">Monto inicial</span>
                <p className="font-medium">{formatForDisplay(abierto.montoInicial)}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <span className="text-muted-foreground">Efectivo USD</span>
                <p className="font-medium">{formatForDisplay(abierto.ventasEfectivoUsd ?? 0)}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <span className="text-muted-foreground">Efectivo Bs</span>
                <p className="font-medium">{formatForDisplay(abierto.ventasEfectivoBs ?? 0)}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <span className="text-muted-foreground">Pago móvil Bs</span>
                <p className="font-medium">{formatForDisplay(abierto.ventasPagoMovil ?? 0)}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <span className="text-muted-foreground">POS / Zelle USD</span>
                <p className="font-medium">{formatForDisplay(abierto.ventasPos ?? 0)}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <span className="text-muted-foreground">Autoconsumos (no monetario)</span>
                <p className="font-medium">{formatForDisplay(abierto.autoconsumos ?? 0)}</p>
              </div>
            </div>
            {abierto.notaAutoconsumos && (
              <p className="text-xs text-muted-foreground">{abierto.notaAutoconsumos}</p>
            )}

            <form onSubmit={handleCerrar} className="space-y-4 border-t pt-4">
              <h3 className="font-medium">Cerrar turno (Z-Report)</h3>
              <p className="text-sm text-muted-foreground">
                Ingresa el monto físico contado en caja (USD y Bs) para conciliar.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="montoFisicoUsd">Monto físico USD</Label>
                  <Input
                    id="montoFisicoUsd"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={montoFisicoUsd}
                    onChange={(e) => setMontoFisicoUsd(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="montoFisicoVes">Monto físico Bs</Label>
                  <Input
                    id="montoFisicoVes"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={montoFisicoVes}
                    onChange={(e) => setMontoFisicoVes(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="observaciones">Observaciones (opcional)</Label>
                <Input
                  id="observaciones"
                  placeholder="Ej: faltante por..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  maxLength={500}
                />
              </div>
              <Button type="submit" disabled={sending}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DoorClosed className="mr-2 h-4 w-4" />}
                Cerrar turno
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Sin turno abierto: formulario de apertura */}
      {!abierto && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5" />
              Abrir turno
            </CardTitle>
            <CardDescription>
              Indica el monto inicial en caja (USD) para iniciar tu turno. Puedes abrirlo desde la app o desde aquí.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleApertura} className="flex flex-wrap items-end gap-4">
              <div className="min-w-[180px] space-y-2">
                <Label htmlFor="montoInicial">Monto inicial (USD)</Label>
                <Input
                  id="montoInicial"
                  type="number"
                  step="0.01"
                  min="0"
                  value={montoInicial}
                  onChange={(e) => setMontoInicial(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={sending}>
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DoorOpen className="mr-2 h-4 w-4" />}
                Abrir caja
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Historial de cierres */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Últimos cierres
          </CardTitle>
          <CardDescription>
            Listado de turnos ya cerrados. Puedes imprimir el ticket desde aquí.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historial.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay cierres recientes.</p>
          ) : (
            <ul className="space-y-2">
              {historial.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {new Date(c.fechaCierre).toLocaleString('es')} · 
                      {c.user?.fullName || c.user?.email || '—'} · 
                      Dif. USD: {formatForDisplay(c.diferenciaUsd ?? c.diferencia ?? 0)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleImprimir(c.id)}
                  >
                    <Printer className="mr-1 h-4 w-4" />
                    Ticket
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
