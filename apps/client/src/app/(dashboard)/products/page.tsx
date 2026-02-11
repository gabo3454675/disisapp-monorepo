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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Plus, Edit, Trash2, Search, Loader2, Upload, FileSpreadsheet, CheckCircle2, XCircle } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { useDebounce } from '@/hooks/useDebounce';
import { usePermission } from '@/hooks/usePermission';

type SalePriceCurrency = 'USD' | 'VES';

interface Product {
  id: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  costPrice: number;
  salePrice: number;
  /** Moneda en que está registrado el precio (USD o VES). Por defecto USD. */
  salePriceCurrency?: string | null;
  stock: number;
  minStock: number;
  imageUrl?: string | null;
  isExempt?: boolean;
}

export default function ProductsPage() {
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
    stock: '',
    minStock: '5',
  });
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    uploading: boolean;
    created?: number;
    updated?: number;
    total?: number;
    errors?: string[];
  } | null>(null);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  if (!canManageProducts) {
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

  const handleDownloadInventoryTemplate = useCallback(async () => {
    try {
      const response = await apiClient.get('/inventory/template', {
        responseType: 'blob',
      });

      // Intentar obtener nombre desde Content-Disposition
      const disposition = response.headers?.['content-disposition'] as string | undefined;
      const match = disposition?.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] || 'inventory-template.xlsx';

      const blob = new Blob([response.data], {
        type:
          response.headers?.['content-type'] ||
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading template:', error);
      alert(
        error.response?.data?.message ||
          'No se pudo descargar la plantilla. Verifica que estás logueado y tienes una organización seleccionada.',
      );
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!selectedCompanyId) return;

    try {
      setLoading(true);
      const response = await apiClient.get<Product[]>('/products');
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
      alert('Error al cargar los productos');
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
        stock: product.stock.toString(),
        minStock: product.minStock.toString(),
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
        stock: '',
        minStock: '5',
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      salePrice: '',
      salePriceCurrency: 'USD',
      costPrice: '',
      stock: '',
      minStock: '5',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.salePrice) {
      alert('El nombre y el precio de venta son requeridos');
      return;
    }

    setSubmitting(true);

    try {
      const productData = {
        name: formData.name,
        sku: formData.sku || undefined,
        barcode: formData.barcode || undefined,
        salePrice: parseFloat(formData.salePrice),
        salePriceCurrency: formData.salePriceCurrency,
        costPrice: formData.costPrice ? parseFloat(formData.costPrice) : undefined,
        stock: formData.stock ? parseInt(formData.stock) : undefined,
        minStock: formData.minStock ? parseInt(formData.minStock) : undefined,
      };

      if (editingProduct) {
        await apiClient.patch(`/products/${editingProduct.id}`, productData);
        alert('Producto actualizado exitosamente');
      } else {
        await apiClient.post('/products', productData);
        alert('Producto creado exitosamente');
      }

      handleCloseDialog();
      fetchProducts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      alert(error.response?.data?.message || 'Error al guardar el producto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este producto?')) {
      return;
    }

    try {
      await apiClient.delete(`/products/${id}`);
      alert('Producto eliminado exitosamente');
      fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      alert(error.response?.data?.message || 'Error al eliminar el producto');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const filteredProducts = useMemo(() => {
    if (!debouncedSearchQuery) return products;
    const query = debouncedSearchQuery.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.sku?.toLowerCase().includes(query) ||
        product.barcode?.toLowerCase().includes(query)
    );
  }, [products, debouncedSearchQuery]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Productos</h1>
            <p className="text-muted-foreground">Gestiona tu catálogo de productos</p>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={handleDownloadInventoryTemplate}
              disabled={importing}
              className="w-full sm:w-auto shrink-0"
            >
              <Upload className="mr-2 h-4 w-4" />
              Descargar Plantilla
            </Button>
            <Button
              variant="outline"
              onClick={() => document.getElementById('file-input')?.click()}
              disabled={importing}
              className="w-full sm:w-auto shrink-0"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Importar Excel
                </>
              )}
            </Button>
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setImporting(true);
                setImportProgress({ uploading: true });

                try {
                  const formData = new FormData();
                  formData.append('file', file);
                  formData.append('confirm', 'true');

                  const response = await apiClient.post('/inventory/import', formData, {
                    headers: {
                      'Content-Type': 'multipart/form-data',
                    },
                  });

                  const data = response.data as { created?: number; updated?: number; summary?: { toCreate?: number; toUpdate?: number }; errors?: Array<{ message?: string } | string> };
                  const created = data.created ?? 0;
                  const updated = data.updated ?? 0;
                  const total = created + updated;
                  const errors = Array.isArray(data.errors)
                    ? data.errors.map((err) => (typeof err === 'string' ? err : err?.message ?? 'Error'))
                    : [];

                  setImportProgress({
                    uploading: false,
                    created,
                    updated,
                    total,
                    errors,
                  });

                  // Recargar productos después de 2 segundos para mostrar el resumen
                  setTimeout(() => {
                    fetchProducts();
                    setImportProgress(null);
                  }, 3000);
                } catch (error: any) {
                  console.error('Error importing products:', error);
                  const errData = error.response?.data;
                  const errors = Array.isArray(errData?.errors)
                    ? errData.errors.map((e: { message?: string } | string) => (typeof e === 'string' ? e : e?.message ?? 'Error'))
                    : [errData?.message || 'Error al importar productos'];
                  setImportProgress({
                    uploading: false,
                    errors,
                  });
                  
                  setTimeout(() => {
                    setImportProgress(null);
                  }, 3000);
                } finally {
                  setImporting(false);
                  // Reset input
                  if (e.target) {
                    e.target.value = '';
                  }
                }
              }}
            />
            {canManageProducts && (
              <Button
                onClick={() => handleOpenDialog()}
                disabled={importing}
                className="w-full sm:w-auto shrink-0"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Producto
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="shrink-0">Lista de Productos</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar productos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Resumen de importación */}
            {importProgress && !importProgress.uploading && (
              <div className={`mb-4 p-4 rounded-lg border ${
                importProgress.errors && importProgress.errors.length > 0
                  ? 'bg-destructive/10 border-destructive'
                  : 'bg-green-50 border-green-200'
              }`}>
                <div className="flex items-start gap-3">
                  {importProgress.errors && importProgress.errors.length > 0 ? (
                    <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">
                      {importProgress.errors && importProgress.errors.length > 0
                        ? 'Importación completada con errores'
                        : 'Importación completada exitosamente'}
                    </h4>
                    {importProgress.created !== undefined && importProgress.updated !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-green-600">{importProgress.created}</span> productos creados,{' '}
                        <span className="font-medium text-blue-600">{importProgress.updated}</span> productos actualizados
                        {importProgress.total !== undefined && (
                          <> de {importProgress.total} total</>
                        )}
                      </p>
                    )}
                    {importProgress.errors && importProgress.errors.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-destructive mb-1">
                          Errores ({importProgress.errors.length}):
                        </p>
                        <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                          {importProgress.errors.slice(0, 5).map((error, idx) => (
                            <li key={idx}>• {error}</li>
                          ))}
                          {importProgress.errors.length > 5 && (
                            <li className="text-muted-foreground">
                              ... y {importProgress.errors.length - 5} errores más
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Barra de progreso durante importación */}
            {importProgress?.uploading && (
              <div className="mb-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Procesando archivo Excel...</span>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
                <Progress value={undefined} className="h-2" />
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Cargando...</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">
                {searchQuery ? 'No se encontraron productos' : 'No hay productos registrados'}
              </p>
            ) : (
              <>
                {/* Vista tarjetas: móviles y pantallas pequeñas */}
                <div className="md:hidden space-y-3">
                  {filteredProducts.map((product) => (
                    <Card key={product.id} className="p-4">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{product.name}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatCurrency(Number(product.salePrice))} · Stock: {product.stock}
                            {product.barcode ? ` · ${product.barcode}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {canManageProducts && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleOpenDialog(product)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDelete(product.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                {/* Vista tabla: scroll horizontal en tablets, normal en desktop */}
                <div className="hidden md:block overflow-x-auto -mx-4 sm:mx-0 rounded-md border border-border">
                  <Table className="min-w-[600px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Código de Barras</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{formatCurrency(Number(product.salePrice))}</TableCell>
                          <TableCell>{product.stock}</TableCell>
                          <TableCell>{product.barcode || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {canManageProducts && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenDialog(product)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(product.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
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

        {/* Dialog para crear/editar */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </DialogTitle>
              <DialogDescription>
                {editingProduct
                  ? 'Modifica los datos del producto'
                  : 'Completa los datos para crear un nuevo producto'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">
                    Nombre <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="barcode">Código de Barras</Label>
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="costPrice">Precio de Costo</Label>
                    <Input
                      id="costPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.costPrice}
                      onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="salePrice">
                      Precio de Venta <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="salePrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.salePrice}
                      onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="salePriceCurrency">Moneda del precio de venta</Label>
                  <select
                    id="salePriceCurrency"
                    value={formData.salePriceCurrency}
                    onChange={(e) =>
                      setFormData({ ...formData, salePriceCurrency: e.target.value as SalePriceCurrency })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="USD">USD (Dólares)</option>
                    <option value="VES">BS (Bolívares)</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    El producto se guarda en esta moneda. En el POS se convierte con la tasa del día si el cliente paga en la otra moneda.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="stock">Stock</Label>
                    <Input
                      id="stock"
                      type="number"
                      min="0"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="minStock">Stock Mínimo</Label>
                    <Input
                      id="minStock"
                      type="number"
                      min="0"
                      value={formData.minStock}
                      onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    editingProduct ? 'Actualizar' : 'Crear'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
