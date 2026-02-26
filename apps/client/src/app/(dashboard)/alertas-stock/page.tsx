'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, Loader2, Package, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import Link from 'next/link';

interface AlertaProducto {
  id: number;
  name: string;
  sku: string | null;
  stock: number;
  minStock: number;
  salePrice: number;
}

export default function AlertasStockPage() {
  const { formatForDisplay } = useDisplayCurrency();
  const [items, setItems] = useState<AlertaProducto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlertas = useCallback(async () => {
    setError(null);
    try {
      const res = await apiClient.get<AlertaProducto[]>('/products/alertas-stock');
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError('No se pudo cargar la lista de alertas.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlertas();
  }, [fetchAlertas]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Alertas de inventario
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Productos con stock por debajo del mínimo. Las notificaciones se envían al registrar autoconsumos o ajustes que dejen el stock bajo el mínimo.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchAlertas(); }}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Productos bajo stock mínimo
          </CardTitle>
          <CardDescription>
            {items.length === 0
              ? 'No hay productos por debajo del mínimo configurado.'
              : `${items.length} producto(s) requieren atención.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Revisa el <Link href="/products" className="underline">inventario</Link> para ajustar cantidades o mínimos.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead className="text-right">Precio venta</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span className="font-medium">{p.name}</span>
                        {p.sku && (
                          <span className="ml-2 text-muted-foreground text-xs">SKU: {p.sku}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-amber-600 dark:text-amber-400">
                        {p.stock}
                      </TableCell>
                      <TableCell className="text-right">{p.minStock}</TableCell>
                      <TableCell className="text-right">{formatForDisplay(p.salePrice)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/products?editar=${p.id}`}>Editar</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
