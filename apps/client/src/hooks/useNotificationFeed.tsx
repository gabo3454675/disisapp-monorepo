'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import type { TaskForResolution } from '@/components/task-resolution-modal';

type Invoice = {
  id: number;
  status: string;
  createdAt?: string;
  customerName?: string;
  totalAmount?: number;
};

type LowStockProduct = {
  id: number;
  sku?: string | null;
  name: string;
  stock: number;
  minStock?: number | null;
  updatedAt?: string;
};

const timeAgo = (dateString?: string) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
};

function isRateStaleForToday(rateUpdatedAt: string | null | undefined): boolean {
  if (rateUpdatedAt == null || rateUpdatedAt === '') return true;
  const d = new Date(rateUpdatedAt);
  if (Number.isNaN(d.getTime())) return true;
  const today = new Date();
  return (
    d.getFullYear() !== today.getFullYear() ||
    d.getMonth() !== today.getMonth() ||
    d.getDate() !== today.getDate()
  );
}

export type FeedItemKind = 'task' | 'invoice' | 'stock' | 'rate' | 'empty';

export interface NotificationFeedItem {
  id: string;
  kind: FeedItemKind;
  title: string;
  description: string;
  timeLabel: string;
  status: 'pending' | 'urgent' | 'completed';
  icon: 'clock' | 'alert' | 'check' | 'task';
  task?: TaskForResolution;
  invoiceId?: number;
  productId?: number;
  href?: string;
  openRateModal?: boolean;
}

function buildFeedItems(
  myTasks: TaskForResolution[],
  pendingInvoices: Invoice[],
  lowStockProducts: LowStockProduct[],
  showRateReminder: boolean,
): NotificationFeedItem[] {
  const items: NotificationFeedItem[] = [];

  for (const task of myTasks) {
    items.push({
      id: `task-${task.id}`,
      kind: 'task',
      title: task.title,
      description: task.description || (task.invoiceId ? `Factura #${task.invoiceId}` : 'Tarea asignada'),
      status: task.priority === 'HIGH' ? 'urgent' : 'pending',
      timeLabel: '—',
      icon: 'task',
      task,
    });
  }

  const sortedPending = [...pendingInvoices].sort((a, b) => {
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return db - da;
  });
  for (const inv of sortedPending.slice(0, 5)) {
    const customerName = inv.customerName || 'Cliente';
    items.push({
      id: `inv-${inv.id}`,
      kind: 'invoice',
      title: 'Factura pendiente de cobro',
      description: `#${inv.id} · ${customerName}`,
      status: 'pending',
      timeLabel: timeAgo(inv.createdAt),
      icon: 'clock',
      invoiceId: inv.id,
      href: `/invoices?detalle=${inv.id}`,
    });
  }

  for (const p of lowStockProducts.slice(0, 5)) {
    const skuLabel = p.sku ? `SKU ${p.sku}` : `ID ${p.id}`;
    items.push({
      id: `stock-${p.id}`,
      kind: 'stock',
      title: 'Stock bajo',
      description: `${p.name} · ${skuLabel} (stock ${p.stock})`,
      status: 'urgent',
      timeLabel: 'Revisar inventario',
      icon: 'alert',
      productId: p.id,
      href: '/alertas-stock',
    });
  }

  if (showRateReminder) {
    items.push({
      id: 'rate-daily',
      kind: 'rate',
      title: 'Actualizar tasa del día',
      description: 'Confirma o registra la tasa BCV para cobrar bien en bolívares.',
      status: 'pending',
      timeLabel: 'Hoy',
      icon: 'clock',
      openRateModal: true,
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'empty',
      kind: 'empty',
      title: 'Todo al día',
      description: 'No hay alertas ni recordatorios pendientes.',
      status: 'completed',
      timeLabel: '—',
      icon: 'check',
    });
  }

  return items;
}

type NotificationFeedContextValue = {
  feedItems: NotificationFeedItem[];
  badgeCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const NotificationFeedContext = createContext<NotificationFeedContextValue | null>(null);

export function NotificationFeedProvider({ children }: { children: ReactNode }) {
  const selectedOrganizationId = useAuthStore((s) => s.selectedOrganizationId);
  const selectedCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const user = useAuthStore((s) => s.user);
  const superAdminOrganizations = useAuthStore((s) => s.superAdminOrganizations);

  const selectedId = selectedOrganizationId ?? selectedCompanyId;

  const rateUpdatedAt = useMemo(() => {
    if (!selectedId) return null as string | null | undefined;
    if (user?.isSuperAdmin && superAdminOrganizations.length > 0) {
      const o = superAdminOrganizations.find((x) => x.id === selectedId);
      return o && 'rateUpdatedAt' in o ? (o as { rateUpdatedAt?: string | null }).rateUpdatedAt : null;
    }
    const fromUser =
      user?.organizations?.find((o) => o.id === selectedId) ||
      user?.companies?.find((c) => c.id === selectedId);
    if (fromUser && 'rateUpdatedAt' in fromUser) {
      return (fromUser as { rateUpdatedAt?: string | null }).rateUpdatedAt;
    }
    return null;
  }, [selectedId, user, superAdminOrganizations]);

  const showRateReminder = isRateStaleForToday(rateUpdatedAt);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myTasks, setMyTasks] = useState<TaskForResolution[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [tasksRes, invoicesRes, productsRes] = await Promise.all([
        apiClient.get<TaskForResolution[]>('/tasks/my-pending'),
        apiClient.get<Invoice[]>('/dashboard/pending-invoices'),
        apiClient.get<LowStockProduct[]>('/dashboard/low-stock'),
      ]);
      setMyTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      setPendingInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
      setLowStockProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err?.response?.data?.message || err?.message || 'Error al cargar alertas');
      setMyTasks([]);
      setPendingInvoices([]);
      setLowStockProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const onTasksUpdated = () => loadData();
    window.addEventListener('tasks-updated', onTasksUpdated);
    return () => window.removeEventListener('tasks-updated', onTasksUpdated);
  }, [loadData]);

  /** Al actualizar la tasa en modal, el store se actualiza: refrescar feed para quitar recordatorio. */
  useEffect(() => {
    const onRateUpdated = () => loadData();
    window.addEventListener('organization-rate-updated', onRateUpdated);
    return () => window.removeEventListener('organization-rate-updated', onRateUpdated);
  }, [loadData]);

  const feedItems = useMemo(
    () => buildFeedItems(myTasks, pendingInvoices, lowStockProducts, showRateReminder),
    [myTasks, pendingInvoices, lowStockProducts, showRateReminder],
  );

  const badgeCount = useMemo(
    () => feedItems.filter((i) => i.kind !== 'empty').length,
    [feedItems],
  );

  const value = useMemo(
    () => ({ feedItems, badgeCount, loading, error, refetch: loadData }),
    [feedItems, badgeCount, loading, error, loadData],
  );

  return (
    <NotificationFeedContext.Provider value={value}>{children}</NotificationFeedContext.Provider>
  );
}

export function useNotificationFeed(): NotificationFeedContextValue {
  const ctx = useContext(NotificationFeedContext);
  if (!ctx) {
    throw new Error('useNotificationFeed debe usarse dentro de NotificationFeedProvider');
  }
  return ctx;
}
