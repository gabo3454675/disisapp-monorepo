'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import apiClient from '@/lib/api';
import { Loader2 } from 'lucide-react';

type OrgMember = {
  id: number;
  userId: number;
  email: string;
  fullName: string | null;
  role: string;
};

interface AssignTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: number;
  onSuccess?: () => void;
}

export function AssignTaskModal({
  open,
  onOpenChange,
  invoiceId,
  onSuccess,
}: AssignTaskModalProps) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [note, setNote] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelectedUserId('');
    setNote('');
    async function load() {
      setLoadingMembers(true);
      try {
        const res = await apiClient.get<OrgMember[]>('/tenants/users');
        setMembers(Array.isArray(res.data) ? res.data : []);
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || 'Error al cargar usuarios');
        setMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    }
    load();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Selecciona un usuario');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post('/tasks', {
        title: `Revisión factura #${invoiceId}`,
        description: note || undefined,
        assignedToId: Number(selectedUserId),
        invoiceId,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Error al asignar la tarea');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar revisión</DialogTitle>
          <DialogDescription>
            Asigna la revisión de la factura #{invoiceId} a un miembro del equipo. Opcionalmente escribe una nota (ej: &quot;Falta el número de teléfono&quot;).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user">Usuario</Label>
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
              disabled={loadingMembers}
            >
              <SelectTrigger id="user">
                <SelectValue placeholder={loadingMembers ? 'Cargando...' : 'Selecciona un usuario'} />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={String(m.userId)}>
                    {m.fullName || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Nota (opcional)</Label>
            <textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: Falta el número de teléfono del cliente"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !selectedUserId}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
