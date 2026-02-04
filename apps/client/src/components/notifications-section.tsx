'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCircle2, AlertCircle, Clock, Loader2, ListTodo } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TaskResolutionModal, type TaskForResolution } from '@/components/task-resolution-modal';
import { InvoiceDetailSheet } from '@/components/invoice-detail-sheet';
import apiClient from '@/lib/api';

interface Notification {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'urgent' | 'completed';
  time: string;
  icon: 'clock' | 'alert' | 'check';
  type: 'task' | 'invoice' | 'stock';
  task?: TaskForResolution;
}

type Invoice = {
  id: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | string;
  createdAt?: string;
  customerName?: string;
  totalAmount?: number;
};

type Product = {
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

const getStatusStyles = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'urgent':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'completed':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    default:
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  }
};

const getIcon = (iconType: string) => {
  switch (iconType) {
    case 'alert':
      return <AlertCircle className="h-5 w-5 text-red-400" />;
    case 'check':
      return <CheckCircle2 className="h-5 w-5 text-green-400" />;
    case 'task':
      return <ListTodo className="h-5 w-5 text-blue-400" />;
    case 'clock':
    default:
      return <Clock className="h-5 w-5 text-yellow-400" />;
  }
};

export default function NotificationsSection() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myTasks, setMyTasks] = useState<TaskForResolution[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [resolutionTask, setResolutionTask] = useState<TaskForResolution | null>(null);
  const [resolutionModalOpen, setResolutionModalOpen] = useState(false);
  const [detailInvoiceId, setDetailInvoiceId] = useState<number | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [tasksRes, invoicesRes, productsRes] = await Promise.all([
        apiClient.get<TaskForResolution[]>('/tasks/my-pending'),
        apiClient.get<Invoice[]>('/dashboard/pending-invoices'),
        apiClient.get<Product[]>('/dashboard/low-stock'),
      ]);
      setMyTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      setPendingInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
      setLowStockProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Error al cargar alertas');
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

  const handleVerFactura = useCallback((invoiceId: number, taskId: number) => {
    setDetailInvoiceId(invoiceId);
    setDetailTaskId(taskId);
    setDetailSheetOpen(true);
  }, []);

  const notificationsData: Notification[] = useMemo(() => {
    const items: Notification[] = [];

    for (const task of myTasks) {
      items.push({
        id: Number(`0${task.id}`),
        title: task.title,
        description: task.description || (task.invoiceId ? `Factura #${task.invoiceId}` : 'Sin factura'),
        status: task.priority === 'HIGH' ? 'urgent' : 'pending',
        time: '—',
        icon: 'task',
        type: 'task',
        task,
      });
    }

    const sortedPending = [...pendingInvoices].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
    for (const inv of sortedPending.slice(0, 3)) {
      const customerName = inv.customerName || 'Cliente';
      items.push({
        id: Number(`1${inv.id}`),
        title: `Factura #${inv.id} Pendiente`,
        description: `Esperando pago de ${customerName}`,
        status: 'pending',
        time: timeAgo(inv.createdAt),
        icon: 'clock',
        type: 'invoice',
      });
    }

    for (const p of lowStockProducts.slice(0, 3)) {
      const skuLabel = p.sku ? `SKU ${p.sku}` : `Producto #${p.id}`;
      items.push({
        id: Number(`2${p.id}`),
        title: 'Alerta de Stock Bajo',
        description: `${skuLabel} • ${p.name} (stock: ${p.stock})`,
        status: 'urgent',
        time: 'revisar hoy',
        icon: 'alert',
        type: 'stock',
      });
    }

    if (items.length === 0 && !loading && !error) {
      items.push({
        id: 999999,
        title: 'Todo al día',
        description: 'No hay tareas ni alertas pendientes',
        status: 'completed',
        time: '—',
        icon: 'check',
        type: 'invoice',
      });
    }

    return items;
  }, [myTasks, pendingInvoices, lowStockProducts, loading, error]);

  const pendingCount = notificationsData.filter(
    (n) => n.status === 'pending' || n.status === 'urgent',
  ).length;

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-400" />
            <div>
              <CardTitle>Tareas Pendientes</CardTitle>
              <CardDescription>Mis tareas y alertas</CardDescription>
            </div>
          </div>
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            {pendingCount} tareas
          </Badge>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Cargando...
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {!loading &&
              !error &&
              notificationsData.map((notification) => (
                <div
                  key={notification.id}
                  className="flex gap-4 p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors border border-transparent hover:border-border/50 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (notification.type === 'task' && notification.task) {
                      setResolutionTask(notification.task);
                      setResolutionModalOpen(true);
                    }
                    if (notification.type === 'invoice') router.push('/invoices');
                    if (notification.type === 'stock') router.push('/products');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (notification.type === 'task' && notification.task) {
                        setResolutionTask(notification.task);
                        setResolutionModalOpen(true);
                      }
                      if (notification.type === 'invoice') router.push('/invoices');
                      if (notification.type === 'stock') router.push('/products');
                    }
                  }}
                >
                  <div className="flex-shrink-0 pt-1">{getIcon(notification.icon)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">{notification.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{notification.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">{notification.time}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <Badge
                      variant="secondary"
                      className={`${getStatusStyles(notification.status)} whitespace-nowrap text-xs`}
                    >
                      {notification.status === 'pending'
                        ? 'Pendiente'
                        : notification.status === 'urgent'
                          ? 'Urgente'
                          : 'Completado'}
                    </Badge>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      <TaskResolutionModal
        task={resolutionTask}
        open={resolutionModalOpen}
        onOpenChange={setResolutionModalOpen}
        onDone={loadData}
        onVerFactura={handleVerFactura}
      />

      <InvoiceDetailSheet
        invoiceId={detailInvoiceId}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        taskId={detailTaskId}
        onRefresh={loadData}
      />
    </>
  );
}
