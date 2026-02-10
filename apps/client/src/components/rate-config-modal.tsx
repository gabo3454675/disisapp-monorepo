'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, TrendingUp } from 'lucide-react';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';

interface RateConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RateConfigModal({ open, onOpenChange }: RateConfigModalProps) {
  const getCurrentOrganization = useAuthStore((s) => s.getCurrentOrganization);
  const setOrganizationConfig = useAuthStore((s) => s.setOrganizationConfig);
  const organizationId = useAuthStore((s) => s.selectedOrganizationId ?? s.selectedCompanyId);
  const currentOrg = getCurrentOrganization();
  const orgWithRate = currentOrg && 'exchangeRate' in currentOrg ? currentOrg : null;

  const [exchangeRate, setExchangeRate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && orgWithRate?.exchangeRate != null) {
      setExchangeRate(String(orgWithRate.exchangeRate));
    }
  }, [open, orgWithRate?.exchangeRate]);

  const handleSave = async () => {
    if (!organizationId) return;
    const num = parseFloat(exchangeRate.replace(',', '.'));
    if (Number.isNaN(num) || num <= 0) {
      toast.error('Tasa inválida', { description: 'Ingresa una tasa válida mayor a 0.' });
      return;
    }
    setSaving(true);
    try {
      const { data } = await apiClient.patch<{ exchangeRate: number; rateUpdatedAt?: string | null; currencyCode?: string; currencySymbol?: string }>(
        '/tenants/organization',
        { exchangeRate: num }
      );
      setOrganizationConfig(organizationId, {
        exchangeRate: data.exchangeRate,
        rateUpdatedAt: data.rateUpdatedAt ?? undefined,
        currencyCode: data.currencyCode,
        currencySymbol: data.currencySymbol,
      });
      setExchangeRate(String(data.exchangeRate));
      toast.success('Tasa actualizada', {
        description: 'Tasa actualizada para toda la organización.',
      });
      onOpenChange(false);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Error al guardar la tasa';
      toast.error('Error al guardar la tasa', { description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Configuración de Tasa
          </DialogTitle>
          <DialogDescription>
            Tasa de cambio (BCV/Paralelo) para conversiones. Actualízala cuando el valor del día cambie.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="modal-exchangeRate">Tasa actual</Label>
            <Input
              id="modal-exchangeRate"
              type="text"
              inputMode="decimal"
              placeholder="36.50"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Guardando...
              </>
            ) : (
              'Guardar tasa'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
