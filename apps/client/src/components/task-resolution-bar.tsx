'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api';
import { Download, MessageCircle, CheckCircle, Loader2 } from 'lucide-react';

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
  const [markingDone, setMarkingDone] = useState(false);

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

  const handleMarkDone = async () => {
    setMarkingDone(true);
    try {
      await apiClient.patch(`/tasks/${taskId}/status`, { status: 'DONE' });
      onDone?.();
    } catch {
      alert('Error al marcar la tarea como lista');
    } finally {
      setMarkingDone(false);
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
        <Button variant="default" size="sm" onClick={handleMarkDone} disabled={markingDone}>
          {markingDone ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Marcar listo
        </Button>
      </div>
    </div>
  );
}
