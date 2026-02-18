'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Trash2, Users, AlertTriangle, Package } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

export default function SettingsPage() {
  const router = useRouter();
  const { user, getOrganizations } = useAuthStore();
  const [clearing, setClearing] = useState(false);
  const [clearingInventory, setClearingInventory] = useState(false);
  const [inventoryTenantId, setInventoryTenantId] = useState<string>('');
  const isSuperAdmin = !!user?.isSuperAdmin;
  const organizations = getOrganizations();

  const handleClearTestData = async () => {
    if (
      !confirm(
        '¿Borrar todo el historial de ventas y facturación de esta organización? Esta acción no se puede deshacer y es solo para entornos de desarrollo.'
      )
    ) {
      return;
    }
    setClearing(true);
    try {
      const res = await apiClient.post<{ message: string; deleted?: number }>('/invoices/clear-test-data');
      alert(res.data.deleted != null ? `${res.data.message} (${res.data.deleted} facturas)` : res.data.message);
    } catch (error: any) {
      alert(error.response?.data?.message ?? 'Error al borrar el historial');
    } finally {
      setClearing(false);
    }
  };

  const handleClearInventory = async () => {
    const tenantId = inventoryTenantId ? parseInt(inventoryTenantId, 10) : 0;
    if (!tenantId) {
      alert('Selecciona una organización.');
      return;
    }
    const org = organizations.find((o) => o.id === tenantId);
    if (
      !confirm(
        `¿Eliminar TODOS los productos y movimientos de inventario de "${org?.name ?? tenantId}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setClearingInventory(true);
    try {
      const res = await apiClient.delete<{ deletedMovements: number; deletedProducts: number }>('/inventory/clear', {
        data: { tenantId },
      });
      alert(
        `Inventario limpiado: ${res.data.deletedProducts} productos y ${res.data.deletedMovements} movimientos eliminados.`
      );
      setInventoryTenantId('');
    } catch (error: any) {
      alert(error.response?.data?.message ?? 'Error al limpiar el inventario.');
    } finally {
      setClearingInventory(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Configuración</h1>
        <p className="text-muted-foreground">Ajustes de la organización y herramientas de administración</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Equipo
            </CardTitle>
            <CardDescription>Gestiona miembros, roles e invitaciones de tu organización</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push('/settings/team')}>
              Ir a Equipo
            </Button>
          </CardContent>
        </Card>

        {isSuperAdmin && (
          <>
            <Card className="border-red-500/40 dark:border-red-600/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <Package className="h-5 w-5" />
                  Limpiar inventario (Super Admin)
                </CardTitle>
                <CardDescription className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                  Elimina todos los productos y movimientos de inventario de la organización elegida. Solo Super Admin.
                  Si hay productos en facturas, la operación fallará hasta que se corrijan.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={inventoryTenantId} onValueChange={setInventoryTenantId}>
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="Seleccionar organización" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={String(org.id)}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="destructive"
                  onClick={handleClearInventory}
                  disabled={clearingInventory || !inventoryTenantId}
                >
                  {clearingInventory ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Limpiando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Limpiar inventario de esta organización
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-amber-500/50 dark:border-amber-600/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Trash2 className="h-5 w-5" />
                  Limpieza de desarrollo
                </CardTitle>
                <CardDescription className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  Solo Super Admin. Borra todo el historial de ventas y facturación de la organización actual para dejar el
                  sistema en cero durante el desarrollo. No restaura stock de productos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  onClick={handleClearTestData}
                  disabled={clearing}
                >
                  {clearing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Borrando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Borrar historial de ventas/facturación
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
