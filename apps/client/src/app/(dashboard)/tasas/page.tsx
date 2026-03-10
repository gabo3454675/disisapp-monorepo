'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, TrendingUp, Calendar, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';

interface TasaHistorica {
  id: number;
  rate: number;
  source: string;
  effectiveAt: string;
  createdAt: string;
}

interface ResumenDia {
  date: string;
  tasaPromedio: number;
  tasaMin: number;
  tasaMax: number;
  totalUsd: number;
  totalBs: number;
  numFacturas: number;
}

interface ReporteDiferencial {
  desde: string;
  hasta: string;
  resumenPorDia: ResumenDia[];
  totalFacturas: number;
  tasasEnRango: number;
}

function getDefaultRange(): { desde: string; hasta: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    desde: start.toISOString().slice(0, 10),
    hasta: end.toISOString().slice(0, 10),
  };
}

export default function TasasPage() {
  const { formatForDisplay } = useDisplayCurrency();
  const defaultRange = getDefaultRange();
  const [tasas, setTasas] = useState<TasaHistorica[]>([]);
  const [reporte, setReporte] = useState<ReporteDiferencial | null>(null);
  const [desde, setDesde] = useState(defaultRange.desde);
  const [hasta, setHasta] = useState(defaultRange.hasta);
  const [loadingTasas, setLoadingTasas] = useState(true);
  const [loadingReporte, setLoadingReporte] = useState(false);

  const fetchTasas = useCallback(async () => {
    setLoadingTasas(true);
    try {
      const res = await apiClient.get<TasaHistorica[]>('/tenants/organization/tasas-historicas', {
        params: { limit: 100 },
      });
      setTasas(Array.isArray(res.data) ? res.data : []);
    } catch {
      setTasas([]);
    } finally {
      setLoadingTasas(false);
    }
  }, []);

  const fetchReporte = useCallback(async () => {
    if (!desde || !hasta) return;
    setLoadingReporte(true);
    setReporte(null);
    try {
      const res = await apiClient.get<ReporteDiferencial>(
        '/tenants/organization/reporte-diferencial-cambiario',
        { params: { desde, hasta } },
      );
      setReporte(res.data);
    } catch {
      setReporte(null);
    } finally {
      setLoadingReporte(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    fetchTasas();
  }, [fetchTasas]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Tasas BCV y diferencial cambiario
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Historial de tasas registradas y reporte de ganancia/pérdida por diferencial cambiario por período.
        </p>
      </div>

      {/* Historial de tasas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Historial de tasas
          </CardTitle>
          <CardDescription>
            Últimas tasas BCV usadas en facturas y cierres de caja (auditoría).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTasas ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : tasas.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay registros de tasas aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha / hora</TableHead>
                    <TableHead className="text-right">Tasa (Bs/USD)</TableHead>
                    <TableHead>Fuente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasas.slice(0, 50).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">
                        {new Date(t.effectiveAt).toLocaleString('es')}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {t.rate.toFixed(4)}
                      </TableCell>
                      <TableCell>{t.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {tasas.length > 50 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Mostrando las últimas 50 de {tasas.length} registros.
                </p>
              )}
            </div>
          )}
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={fetchTasas} disabled={loadingTasas}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reporte diferencial cambiario */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reporte ganancia/pérdida por diferencial cambiario
          </CardTitle>
          <CardDescription>
            Resumen por día: tasa utilizada y totales facturados en USD y Bs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="desde">Desde</Label>
              <Input
                id="desde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hasta">Hasta</Label>
              <Input
                id="hasta"
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
            <Button onClick={fetchReporte} disabled={loadingReporte || !desde || !hasta}>
              {loadingReporte ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Calendar className="mr-2 h-4 w-4" />
              )}
              Generar reporte
            </Button>
          </div>

          {loadingReporte && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {reporte && !loadingReporte && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Período: {reporte.desde} a {reporte.hasta} · {reporte.totalFacturas} facturas · {reporte.tasasEnRango} tasas en rango.
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Tasa prom.</TableHead>
                      <TableHead className="text-right">Tasa min</TableHead>
                      <TableHead className="text-right">Tasa max</TableHead>
                      <TableHead className="text-right">Total USD</TableHead>
                      <TableHead className="text-right">Total Bs</TableHead>
                      <TableHead className="text-right">Facturas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reporte.resumenPorDia.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No hay datos para este período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      reporte.resumenPorDia.map((r) => (
                        <TableRow key={r.date}>
                          <TableCell>{r.date}</TableCell>
                          <TableCell className="text-right font-mono">{r.tasaPromedio.toFixed(4)}</TableCell>
                          <TableCell className="text-right font-mono">{r.tasaMin.toFixed(4)}</TableCell>
                          <TableCell className="text-right font-mono">{r.tasaMax.toFixed(4)}</TableCell>
                          <TableCell className="text-right">{formatForDisplay(r.totalUsd)}</TableCell>
                          <TableCell className="text-right">{formatForDisplay(r.totalBs)}</TableCell>
                          <TableCell className="text-right">{r.numFacturas}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
