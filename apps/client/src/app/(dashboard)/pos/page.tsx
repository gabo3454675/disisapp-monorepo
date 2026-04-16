'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Search,
  Package,
  CheckCircle2,
  Loader2,
  Printer,
} from 'lucide-react';
import apiClient, { invoiceService } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermission } from '@/hooks/usePermission';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useDebounce } from '@/hooks/useDebounce';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { db } from '@/lib/db';
import { toast } from 'sonner';
import { round2 } from '@/lib/currencyConversion';

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
  isBundle?: boolean;
  isService?: boolean;
  bundleComponents?: { productId: number; quantity: number }[] | null;
}

/** Servicio sin insumos: el backend no usa stock del ítem; el POS permite cantidad alta. */
const SERVICE_POS_MAX_QTY = 999_999;

type CurrencyMode = 'BS' | 'USD';
type PaymentMethod = 'CASH_USD' | 'CASH_BS' | 'PAGO_MOVIL' | 'ZELLE' | 'CARD' | 'CREDIT';

const BS_PAYMENT_METHODS: PaymentMethod[] = ['CASH_BS', 'PAGO_MOVIL'];

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH_USD: 'Efectivo USD',
  CASH_BS: 'Efectivo Bs',
  PAGO_MOVIL: 'Pago Móvil',
  ZELLE: 'Zelle',
  CARD: 'Tarjeta',
  CREDIT: 'Crédito',
};

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

interface TicketSummary {
  invoiceId?: number | null;
  /** Número consecutivo por organización (para mostrar en ticket) */
  consecutiveNumber?: number | null;
  customerName: string;
  createdAt: string;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  totalUsd: number;
  totalBs: number;
  currencyMode: CurrencyMode;
  paymentMethod: PaymentMethod | 'MIXED';
  /** Texto multilínea para ticket cuando hay pago combinado */
  paymentDetail?: string;
}

export default function POSPage() {
  const { selectedCompanyId, getCurrentOrganization } = useAuthStore();
  const { canManageCustomers } = usePermission();
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
  const [lastTicket, setLastTicket] = useState<TicketSummary | null>(null);
  const [currencyMode, setCurrencyMode] = useState<CurrencyMode>('USD');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH_USD');
  /** Varios medios en un solo cobro (ej. parte en $ y parte en pago móvil Bs). */
  const [splitPayment, setSplitPayment] = useState(false);
  const [splitLines, setSplitLines] = useState<Array<{ method: PaymentMethod; amount: string }>>([
    { method: 'CASH_USD', amount: '' },
    { method: 'PAGO_MOVIL', amount: '' },
  ]);
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

  /** Máx. unidades según receta (combo o servicio con insumos). */
  const sellableUnitsFromRecipe = useCallback(
    (components: { productId: number; quantity: number }[] | null | undefined): number => {
      if (!components?.length) return 0;
      let min = Infinity;
      for (const comp of components) {
        const child = products.find((p) => p.id === comp.productId);
        if (!child) return 0;
        const per = Math.max(1, comp.quantity ?? 1);
        min = Math.min(min, Math.floor(child.stock / per));
      }
      return min === Infinity ? 0 : min;
    },
    [products],
  );

  /** Unidades que se pueden vender en POS (producto sueltos, combos, servicios). */
  const sellableUnits = useCallback(
    (product: Product): number => {
      if (product.isBundle) {
        if (!product.bundleComponents?.length) return product.stock;
        return sellableUnitsFromRecipe(product.bundleComponents);
      }
      if (product.isService) {
        if (product.bundleComponents?.length) return sellableUnitsFromRecipe(product.bundleComponents);
        return SERVICE_POS_MAX_QTY;
      }
      return product.stock;
    },
    [sellableUnitsFromRecipe],
  );

  // Agregar producto al carrito
  const addToCart = (product: Product) => {
    setCart((prevCart) => {
      const maxQ = sellableUnits(product);
      const existingItem = prevCart.find((item) => item.product.id === product.id);
      if (existingItem) {
        if (existingItem.quantity >= maxQ) return prevCart;
        return prevCart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      if (maxQ < 1) return prevCart;
      return [...prevCart, { product, quantity: 1 }];
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
            const maxQ = sellableUnits(item.product);
            if (newQuantity > maxQ) return item;
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

  /** Total en USD (solo cobro real, sin IVA/IGTF). */
  const { subtotal, total } = useMemo(() => {
    const subUsd = cart.reduce(
      (sum, item) => sum + Number(item.product.salePrice) * item.quantity,
      0
    );
    const subRounded = round2(subUsd);
    return { subtotal: subRounded, total: subRounded };
  }, [cart]);

  /** Suma de líneas de pago combinado en equivalente USD (validación vs total). */
  const splitEquivalentUsd = useMemo(() => {
    let usd = 0;
    let ves = 0;
    for (const line of splitLines) {
      const a = parseFloat(line.amount);
      if (!Number.isFinite(a) || a <= 0) continue;
      if (BS_PAYMENT_METHODS.includes(line.method)) ves += a;
      else usd += a;
    }
    return round2(usd + ves / tasaBcv);
  }, [splitLines, tasaBcv]);

  /** Precio unitario para mostrar (en moneda seleccionada: USD o Bs según tasa). */
  const getUnitPriceDisplay = (product: Product) => {
    const usd = Number(product.salePrice);
    return currencyMode === 'BS' ? round2(usd * tasaBcv) : usd;
  };

  // Procesar venta (online → API; offline → IndexedDB para sincronizar después)
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    if (splitPayment) {
      if (paymentMethod === 'CREDIT') {
        toast.error('El crédito no se divide con otros medios en el mismo cobro. Desactive "Pago combinado".');
        return;
      }
      let positiveLines = 0;
      for (const line of splitLines) {
        const a = parseFloat(line.amount);
        if (Number.isFinite(a) && a > 0) positiveLines += 1;
      }
      if (positiveLines < 2) {
        toast.error('En pago combinado indique al menos dos montos (o desactive la opción).');
        return;
      }
      if (Math.abs(splitEquivalentUsd - total) > 0.02) {
        toast.error(
          `El total cobrado (${splitEquivalentUsd.toFixed(2)} USD eq.) debe igualar la venta (${total.toFixed(2)} USD).`,
        );
        return;
      }
    } else if (paymentMethod === 'CREDIT') {
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

    const amountUsd = total;
    const amountBs = round2(total * tasaBcv);

    let payments: { method: PaymentMethod; amount: number; currency: 'USD' | 'VES' }[];
    let paymentDetail: string | undefined;

    if (splitPayment) {
      payments = [];
      for (const line of splitLines) {
        const a = parseFloat(line.amount);
        if (!Number.isFinite(a) || a <= 0) continue;
        const isBs = BS_PAYMENT_METHODS.includes(line.method);
        payments.push({
          method: line.method,
          amount: a,
          currency: isBs ? 'VES' : 'USD',
        });
      }
      paymentDetail = payments
        .map((p) => {
          const label = PAYMENT_LABELS[p.method];
          if (p.currency === 'VES') {
            return `${label}: ${new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES' }).format(p.amount)}`;
          }
          return `${label}: ${new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(p.amount)}`;
        })
        .join('\n');
    } else {
      payments =
        paymentMethod === 'CASH_BS' || paymentMethod === 'PAGO_MOVIL'
          ? [{ method: paymentMethod, amount: amountBs, currency: 'VES' as const }]
          : [{ method: paymentMethod, amount: amountUsd, currency: 'USD' as const }];
    }

    const invoiceData = {
      customerId: selectedCustomerId || undefined,
      paymentMethod: splitPayment ? 'MIXED' : paymentMethod === 'CREDIT' ? 'CREDIT' : paymentMethod,
      payments,
      items: cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
    };

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    try {
      const customer =
        selectedCustomerId != null
          ? customers.find((c) => c.id === selectedCustomerId) ?? null
          : null;

      const ticketBase: TicketSummary = {
        invoiceId: null,
        customerName: customer?.name ?? 'Cliente General',
        createdAt: new Date().toLocaleString('es-VE'),
        items: cart.map((item) => ({
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: Number(item.product.salePrice),
        })),
        totalUsd: amountUsd,
        totalBs: amountBs,
        currencyMode,
        paymentMethod: splitPayment ? 'MIXED' : paymentMethod,
        paymentDetail,
      };

      if (isOffline) {
        // Modo offline: guardar en IndexedDB (Dexie) para sincronizar al volver online
        await db.pendingInvoices.add({
          payload: invoiceData,
          createdAt: Date.now(),
          synced: false,
        });
        setLastTicket(ticketBase);
        setCart([]);
        setSelectedCustomerId(null);
        setSuccess(true);
        toast.info('Venta guardada localmente', {
          description: 'Se enviará al servidor cuando haya conexión.',
        });
        setTimeout(() => setSuccess(false), 8000);
      } else {
        const created = await invoiceService.create(invoiceData);
        setLastTicket({
          ...ticketBase,
          invoiceId: created.id,
          consecutiveNumber: (created as { consecutiveNumber?: number }).consecutiveNumber ?? null,
        });
        setCart([]);
        setSelectedCustomerId(null);
        setSuccess(true);
        setLastInvoiceId(created.id);
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

  const handlePrintTicket = () => {
    if (!lastTicket) return;

    const org = getCurrentOrganization();
    const headerName = org?.name ? `${org.name.toUpperCase()} - TICKET DE VENTA` : 'TICKET DE VENTA';
    const rif =
      org && 'taxId' in org && (org as any).taxId
        ? String((org as any).taxId)
        : undefined;

    const lines: string[] = [];
    lines.push(headerName);
    if (rif) {
      lines.push(`RIF: ${rif}`);
    }
    const facturaNum = lastTicket.consecutiveNumber ?? lastTicket.invoiceId;
    if (facturaNum != null) {
      lines.push(`Venta #${facturaNum}`);
    }
    lines.push(`Fecha: ${lastTicket.createdAt}`);
    lines.push(`Cliente: ${lastTicket.customerName}`);
    lines.push('--------------------------------');
    lastTicket.items.forEach((item) => {
      const lineTotal = round2(item.unitPrice * item.quantity);
      lines.push(
        `${item.quantity} x ${item.name}`.slice(0, 40),
      );
      lines.push(
        `   ${formatCurrency(item.unitPrice, 'USD').padEnd(12)}  ${formatCurrency(
          lineTotal,
          'USD',
        )}`,
      );
    });
    lines.push('--------------------------------');
    lines.push(`TOTAL USD: ${formatCurrency(lastTicket.totalUsd, 'USD')}`);
    lines.push(`TOTAL Bs:  ${formatCurrency(lastTicket.totalBs, 'BS')}`);
    lines.push('');
    if (lastTicket.paymentDetail) {
      lines.push('Pago:');
      lastTicket.paymentDetail.split('\n').forEach((ln) => lines.push(`  ${ln}`));
    } else {
      lines.push(`Pago: ${lastTicket.paymentMethod}`);
    }
    lines.push('');
    lines.push('Gracias por su compra');

    const ticketText = lines.join('\n');
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(
        `<pre style="font-family: monospace; white-space: pre-wrap; padding: 8px; font-size: 12px;">${ticketText}</pre>`,
      );
      w.document.close();
    }
  };

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
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-green-800 dark:text-green-200 font-medium">
                  ¡Venta procesada exitosamente!
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintTicket}
                  disabled={!lastTicket}
                  className="bg-white dark:bg-gray-800"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir Ticket
                </Button>
                {lastInvoiceId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        const response = await invoiceService.getPdf(lastInvoiceId);
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
                        link.download = `venta-${lastInvoiceId}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                      } catch (error: any) {
                        console.error('Error downloading PDF:', error);
                        alert(error.response?.data?.message ?? 'Error al descargar la factura');
                      }
                    }}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    PDF de la venta
                  </Button>
                )}
              </div>
            </div>
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
                        onClick={() => sellableUnits(product) > 0 && addToCart(product)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-center mb-2">
                            <Package className="h-12 w-12 text-muted-foreground" />
                          </div>
                          <h3 className="font-semibold text-sm mb-1 line-clamp-2">{product.name}</h3>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-lg font-bold text-primary">
                              {formatCurrency(getUnitPriceDisplay(product))}
                            </span>
                            <Badge
                              variant={sellableUnits(product) > 0 ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {product.isBundle
                                ? `Combo: ${sellableUnits(product)}`
                                : product.isService
                                  ? product.bundleComponents?.length
                                    ? `Servicio: ${sellableUnits(product)}`
                                    : 'Servicio'
                                  : `Stock: ${product.stock}`}
                            </Badge>
                          </div>
                          {sellableUnits(product) === 0 && (
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

              {/* Modalidades de pago (Bs / $ / crédito o combinado) */}
              <div className="mb-4 space-y-3">
                <Label className="block text-sm font-medium">Modalidades de pago</Label>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="split-pay" className="text-sm font-normal cursor-pointer leading-tight">
                    Pago combinado (varios medios en un solo cobro)
                  </Label>
                  <Switch
                    id="split-pay"
                    checked={splitPayment}
                    onCheckedChange={(v) => {
                      setSplitPayment(v);
                      if (v && paymentMethod === 'CREDIT') setPaymentMethod('CASH_USD');
                    }}
                  />
                </div>

                {splitPayment ? (
                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Indique cada monto en su moneda: USD para efectivo $, Zelle, tarjeta; Bs para efectivo Bs y
                      Pago Móvil. La suma debe cuadrar con el total en USD (tasa {tasaBcv.toFixed(2)}).
                    </p>
                    {splitLines.map((line, idx) => (
                      <div key={idx} className="flex flex-wrap gap-2 items-center">
                        <select
                          value={line.method}
                          onChange={(e) => {
                            const next = [...splitLines];
                            next[idx] = { ...next[idx], method: e.target.value as PaymentMethod };
                            setSplitLines(next);
                          }}
                          className="h-9 flex-1 min-w-[140px] rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {(Object.keys(PAYMENT_LABELS) as PaymentMethod[])
                            .filter((m) => m !== 'CREDIT')
                            .map((m) => (
                              <option key={m} value={m}>
                                {PAYMENT_LABELS[m]}
                              </option>
                            ))}
                        </select>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder={BS_PAYMENT_METHODS.includes(line.method) ? 'Monto Bs' : 'Monto USD'}
                          className="h-9 w-32"
                          value={line.amount}
                          onChange={(e) => {
                            const next = [...splitLines];
                            next[idx] = { ...next[idx], amount: e.target.value };
                            setSplitLines(next);
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0"
                          disabled={splitLines.length <= 2}
                          onClick={() => setSplitLines((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label="Quitar línea"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={splitLines.length >= 6}
                      onClick={() =>
                        setSplitLines((prev) => [...prev, { method: 'ZELLE', amount: '' }])
                      }
                    >
                      Añadir línea
                    </Button>
                    <p className="text-xs tabular-nums">
                      Cobrado (equiv.):{' '}
                      <span className="font-semibold">{splitEquivalentUsd.toFixed(2)} USD</span>
                      {' · '}
                      Venta: <span className="font-semibold">{total.toFixed(2)} USD</span>
                      {Math.abs(splitEquivalentUsd - total) > 0.02 && (
                        <span className="text-destructive ml-1">— debe coincidir</span>
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'CASH_USD', label: 'Efectivo $' },
                        { id: 'CASH_BS', label: 'Efectivo Bs' },
                        { id: 'PAGO_MOVIL', label: 'Pago Móvil Bs' },
                        { id: 'ZELLE', label: 'Zelle $' },
                        { id: 'CARD', label: 'Tarjeta' },
                        { id: 'CREDIT', label: 'Crédito' },
                      ] as const
                    ).map(({ id, label }) => (
                      <Button
                        key={id}
                        type="button"
                        variant={paymentMethod === id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPaymentMethod(id)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                )}
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
                              {formatCurrency(getUnitPriceDisplay(item.product))} c/u
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
                              disabled={item.quantity >= sellableUnits(item.product)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="font-bold">
                            {formatCurrency(round2(getUnitPriceDisplay(item.product) * item.quantity))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resumen: solo cobro real (sin IVA/IGTF) */}
              <div className="space-y-2 pt-4 border-t border-border">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                {(paymentMethod === 'CASH_BS' || paymentMethod === 'PAGO_MOVIL') && (
                  <p className="text-xs text-muted-foreground">
                    Equiv. Bs: {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(round2(total * tasaBcv))}
                  </p>
                )}
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
