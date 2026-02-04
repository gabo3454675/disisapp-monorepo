'use client';

import { useState, useEffect } from 'react';
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
import { FileText, CheckCircle, Loader2, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';

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
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>(task?.status ?? 'PENDING');

  useEffect(() => {
    if (task) setCurrentStatus(task.status);
  }, [task?.id, task?.status]);

  // Marcar como leída al abrir el modal
  useEffect(() => {
    if (!open || !task?.id || task.read) return;
    apiClient.patch(`/tasks/${task.id}/read`).catch(() => {}).finally(() => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tasks-updated'));
      }
    });
  }, [open, task?.id, task?.read]);

  const handleStatusChange = async (newStatus: 'PENDING' | 'IN_PROGRESS' | 'DONE') => {
    if (!task) return;
    setUpdatingStatus(true);
    try {
      await apiClient.patch(`/tasks/${task.id}/status`, { status: newStatus });
      setCurrentStatus(newStatus);
      onDone?.();
      toast.success('Estado actualizado', {
        description: newStatus === 'DONE' ? 'Tarea completada.' : 'Estado de la tarea actualizado.',
      });
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tasks-updated'));
      if (newStatus === 'DONE') onOpenChange(false);
    } catch {
      toast.error('Error', { description: 'No se pudo actualizar el estado.' });
    } finally {
      setUpdatingStatus(false);
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
          {/* Selector de estado: En progreso / Completada (visible para todas las tareas) */}
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium text-muted-foreground">Cambiar estado</p>
            <div className="flex flex-wrap gap-2">
              {currentStatus !== 'IN_PROGRESS' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('IN_PROGRESS')}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-1" />}
                  En progreso
                </Button>
              )}
              {currentStatus !== 'DONE' && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleStatusChange('DONE')}
                  disabled={updatingStatus}
                >
                  {updatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  Completada
                </Button>
              )}
              {currentStatus === 'DONE' && (
                <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Completada</span>
              )}
            </div>
          </div>

          {!hasInvoice && (
            <p className="text-sm text-muted-foreground">
              Esta tarea no está vinculada a una factura.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
