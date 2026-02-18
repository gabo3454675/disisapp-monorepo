'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import apiClient from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { Loader2, Package, AlertCircle } from 'lucide-react';

const MOVEMENT_TYPES = [
  { value: 'AUTOCONSUMO', label: 'Autoconsumo' },
  { value: 'MERMA_VENCIDO', label: 'Merma (vencido)' },
  { value: 'MERMA_DANADO', label: 'Merma (dañado)' },
] as const;

interface Product {
  id: number;
  name: string;
  sku?: string | null;
  stock: number;
}

interface Movement {
  id: number;
  type: string;
  quantity: number;
  reason: string | null;
  productId: number;
  createdAt: string;
  product?: { id: number; name: string; sku: string | null };
  user?: { id: number; email: string; fullName: string | null };
}

export default function InventoryMovementsPage() {
  const { canManageInventory } = usePermission();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({
    type: 'MERMA_VENCIDO' as (typeof MOVEMENT_TYPES)[number]['value'],
    productId: '',
    quantity: '1',
    reason: '',
  });

  useEffect(() => {
    apiClient.get<Product[]>('/products').then((res) => {
      setProducts(res.data ?? []);
    }).catch(() => setProducts([])).finally(() => setLoadingProducts(false));
  }, []);

  useEffect(() => {
    apiClient.get<Movement[]>('/inventory/movements').then((res) => {
      setMovements(res.data ?? []);
    }).catch(() => setMovements([])).finally(() => setLoadingMovements(false));
  }, []);

  const refreshMovements = () => {
    apiClient.get<Movement[]>('/inventory/movements').then((res) => setMovements(res.data ?? [])).catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const productId = parseInt(form.productId, 10);
    const quantity = parseInt(form.quantity, 10);
    if (!productId || quantity < 1) {
      setMessage({ type: 'error', text: 'Selecciona un producto y una cantidad válida.' });
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post('/inventory/movements', {
        type: form.type,
        productId,
        quantity,
        reason: form.reason.trim() || undefined,
      });
      setMessage({ type: 'success', text: 'Salida registrada. Stock actualizado.' });
      setForm((prev) => ({ ...prev, quantity: '1', reason: '' }));
      refreshMovements();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage({ type: 'error', text: msg ?? 'Error al registrar la salida.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!canManageInventory) {
    return (
      <div className="p-4 md:p-8 max-w-4xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No tienes permisos para acceder a Movimientos de inventario.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Movimientos de inventario</h1>
        <p className="text-muted-foreground">
          Registra salidas por autoconsumo o mermas (vencido/dañado). El stock se descuenta al guardar.
        </p>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            message.type === 'success'
              ? 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400'
              : 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400'
          }`}
        >
          {message.type === 'error' && <AlertCircle className="h-4 w-4 shrink-0" />}
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Nueva salida
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((prev) => ({ ...prev, type: v as typeof form.type }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOVEMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Producto</Label>
              <Select
                value={form.productId}
                onValueChange={(v) => setForm((prev) => ({ ...prev, productId: v }))}
                disabled={loadingProducts}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingProducts ? 'Cargando...' : 'Seleccionar producto'} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} (stock: {p.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Motivo (opcional)</Label>
              <Input
                placeholder="Ej: Lote vencido, producto dañado"
                value={form.reason}
                onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registrar salida
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingMovements ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay movimientos.</p>
          ) : (
            <ul className="space-y-2">
              {movements.slice(0, 20).map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2 text-sm border-b pb-2 last:border-0">
                  <span className="font-medium">{m.product?.name ?? `Producto #${m.productId}`}</span>
                  <span className="text-muted-foreground">{m.type}</span>
                  <span>{m.quantity < 0 ? m.quantity : `+${m.quantity}`}</span>
                  {m.reason && <span className="text-muted-foreground truncate max-w-[200px]">{m.reason}</span>}
                  <span className="text-muted-foreground text-xs">
                    {new Date(m.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
