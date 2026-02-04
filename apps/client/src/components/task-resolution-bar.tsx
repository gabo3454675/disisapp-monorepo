'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api';
import { Download, MessageCircle, CheckCircle, Loader2, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';

const WHATSAPP_MSG = 'Hola, adjunto detalle de su factura. Cualquier duda estamos a la orden.';

interface TaskResolutionBarProps {
  taskId: number;
  invoiceId: number;
  customerPhone?: string;
  onDownloadPDF: () => void;
  onDone?: () => void;
}

export function TaskResolutionBar({
  taskId,
  invoiceId,
  customerPhone,
  onDownloadPDF,
  onDone,
}: TaskResolutionBarProps) {
  const [updating, setUpdating] = useState(false);

  const openWhatsApp = () => {
    const text = encodeURIComponent(WHATSAPP_MSG);
    if (customerPhone) {
      const phone = customerPhone.replace(/\D/g, '');
      const url = `https://wa.me/${phone}?text=${text}`;
      window.open(url, '_blank');
    } else {
      window.open(`https://wa.me/?text=${text}`, '_blank');
    }
  };

  const handleStatus = async (status: 'IN_PROGRESS' | 'DONE') => {
    setUpdating(true);
    try {
      await apiClient.patch(`/tasks/${taskId}/status`, { status });
      onDone?.();
      toast.success(status === 'DONE' ? 'Tarea completada' : 'Estado actualizado');
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tasks-updated'));
    } catch {
      toast.error('Error al actualizar el estado');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="pt-4 border-t space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Acciones de resolución</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onDownloadPDF}>
          <Download className="mr-2 h-4 w-4" />
          Descargar PDF
        </Button>
        <Button variant="outline" size="sm" onClick={openWhatsApp}>
          <MessageCircle className="mr-2 h-4 w-4" />
          Enviar WhatsApp
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleStatus('IN_PROGRESS')} disabled={updating}>
          {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-1" />}
          En progreso
        </Button>
        <Button variant="default" size="sm" onClick={() => handleStatus('DONE')} disabled={updating}>
          {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
          Completada
        </Button>
      </div>
    </div>
  );
}
