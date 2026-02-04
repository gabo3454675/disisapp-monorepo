'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TaskResolutionBar } from '@/components/task-resolution-bar';
import apiClient from '@/lib/api';
import { FileText, CheckCircle, Loader2 } from 'lucide-react';

export interface TaskForResolution {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  read: boolean;
  invoiceId: number | null;
  invoice?: {
    id: number;
    totalAmount: unknown;
    status: string;
  } | null;
  createdBy?: { fullName: string | null; email: string } | null;
  organization?: { nombre: string } | null;
}

interface TaskResolutionModalProps {
  task: TaskForResolution | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
  onVerFactura?: (invoiceId: number, taskId: number) => void;
}

export function TaskResolutionModal({
  task,
  open,
  onOpenChange,
  onDone,
  onVerFactura,
}: TaskResolutionModalProps) {
  const [markingDone, setMarkingDone] = useState(false);

  const handleMarkDone = async () => {
    if (!task) return;
    setMarkingDone(true);
    try {
      await apiClient.patch(`/tasks/${task.id}/status`, { status: 'DONE' });
      onDone?.();
      onOpenChange(false);
    } catch {
      alert('Error al marcar la tarea como lista');
    } finally {
      setMarkingDone(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!task?.invoiceId) return;
    try {
      const response = await apiClient.get(`/invoices/${task.invoiceId}/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = `factura-${task.invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Error al descargar la factura');
    }
  };

  if (!task) return null;

  const hasInvoice = !!task.invoiceId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
          <DialogDescription>
            {task.organization?.nombre && (
              <span className="block text-muted-foreground">{task.organization.nombre}</span>
            )}
            {task.createdBy?.fullName && (
              <span className="block text-muted-foreground">
                Asignada por: {task.createdBy.fullName}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {task.description && (
            <p className="text-sm text-foreground whitespace-pre-wrap">{task.description}</p>
          )}
          {hasInvoice && (
            <>
              <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  Factura #{task.invoiceId} asociada
                </span>
                {onVerFactura && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onVerFactura(task.invoiceId!, task.id);
                      onOpenChange(false);
                    }}
                  >
                    Ver factura
                  </Button>
                )}
              </div>
              <TaskResolutionBar
                taskId={task.id}
                invoiceId={task.invoiceId}
                onDownloadPDF={handleDownloadPDF}
                onDone={() => {
                  onDone?.();
                  onOpenChange(false);
                }}
              />
            </>
          )}
          {!hasInvoice && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Esta tarea no está vinculada a una factura.
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={handleMarkDone}
                disabled={markingDone}
              >
                {markingDone ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Marcar listo
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
