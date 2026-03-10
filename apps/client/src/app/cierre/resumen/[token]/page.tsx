'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import apiClient from '@/lib/api';

interface ResumenData {
  id: number;
  tenantNombre: string;
  cajero: string;
  fechaApertura: string;
  fechaCierre: string;
  montoInicial: number;
  ventasEfectivo: number;
  ventasDigitales: number;
  ventasEfectivoUsd?: number;
  ventasEfectivoBs?: number;
  ventasPagoMovil?: number;
  ventasPos?: number;
  autoconsumos: number;
  notaAutoconsumos: string;
  montoFisico: number | null;
  montoEsperado: number;
  diferencia: number | null;
  observaciones: string | null;
}

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleString('es');
  } catch {
    return s;
  }
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('es', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function CierreResumenPage() {
  const params = useParams();
  const token = params?.token as string;
  const [data, setData] = useState<ResumenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Enlace inválido');
      return;
    }
    apiClient
      .get<{ ok: boolean; data?: ResumenData; message?: string }>(`/cierre-caja/resumen/${token}`)
      .then((res) => {
        if (res.data?.ok && res.data?.data) {
          setData(res.data.data);
        } else {
          setError(res.data?.message || 'Cierre no encontrado');
        }
      })
      .catch(() => setError('No se pudo cargar el resumen'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <p className="text-destructive text-center">{error || 'Resumen no disponible'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{data.tenantNombre}</CardTitle>
          <p className="text-sm text-muted-foreground">Resumen de cierre de caja (Z-Report)</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Cajero: <span className="text-foreground font-medium">{data.cajero}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Cierre: <span className="text-foreground">{formatDate(data.fechaCierre)}</span>
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Monto inicial $</span>
              <span>{formatMoney(data.montoInicial)}</span>
            </div>
            {(data.ventasEfectivoUsd != null || data.ventasEfectivoBs != null || data.ventasPagoMovil != null || data.ventasPos != null) ? (
              <>
                <div className="flex justify-between text-sm">
                  <span>Total Efectivo $</span>
                  <span>{formatMoney(data.ventasEfectivoUsd ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Efectivo Bs</span>
                  <span>{formatMoney(data.ventasEfectivoBs ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Pago Móvil (Bs)</span>
                  <span>{formatMoney(data.ventasPagoMovil ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>POS / Zelle $</span>
                  <span>{formatMoney(data.ventasPos ?? 0)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span>Ventas efectivo $</span>
                  <span>{formatMoney(data.ventasEfectivo)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Ventas digitales</span>
                  <span>{formatMoney(data.ventasDigitales)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm">
              <span>Salida no monetaria</span>
              <span>{formatMoney(data.autoconsumos)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{data.notaAutoconsumos}</p>
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Monto esperado</span>
              <span>{formatMoney(data.montoEsperado)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Monto físico</span>
              <span>{data.montoFisico != null ? formatMoney(data.montoFisico) : '-'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Diferencia</span>
              <span className={data.diferencia != null && data.diferencia !== 0 ? 'font-medium' : ''}>
                {data.diferencia != null ? formatMoney(data.diferencia) : '-'}
              </span>
            </div>
          </div>

          {data.observaciones && (
            <p className="text-sm text-muted-foreground border-t pt-4">Obs: {data.observaciones}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
