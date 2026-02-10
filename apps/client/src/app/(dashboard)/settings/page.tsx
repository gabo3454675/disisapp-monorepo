'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Users, AlertTriangle } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [clearing, setClearing] = useState(false);
  const isSuperAdmin = !!user?.isSuperAdmin;

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
        )}
      </div>
    </div>
  );
}
