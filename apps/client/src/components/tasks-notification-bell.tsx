'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Bell, CheckCircle2, AlertCircle, Clock, ListTodo, Loader2, Percent } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNotificationFeed, type NotificationFeedItem } from '@/hooks/useNotificationFeed';
import { TaskResolutionModal, type TaskForResolution } from '@/components/task-resolution-modal';
import { InvoiceDetailSheet } from '@/components/invoice-detail-sheet';

function FeedIcon({ item }: { item: NotificationFeedItem }) {
  switch (item.icon) {
    case 'alert':
      return <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />;
    case 'check':
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />;
    case 'task':
      return <ListTodo className="h-4 w-4 shrink-0 text-blue-400" />;
    case 'clock':
      return item.kind === 'rate' ? (
        <Percent className="h-4 w-4 shrink-0 text-amber-400" />
      ) : (
        <Clock className="h-4 w-4 shrink-0 text-yellow-400" />
      );
    default:
      return <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
}

/**
 * Campanita: lista alertas y recordatorios; al elegir una fila navega o abre la acción (tarea, tasa, etc.).
 */
export function TasksNotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const { feedItems, badgeCount, loading, refetch } = useNotificationFeed();
  const [menuOpen, setMenuOpen] = useState(false);
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

  const activateItem = (item: NotificationFeedItem) => {
    if (item.kind === 'empty') return;
    setMenuOpen(false);
    if (item.kind === 'task' && item.task) {
      setResolutionTask(item.task);
      setResolutionModalOpen(true);
      return;
    }
    if (item.openRateModal) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('open-rate-config-modal'));
      }
      return;
    }
    if (item.href) {
      router.push(item.href);
    }
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'relative inline-flex items-center justify-center rounded-lg border border-transparent p-2 transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[44px] min-w-[44px] touch-manipulation',
              className,
            )}
            title="Alertas y recordatorios"
            aria-label="Abrir notificaciones"
          >
            <Bell className="h-5 w-5 text-foreground" />
            {badgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[min(100vw-1rem,22rem)] p-0"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-sm font-semibold leading-tight">Alertas y recordatorios</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Toca una fila para resolver o ir a la pantalla
            </p>
          </div>

          <div className="max-h-[min(60vh,400px)] overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground text-sm">
                <Loader2 className="h-5 w-5 animate-spin" />
                Cargando…
              </div>
            ) : (
              <ul className="space-y-1">
                {feedItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={item.kind === 'empty'}
                      onClick={() => activateItem(item)}
                      className={cn(
                        'flex w-full gap-2 rounded-lg px-2 py-2.5 text-left text-sm transition-colors',
                        item.kind === 'empty'
                          ? 'opacity-80 cursor-default'
                          : 'hover:bg-accent focus:bg-accent focus:outline-none',
                        item.status === 'urgent' && item.kind !== 'empty' && 'border border-red-500/20 bg-red-500/5',
                      )}
                    >
                      <div className="pt-0.5">
                        <FeedIcon item={item} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug text-foreground line-clamp-2">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{item.timeLabel}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-center text-xs"
              onClick={() => {
                setMenuOpen(false);
                router.push('/');
              }}
            >
              Ver panel de tareas en inicio
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

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
