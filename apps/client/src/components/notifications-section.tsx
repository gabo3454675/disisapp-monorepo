'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Bell, CheckCircle2, AlertCircle, Clock, Loader2, ListTodo, Percent } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TaskResolutionModal, type TaskForResolution } from '@/components/task-resolution-modal';
import { InvoiceDetailSheet } from '@/components/invoice-detail-sheet';
import { useNotificationFeed, type NotificationFeedItem } from '@/hooks/useNotificationFeed';

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

function SectionIcon({ item }: { item: NotificationFeedItem }) {
  switch (item.icon) {
    case 'alert':
      return <AlertCircle className="h-5 w-5 text-red-400" />;
    case 'check':
      return <CheckCircle2 className="h-5 w-5 text-green-400" />;
    case 'task':
      return <ListTodo className="h-5 w-5 text-blue-400" />;
    case 'clock':
      return item.kind === 'rate' ? (
        <Percent className="h-5 w-5 text-amber-400" />
      ) : (
        <Clock className="h-5 w-5 text-yellow-400" />
      );
    default:
      return <Clock className="h-5 w-5 text-yellow-400" />;
  }
}

export default function NotificationsSection() {
  const router = useRouter();
  const { feedItems, loading, error, refetch } = useNotificationFeed();
  const [resolutionTask, setResolutionTask] = useState<TaskForResolution | null>(null);
  const [resolutionModalOpen, setResolutionModalOpen] = useState(false);
  const [detailInvoiceId, setDetailInvoiceId] = useState<number | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const handleVerFactura = useCallback((invoiceId: number, taskId: number) => {
    setDetailInvoiceId(invoiceId);
    setDetailTaskId(taskId);
    setDetailSheetOpen(true);
  }, []);

  const handleRowClick = (item: NotificationFeedItem) => {
    if (item.kind === 'empty') return;
    if (item.kind === 'task' && item.task) {
      setResolutionTask(item.task);
      setResolutionModalOpen(true);
      return;
    }
    if (item.openRateModal) {
      window.dispatchEvent(new Event('open-rate-config-modal'));
      return;
    }
    if (item.href) {
      router.push(item.href);
    }
  };

  const pendingCount = feedItems.filter((n) => n.kind !== 'empty').length;

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-400" />
            <div>
              <CardTitle>Tareas y alertas</CardTitle>
              <CardDescription>Recordatorios del día y pendientes</CardDescription>
            </div>
          </div>
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            {pendingCount} pendiente{pendingCount === 1 ? '' : 's'}
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
              feedItems.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex gap-4 p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors border border-transparent hover:border-border/50 ${
                    notification.kind === 'empty' ? 'cursor-default' : 'cursor-pointer'
                  }`}
                  role={notification.kind === 'empty' ? undefined : 'button'}
                  tabIndex={notification.kind === 'empty' ? undefined : 0}
                  onClick={() => handleRowClick(notification)}
                  onKeyDown={(e) => {
                    if (notification.kind === 'empty') return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRowClick(notification);
                    }
                  }}
                >
                  <div className="flex-shrink-0 pt-1">
                    <SectionIcon item={notification} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">{notification.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{notification.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">{notification.timeLabel}</p>
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
                          : 'Listo'}
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
        onDone={refetch}
        onVerFactura={handleVerFactura}
      />

      <InvoiceDetailSheet
        invoiceId={detailInvoiceId}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        taskId={detailTaskId}
        onRefresh={refetch}
      />
    </>
  );
}
