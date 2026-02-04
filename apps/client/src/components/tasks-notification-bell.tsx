'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import apiClient from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Campanita con badge de tareas no leídas. Al hacer clic navega al dashboard (donde está la sección de tareas).
 */
export function TasksNotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await apiClient.get<{ count: number }>('/tasks/my-unread-count');
      setCount(res.data?.count ?? 0);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    const onTasksUpdated = () => fetchCount();
    window.addEventListener('tasks-updated', onTasksUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener('tasks-updated', onTasksUpdated);
    };
  }, [fetchCount]);

  const handleClick = () => {
    router.push('/');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'relative inline-flex items-center justify-center rounded-lg border border-transparent p-2 transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[44px] min-w-[44px] touch-manipulation',
        className
      )}
      title={count > 0 ? `Tienes ${count} nueva(s) tarea(s)` : 'Tareas'}
    >
      <Bell className="h-5 w-5 text-foreground" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
