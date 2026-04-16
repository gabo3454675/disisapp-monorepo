'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, Edit, Trash2, Search, Loader2, Wine } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermission } from '@/hooks/usePermission';
import { Badge } from '@/components/ui/badge';

type SalePriceCurrency = 'USD' | 'VES';

interface Product {
  id: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  costPrice: number;
  salePrice: number;
  salePriceCurrency?: string | null;
  stock: number;
  minStock: number;
  isBundle?: boolean;
  bundleComponents?: unknown;
  isService?: boolean;
}

export default function ServiciosCombosPage() {
  const { selectedCompanyId } = useAuthStore();
  const { canManageProducts, canDelete } = usePermission();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    salePrice: '',
    salePriceCurrency: 'USD' as SalePriceCurrency,
    costPrice: '',
    isBundle: false,
    isService: false,
    bundleComponentsJson: '[\n  { "productId": 0, "quantity": 1 }\n]',
  });
  const [submitting, setSubmitting] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const fetchProducts = useCallback(async () => {
    if (!selectedCompanyId) return;
    try {
      setLoading(true);
      const response = await apiClient.get<Product[]>('/products');
      setProducts(response.data);
    } catch (error: unknown) {
      console.error(error);
      alert('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const serviciosYCombos = useMemo(() => {
    return products.filter((p) => p.isBundle || p.isService);
  }, [products]);

  const recipeCount = (p: Product) =>
    Array.isArray(p.bundleComponents) ? p.bundleComponents.length : 0;

  const filtered = useMemo(() => {
    if (!debouncedSearchQuery) return serviciosYCombos;
    const q = debouncedSearchQuery.toLowerCase();
    return serviciosYCombos.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q),
    );
  }, [serviciosYCombos, debouncedSearchQuery]);

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        barcode: product.barcode || '',
        salePrice: product.salePrice.toString(),
        salePriceCurrency: (product.salePriceCurrency === 'VES' ? 'VES' : 'USD') as SalePriceCurrency,
        costPrice: product.costPrice.toString(),
        isBundle: !!product.isBundle,
        isService: !!product.isService && !product.isBundle,
        bundleComponentsJson: product.bundleComponents
          ? JSON.stringify(product.bundleComponents, null, 2)
          : product.isBundle
            ? '[\n  { "productId": 0, "quantity": 1 }\n]'
            : '[]',
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        sku: '',
        barcode: '',
        salePrice: '',
        salePriceCurrency: 'USD',
        costPrice: '',
        isBundle: false,
        isService: true,
        bundleComponentsJson: '[]',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProduct(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.salePrice) {
      alert('Nombre y precio de venta son obligatorios');
      return;
    }
    if (formData.isBundle && formData.isService) {
      alert('Un ítem no puede ser servicio y combo a la vez');
      return;
    }

    setSubmitting(true);
    try {
      let bundleComponents: unknown = undefined;
      if (formData.isBundle) {
        try {
          bundleComponents = JSON.parse(formData.bundleComponentsJson);
        } catch {
          alert('JSON de combo inválido. Formato: [{"productId":1,"quantity":2}]');
          setSubmitting(false);
          return;
        }
        if (!Array.isArray(bundleComponents)) {
          alert('Los componentes del combo deben ser un arreglo [...]');
          setSubmitting(false);
          return;
        }
      } else if (formData.isService) {
        try {
          const raw = formData.bundleComponentsJson.trim() || '[]';
          bundleComponents = JSON.parse(raw);
        } catch {
          alert('JSON de productos incluidos inválido. Use [] si no descuenta inventario.');
          setSubmitting(false);
          return;
        }
        if (!Array.isArray(bundleComponents)) {
          alert('Debe ser un arreglo, p. ej. [{"productId":1,"quantity":1}]');
          setSubmitting(false);
          return;
        }
      }

      const productData: Record<string, unknown> = {
        name: formData.name,
        sku: formData.sku || undefined,
        barcode: formData.barcode || undefined,
        salePrice: parseFloat(formData.salePrice),
        salePriceCurrency: formData.salePriceCurrency,
        costPrice: formData.costPrice ? parseFloat(formData.costPrice) : undefined,
        isBundle: formData.isBundle,
        isService: formData.isBundle ? false : formData.isService,
      };

      if (formData.isBundle) {
        productData.bundleComponents = bundleComponents;
      } else if (formData.isService) {
        productData.bundleComponents =
          Array.isArray(bundleComponents) && bundleComponents.length > 0 ? bundleComponents : null;
      } else {
        productData.isBundle = false;
        productData.bundleComponents = null;
      }

      if (editingProduct) {
        await apiClient.patch(`/products/${editingProduct.id}`, productData);
        alert('Actualizado correctamente');
      } else {
        await apiClient.post('/products', productData);
        alert('Creado correctamente');
      }
      handleCloseDialog();
      fetchProducts();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este ítem del catálogo?')) return;
    try {
      await apiClient.delete(`/products/${id}`);
      alert('Eliminado');
      fetchProducts();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || 'Error al eliminar');
    }
  };

  const formatUsd = (n: number) =>
    new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(n);

  if (!canManageProducts) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No tienes permisos para esta sección.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2 flex items-center gap-2">
            <Wine className="h-8 w-8 text-amber-700 dark:text-amber-500" />
            Servicios y combos
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            <strong>Combo:</strong> precio del paquete y descuento obligatorio de componentes (JSON).{' '}
            <strong>Servicio:</strong> cobras un precio (p. ej. descorche); el ítem servicio no tiene stock. Si
            incluyes JSON opcional (hielo, jugo, refresco…), al vender se descuenta ese inventario igual que en un
            combo.
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo servicio o combo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo</CardTitle>
          <CardDescription>
            Solo se listan ítems marcados como servicio o combo. El resto del inventario sigue en «Inventario».
          </CardDescription>
          <div className="pt-2">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nombre, SKU o código..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              No hay servicios ni combos aún. Cree uno o marque productos en Inventario como combo/servicio.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="hidden sm:table-cell">Insumos</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        {p.isBundle ? (
                          <Badge variant="secondary">Combo</Badge>
                        ) : recipeCount(p) > 0 ? (
                          <Badge variant="outline" className="border-amber-600/50 text-amber-900 dark:text-amber-200">
                            Servicio + insumos
                          </Badge>
                        ) : (
                          <Badge variant="outline">Servicio</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                        {recipeCount(p) > 0 ? `${recipeCount(p)} ítem(s)` : '—'}
                      </TableCell>
                      <TableCell>{formatUsd(Number(p.salePrice))}</TableCell>
                      <TableCell className="text-muted-foreground">{p.sku || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(p)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {canDelete && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar' : 'Nuevo servicio o combo'}</DialogTitle>
            <DialogDescription>
              Un mismo formato JSON sirve para combos (obligatorio) y para servicios con insumos (opcional):{' '}
              <code className="text-xs">[&#123; &quot;productId&quot;: 1, &quot;quantity&quot;: 2 &#125;]</code>.
              Cantidades son por unidad vendida del combo/servicio.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((s) => ({ ...s, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData((s) => ({ ...s, sku: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Código de barras</Label>
                <Input
                  value={formData.barcode}
                  onChange={(e) => setFormData((s) => ({ ...s, barcode: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Precio venta *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.salePrice}
                  onChange={(e) => setFormData((s) => ({ ...s, salePrice: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Moneda precio</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={formData.salePriceCurrency}
                  onChange={(e) =>
                    setFormData((s) => ({ ...s, salePriceCurrency: e.target.value as SalePriceCurrency }))
                  }
                >
                  <option value="USD">USD</option>
                  <option value="VES">VES</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Costo interno (opcional)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.costPrice}
                onChange={(e) => setFormData((s) => ({ ...s, costPrice: e.target.value }))}
              />
            </div>

            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={formData.isBundle}
                  onChange={(e) => {
                    const c = e.target.checked;
                    setFormData((s) => ({
                      ...s,
                      isBundle: c,
                      isService: c ? false : s.isService,
                    }));
                  }}
                />
                <span className="text-sm">Combo — paquete con precio único; componentes obligatorios</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  disabled={formData.isBundle}
                  checked={formData.isService}
                  onChange={(e) => {
                    const c = e.target.checked;
                    setFormData((s) => ({
                      ...s,
                      isService: c,
                      isBundle: c ? false : s.isBundle,
                    }));
                  }}
                />
                <span className="text-sm">Servicio — cobro (descorche, cubierto…); insumos opcionales abajo</span>
              </label>
            </div>

            {(formData.isBundle || formData.isService) && (
              <div className="space-y-2">
                <Label>
                  {formData.isBundle
                    ? 'Componentes del combo (JSON) *'
                    : 'Productos de inventario incluidos (JSON, opcional)'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {formData.isService
                    ? 'Vacío [] = solo cobro, sin mover stock. Con IDs = descuenta hielo, jugo, botellas, etc.'
                    : 'Lista de productId existentes en Inventario y cantidades por 1 unidad de combo.'}
                </p>
                <textarea
                  className="w-full min-h-[140px] rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                  value={formData.bundleComponentsJson}
                  onChange={(e) => setFormData((s) => ({ ...s, bundleComponentsJson: e.target.value }))}
                />
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
