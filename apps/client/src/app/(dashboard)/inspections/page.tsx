'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VehicleDiagramView } from '@/components/inspection/VehicleDiagramView';
import { exportInspectionPdf } from '@/lib/exportInspectionPdf';
import apiClient from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { useAuthStore } from '@/store/useAuthStore';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileDown,
  Save,
  Plus,
  Trash2,
} from 'lucide-react';
import type { DiagramPin, DiagramView, PinStatus, UsedPart } from '@/types/inspection';

const DAVEAN_NAME = 'Davean';

interface Product {
  id: number;
  name: string;
  sku?: string | null;
  stock: number;
}

export default function InspectionsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const getCurrentOrganization = useAuthStore((s) => s.getCurrentOrganization);
  const { canManageInventory } = usePermission();
  const [pins, setPins] = useState<DiagramPin[]>([]);
  const [pinMode, setPinMode] = useState<PinStatus>('damaged');
  const [activeView, setActiveView] = useState<DiagramView>('frontal');
  const [usedParts, setUsedParts] = useState<UsedPart[]>([]);
  const [vehicleInfo, setVehicleInfo] = useState('');
  const [notes, setNotes] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [inspectionsList, setInspectionsList] = useState<Array<{ id: number; vehicleInfo: string | null; createdAt: string; usedParts?: unknown }>>([]);
  const [loadingInspections, setLoadingInspections] = useState(true);
  const [accessChecked, setAccessChecked] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const diagramRef = useRef<HTMLDivElement | null>(null);

  // Logo Davean para PDF (opcional: si existe /logo-davean.png se usa en el reporte)
  useEffect(() => {
    if (!accessChecked) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          setLogoDataUrl(canvas.toDataURL('image/png'));
        }
      } catch {
        setLogoDataUrl(null);
      }
    };
    img.onerror = () => setLogoDataUrl(null);
    img.src = '/logo-davean.png';
  }, [accessChecked]);

  // Redirigir si no es organización Davean ni SUPER_ADMIN (módulo exclusivo)
  useEffect(() => {
    if (user?.isSuperAdmin) {
      setAccessChecked(true);
      return;
    }
    const currentOrg = getCurrentOrganization() as { name?: string } | null;
    const orgName = currentOrg?.name ?? '';
    const allowed = orgName === DAVEAN_NAME;
    if (!allowed) {
      router.replace('/?error=inspeccion_restringida');
      return;
    }
    setAccessChecked(true);
  }, [user?.isSuperAdmin, getCurrentOrganization, router]);

  useEffect(() => {
    if (!accessChecked) return;
    apiClient
      .get<Product[]>('/products')
      .then((res) => setProducts(res.data ?? []))
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));
  }, [accessChecked]);

  const loadInspections = useCallback(() => {
    setLoadingInspections(true);
    apiClient
      .get<Array<{ id: number; vehicleInfo: string | null; createdAt: string; usedParts?: unknown }>>('/vehicle-inspections')
      .then((res) => setInspectionsList(res.data ?? []))
      .catch(() => setInspectionsList([]))
      .finally(() => setLoadingInspections(false));
  }, []);

  useEffect(() => {
    if (accessChecked && canManageInventory) loadInspections();
  }, [accessChecked, canManageInventory, loadInspections]);

  const handleAddPin = (view: DiagramView, x: number, y: number, status: PinStatus) => {
    setPins((prev) => [...prev, { view, x, y, status }]);
  };

  const handleAddUsedPart = () => {
    const first = products[0];
    if (!first) return;
    setUsedParts((prev) => {
      const exists = prev.find((p) => p.productId === first.id);
      if (exists) return prev;
      return [...prev, { productId: first.id, quantity: 1, productName: first.name }];
    });
  };

  const updateUsedPart = (index: number, quantity: number) => {
    if (quantity < 1) return;
    setUsedParts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, quantity } : p))
    );
  };

  const updateUsedPartProduct = (index: number, productId: number) => {
    const product = products.find((p) => p.id === productId);
    setUsedParts((prev) =>
      prev.map((p, i) =>
        i === index ? { ...p, productId, productName: product?.name } : p
      )
    );
  };

  const removeUsedPart = (index: number) => {
    setUsedParts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setMessage(null);
    setSaving(true);
    try {
      // POST usa el tenant activo (x-tenant-id). CompanyAccessGuard en backend garantiza que sea Davean.
      await apiClient.post('/vehicle-inspections', {
        diagramPins: pins.length ? pins : undefined,
        usedParts: usedParts.length ? usedParts.map((p) => ({ productId: p.productId, quantity: p.quantity })) : undefined,
        vehicleInfo: vehicleInfo.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setMessage({ type: 'success', text: 'Inspección guardada. Se descontó el inventario (Uso taller).' });
      setPins([]);
      setUsedParts([]);
      setVehicleInfo('');
      setNotes('');
      loadInspections();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMessage({ type: 'error', text: msg ?? 'Error al guardar la inspección.' });
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    setMessage(null);
    try {
      const currentOrg = getCurrentOrganization() as { name?: string } | null;
      const companyName = currentOrg?.name?.trim() || DAVEAN_NAME;
      await exportInspectionPdf({
        diagramElement: diagramRef.current,
        pins,
        usedParts,
        vehicleInfo: vehicleInfo.trim() || undefined,
        notes: notes.trim() || undefined,
        title: `Inspección vehículo${vehicleInfo.trim() ? ` - ${vehicleInfo.trim()}` : ''} - ${new Date().toLocaleDateString()}`,
        companyName,
        logoDataUrl: logoDataUrl ?? undefined,
      });
      setMessage({ type: 'success', text: 'PDF descargado.' });
    } catch {
      setMessage({ type: 'error', text: 'Error al generar el PDF.' });
    } finally {
      setExportingPdf(false);
    }
  };

  if (!accessChecked) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto flex items-center justify-center min-h-[40vh]">
        <div className="text-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Comprobando acceso...</p>
        </div>
      </div>
    );
  }

  if (!canManageInventory) {
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No tienes permisos para acceder a Inspección vehículo.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inspección visual (Davean)</h1>
        <p className="text-muted-foreground">
          Marca daños y reparaciones en el diagrama y registra repuestos usados. Al guardar se descuenta del inventario.
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
          {message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Diagrama del vehículo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Elige el tipo de pin y haz clic en la vista para marcar. Rojo: Dañado, Verde: Reparado.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              variant={pinMode === 'damaged' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPinMode('damaged')}
            >
              <span className="w-3 h-3 rounded-full bg-red-500 mr-1.5 inline-block" />
              Dañado
            </Button>
            <Button
              type="button"
              variant={pinMode === 'repaired' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPinMode('repaired')}
            >
              <span className="w-3 h-3 rounded-full bg-green-500 mr-1.5 inline-block" />
              Reparado
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <VehicleDiagramView
            pins={pins}
            onAddPin={handleAddPin}
            pinMode={pinMode}
            activeView={activeView}
            onViewChange={setActiveView}
            diagramRef={diagramRef}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos del vehículo y repuestos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Al guardar, los repuestos listados se descontarán del inventario (Uso taller).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="vehicleInfo">Placa / modelo (opcional)</Label>
              <Input
                id="vehicleInfo"
                placeholder="Ej: ABC-123 o Toyota Corolla"
                value={vehicleInfo}
                onChange={(e) => setVehicleInfo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Repuestos utilizados</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddUsedPart}
                  disabled={productsLoading || products.length === 0}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Añadir
                </Button>
              </div>
              {productsLoading && (
                <p className="text-sm text-muted-foreground">Cargando productos…</p>
              )}
              {!productsLoading && products.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay productos en el inventario.</p>
              )}
              <ul className="space-y-2">
                {usedParts.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 rounded border p-2">
                    <select
                      className="flex-1 min-w-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={p.productId}
                      onChange={(e) => updateUsedPartProduct(i, Number(e.target.value))}
                    >
                      {products.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.name} (stock: {prod.stock})
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min={1}
                      className="w-20"
                      value={p.quantity}
                      onChange={(e) => updateUsedPart(i, Number(e.target.value) || 1)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeUsedPart(i)}
                      aria-label="Quitar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notas (opcional)</Label>
              <textarea
                id="notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Observaciones de la inspección"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar inspección (descuenta inventario)
        </Button>
        <Button variant="outline" onClick={handleExportPdf} disabled={exportingPdf}>
          {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
          Exportar reporte PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inspecciones recientes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Historial de inspecciones guardadas (repuestos descontados como Uso taller).
          </p>
        </CardHeader>
        <CardContent>
          {loadingInspections ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : inspectionsList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay inspecciones.</p>
          ) : (
            <ul className="space-y-2">
              {inspectionsList.slice(0, 15).map((ins) => (
                <li
                  key={ins.id}
                  className="flex flex-wrap items-center gap-2 text-sm border-b border-border pb-2 last:border-0"
                >
                  <span className="font-medium">#{ins.id}</span>
                  {ins.vehicleInfo && <span className="text-muted-foreground">{ins.vehicleInfo}</span>}
                  <span className="text-muted-foreground text-xs">
                    {new Date(ins.createdAt).toLocaleString()}
                  </span>
                  {Array.isArray(ins.usedParts) && ins.usedParts.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {ins.usedParts.length} repuesto(s)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
