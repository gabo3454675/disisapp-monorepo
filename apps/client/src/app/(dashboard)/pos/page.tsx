'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShoppingCart, Plus, Minus, Trash2, Search, Package, CheckCircle2, Loader2, Printer } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { Badge } from '@/components/ui/badge';
import { useDebounce } from '@/hooks/useDebounce';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { db } from '@/lib/db';
import { toast } from 'sonner';
import {
  round2,
  convertToPaymentCurrency as convertToPaymentCurrencyService,
  getIvaBaseInBs,
  calculateIvaOnBaseInBs,
  calculateTotalInBs,
  calculateIgtfOnSubtotalUsd,
  type PaymentCurrency as PaymentCurrencyType,
  type ProductCurrency,
} from '@/lib/currencyConversion';

interface Product {
  id: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  costPrice: number;
  salePrice: number;
  /** Moneda en que está registrado el precio: USD o VES. Por defecto USD. */
  salePriceCurrency?: string | null;
  stock: number;
  imageUrl?: string | null;
  minStock: number;
  isExempt?: boolean;
}

type CurrencyMode = 'BS' | 'USD';
type PaymentMethod = 'CASH' | 'ZELLE' | 'CARD' | 'CREDIT';

interface Customer {
  id: number;
  name: string;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function POSPage() {
  const { selectedCompanyId } = useAuthStore();
  const rawRate = useExchangeRate();
  const tasaBcv = Number.isFinite(rawRate) && rawRate > 0 ? rawRate : 1;
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastInvoiceId, setLastInvoiceId] = useState<number | null>(null);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('USD');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [customerCredit, setCustomerCredit] = useState<{
    limitAmount: number;
    currentBalance: number;
    status: string;
    available: number;
  } | null>(null);

  // Cargar productos
  const fetchProducts = useCallback(async () => {
    if (!selectedCompanyId) return;

    try {
      const response = await apiClient.get<Product[]>('/products');
      setProducts(response.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  // Cargar clientes
  const fetchCustomers = useCallback(async () => {
    if (!selectedCompanyId) return;

    try {
      const response = await apiClient.get<Customer[]>('/customers');
      setCustomers(response.data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, [fetchProducts, fetchCustomers]);

  // Al elegir cliente, cargar crédito si existe (para mostrar límite disponible al elegir Crédito)
  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerCredit(null);
      return;
    }
    apiClient
      .get(`/credits/customer/${selectedCustomerId}`)
      .then((res) => {
        const c = res.data;
        const limit = Number(c.limitAmount ?? 0);
        const balance = Number(c.currentBalance ?? 0);
        setCustomerCredit({
          limitAmount: limit,
          currentBalance: balance,
          status: c.status,
          available: limit - balance,
        });
      })
      .catch(() => setCustomerCredit(null));
  }, [selectedCustomerId]);

  // Filtrar productos por búsqueda (usando debounce)
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

  // Agregar producto al carrito
  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.product.id === product.id);
      if (existingItem) {
        // Si ya existe, incrementar cantidad
        return prevCart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        // Si no existe, agregar nuevo item
        return [...prevCart, { product, quantity: 1 }];
      }
    });
  };

  // Actualizar cantidad en el carrito
  const updateQuantity = (productId: number, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.product.id === productId) {
            const newQuantity = item.quantity + delta;
            if (newQuantity <= 0) return null;
            return { ...item, quantity: newQuantity };
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  // Remover item del carrito
  const removeFromCart = (productId: number) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
  };

  /**
   * Precio unitario en la moneda de pago usando el servicio de conversión.
   * Conversión USD→BS con la tasa configurada antes de aplicar IVA cuando pago en BS.
   */
  const getUnitPriceInPaymentCurrency = useMemo(() => {
    return (product: Product): number => {
      const price = Number(product.salePrice);
      const productCurrency: ProductCurrency = product.salePriceCurrency === 'VES' ? 'VES' : 'USD';
      const paymentCurrency: PaymentCurrencyType = currencyMode === 'BS' ? 'BS' : 'USD';
      return convertToPaymentCurrencyService(price, productCurrency, paymentCurrency, tasaBcv);
    };
  }, [currencyMode, tasaBcv]);

  /**
   * Totales: conversión con tasa configurada y IVA 16% sobre monto en BS (cuando pago en Bolívares).
   */
  const { subtotal, tax, taxLabel, total } = useMemo(() => {
    const getUnit = getUnitPriceInPaymentCurrency;
    const sub = cart.reduce(
      (sum, item) => sum + getUnit(item.product) * item.quantity,
      0
    );
    const subRounded = round2(sub);
    const isExemptProduct = (p: Product) => p.isExempt === true;

    if (currencyMode === 'BS') {
      const lineAmountsInBs = cart.map((item) => getUnit(item.product) * item.quantity);
      const ivaBaseBs = getIvaBaseInBs(lineAmountsInBs, (i) => isExemptProduct(cart[i].product));
      const iva = calculateIvaOnBaseInBs(ivaBaseBs);
      return {
        subtotal: subRounded,
        tax: iva,
        taxLabel: 'IVA (16%)',
        total: calculateTotalInBs(subRounded, ivaBaseBs),
      };
    }
    const igft = calculateIgtfOnSubtotalUsd(subRounded);
    return {
      subtotal: subRounded,
      tax: igft,
      taxLabel: 'IGFT (3%)',
      total: round2(subRounded * 1.03),
    };
  }, [cart, currencyMode, getUnitPriceInPaymentCurrency]);

  // Procesar venta (online → API; offline → IndexedDB para sincronizar después)
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'CREDIT') {
      if (!selectedCustomerId) {
        toast.error('Seleccione un cliente para venta a crédito');
        return;
      }
      if (customerCredit?.status !== 'ACTIVE' || (customerCredit?.available ?? 0) < total) {
        toast.error('Crédito insuficiente o cliente sin crédito activo. Verifique el límite en Cuentas por Cobrar.');
        return;
      }
    }

    setProcessing(true);
    setSuccess(false);

    const invoiceData = {
      customerId: selectedCustomerId || undefined,
      paymentMethod,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
    };

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    try {
      if (isOffline) {
        // Modo offline: guardar en IndexedDB (Dexie) para sincronizar al volver online
        await db.pendingInvoices.add({
          payload: invoiceData,
          createdAt: Date.now(),
          synced: false,
        });
        setCart([]);
        setSelectedCustomerId(null);
        setSuccess(true);
        toast.info('Factura guardada localmente', {
          description: 'Se enviará al servidor cuando haya conexión.',
        });
        setTimeout(() => setSuccess(false), 8000);
      } else {
        const response = await apiClient.post('/invoices', invoiceData);
        setCart([]);
        setSelectedCustomerId(null);
        setSuccess(true);
        setLastInvoiceId(response.data.id);
        await fetchProducts();
        setTimeout(() => {
          setSuccess(false);
          setLastInvoiceId(null);
        }, 10000);
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al procesar la venta');
      console.error('Error processing sale:', error);
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number, forceCurrency?: CurrencyMode) => {
    const mode = forceCurrency ?? currencyMode;
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: mode === 'BS' ? 'VES' : 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto h-full flex flex-col">
      <div className="mb-2 md:mb-6">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 md:mb-2">Punto de Venta</h1>
        <p className="text-muted-foreground text-sm md:text-base">Procesa ventas rápidamente</p>
      </div>

      {/* Barra fija móvil: Resumen + Cobrar siempre visibles (mobile-first) */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-4 py-3 px-4 -mx-4 md:-mx-6 mb-4 md:mb-0 bg-background/95 border-b border-border md:hidden backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-xl font-bold tabular-nums">{formatCurrency(total)}</span>
        </div>
        <Button
          className="shrink-0 h-11 px-6 text-base font-semibold"
          onClick={handleCheckout}
          disabled={cart.length === 0 || processing}
        >
          {processing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            'COBRAR'
          )}
        </Button>
      </div>

      {success && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-green-800 dark:text-green-200 font-medium">
                ¡Venta procesada exitosamente!
              </span>
            </div>
            {lastInvoiceId && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const response = await apiClient.get(`/invoices/${lastInvoiceId}/pdf`, {
                      responseType: 'blob',
                    });
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
                    link.download = `factura-${lastInvoiceId}.pdf`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                  } catch (error: any) {
                    console.error('Error downloading PDF:', error);
                    alert(error.response?.data?.message ?? 'Error al descargar la factura');
                  }
                }}
                className="bg-white dark:bg-gray-800"
              >
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Factura
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Panel Izquierdo - Catálogo */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader>
              <CardTitle>Catálogo de Productos</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0">
              {/* Barra de búsqueda */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar producto, SKU o código de barras..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Lista de productos */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {filteredProducts.map((product) => (
                      <Card
                        key={product.id}
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => product.stock > 0 && addToCart(product)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-center mb-2">
                            <Package className="h-12 w-12 text-muted-foreground" />
                          </div>
                          <h3 className="font-semibold text-sm mb-1 line-clamp-2">{product.name}</h3>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-lg font-bold text-primary">
                              {formatCurrency(getUnitPriceInPaymentCurrency(product))}
                            </span>
                            <Badge
                              variant={product.stock > 0 ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              Stock: {product.stock}
                            </Badge>
                          </div>
                          {product.stock === 0 && (
                            <p className="text-xs text-destructive">Sin stock</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {filteredProducts.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      No se encontraron productos
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Panel Derecho - Carrito (sticky en desktop para no perder Cobrar al hacer scroll) */}
        <div className="flex flex-col min-h-0 lg:sticky lg:top-14 lg:self-start lg:max-h-[calc(100vh-5rem)]">
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Carrito de Venta
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0">
              {/* Selector de Moneda: Bolívares / Dólares */}
              <div className="mb-4">
                <Label className="block mb-2">Moneda de pago</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={currencyMode === 'BS' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setCurrencyMode('BS')}
                  >
                    Bolívares
                  </Button>
                  <Button
                    type="button"
                    variant={currencyMode === 'USD' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setCurrencyMode('USD')}
                  >
                    Dólares
                  </Button>
                </div>
              </div>

              {/* Selector de Cliente */}
              <div className="mb-4">
                <Label htmlFor="customer">Cliente</Label>
                <select
                  id="customer"
                  value={selectedCustomerId || ''}
                  onChange={(e) => setSelectedCustomerId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full mt-1 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Cliente Genérico</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                {paymentMethod === 'CREDIT' && customerCredit && (
                  <p className="text-xs mt-1 text-muted-foreground">
                    Límite disponible: ${customerCredit.available.toFixed(2)}
                    {total > customerCredit.available && (
                      <span className="text-destructive ml-1">(insuficiente)</span>
                    )}
                  </p>
                )}
              </div>

              {/* Método de pago */}
              <div className="mb-4">
                <Label className="block mb-2">Método de pago</Label>
                <div className="flex flex-wrap gap-2">
                  {(['CASH', 'ZELLE', 'CARD', 'CREDIT'] as const).map((method) => (
                    <Button
                      key={method}
                      type="button"
                      variant={paymentMethod === method ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentMethod(method)}
                    >
                      {method === 'CASH' ? 'Efectivo' : method === 'ZELLE' ? 'Zelle' : method === 'CARD' ? 'Tarjeta' : 'Crédito'}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Items del carrito */}
              <div className="flex-1 overflow-y-auto mb-4 min-h-0">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">El carrito está vacío</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="p-3 border border-border rounded-lg bg-secondary/50"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">{item.product.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(getUnitPriceInPaymentCurrency(item.product))} c/u
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.product.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-semibold">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.product.id, 1)}
                              disabled={item.quantity >= item.product.stock}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="font-bold">
                            {formatCurrency(round2(getUnitPriceInPaymentCurrency(item.product) * item.quantity))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumen financiero: Subtotal, Impuesto (IVA/IGFT), Total */}
              <div className="space-y-2 pt-4 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{taxLabel}</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-border">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Botón de cobrar */}
              <Button
                className="w-full mt-4 h-12 text-lg font-semibold"
                onClick={handleCheckout}
                disabled={cart.length === 0 || processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'COBRAR'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
