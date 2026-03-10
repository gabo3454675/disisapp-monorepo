'use client';

import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { db, type PendingInvoiceRecord } from '@/lib/db';
import { invoiceService } from '@/lib/api';

/**
 * Hook que escucha el evento 'online', envía las facturas pendientes
 * (guardadas en IndexedDB cuando estaba offline) al servidor en segundo plano
 * y muestra un toast de éxito al terminar.
 */
export function useSync() {
  const syncingRef = useRef(false);

  const syncPendingInvoices = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    if (syncingRef.current) return;

    syncingRef.current = true;
    const toSync = await db.pendingInvoices.filter((r) => !r.synced).toArray();

    if (toSync.length === 0) {
      syncingRef.current = false;
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const record of toSync) {
      try {
        await invoiceService.create(record.payload);
        await db.pendingInvoices.delete(record.id!);
        successCount++;
      } catch {
        failCount++;
      }
    }

    syncingRef.current = false;

    if (successCount > 0) {
      toast.success('Datos sincronizados exitosamente', {
        description:
          failCount > 0
            ? `${successCount} factura(s) subidas. ${failCount} no se pudieron enviar.`
            : `${successCount} factura(s) sincronizada(s).`,
      });
    }
    if (failCount > 0 && successCount === 0) {
      toast.error('Error al sincronizar', {
        description: 'No se pudo subir las facturas pendientes. Revisa tu conexión.',
      });
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      syncPendingInvoices();
    };

    window.addEventListener('online', handleOnline);

    // Sincronizar al montar si ya hay conexión (p.ej. usuario volvió a la pestaña)
    if (navigator.onLine) {
      syncPendingInvoices();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncPendingInvoices]);
}
