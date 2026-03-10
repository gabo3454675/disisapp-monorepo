'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Loader2 } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  stock: number;
}

interface StockAdjustSheetProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * Bottom sheet (móvil) / panel lateral (desktop) para ajuste rápido de stock sin recargar la página.
 */
export function StockAdjustSheet({
  product,
  open,
  onOpenChange,
  onSaved,
}: StockAdjustSheetProps) {
  const [stock, setStock] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product && open) {
      setStock(String(product.stock));
      setError(null);
    }
  }, [product, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    const value = parseInt(stock, 10);
    if (Number.isNaN(value) || value < 0) {
      setError('Ingresa un número válido ≥ 0');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const apiClient = (await import('@/lib/api')).default;
      await apiClient.patch(`/products/${product.id}`, { stock: value });
      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Error al actualizar el stock';
      setError(message ?? 'Error al actualizar el stock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl h-auto max-h-[85vh] pb-safe sm:max-w-md sm:left-1/2 sm:-translate-x-1/2 sm:rounded-lg"
      >
        <form onSubmit={handleSubmit}>
          <SheetHeader>
            <SheetTitle>Ajustar stock</SheetTitle>
            <SheetDescription>
              {product ? (
                <>
                  <span className="font-medium text-foreground">{product.name}</span>
                  <span className="text-muted-foreground"> — Cambia la cantidad en inventario sin recargar.</span>
                </>
              ) : (
                'Selecciona un producto'
              )}
            </SheetDescription>
          </SheetHeader>
          {product && (
            <div className="grid gap-4 py-6">
              <p className="text-sm text-muted-foreground">Stock actual: {product.stock}</p>
              <div className="grid gap-2">
                <Label htmlFor="stock-adjust">Nuevo stock</Label>
                <Input
                  id="stock-adjust"
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  disabled={saving}
                  className="text-base touch-manipulation"
                  inputMode="numeric"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
          <SheetFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !product}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
