'use client';

import { Bell, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Notification {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'urgent' | 'completed';
  time: string;
  icon: 'clock' | 'alert' | 'check';
}

const notificationsData: Notification[] = [
  {
    id: 1,
    title: 'Factura #INV-2024-001 Pendiente',
    description: 'Esperando pago de Acme Corp',
    status: 'pending',
    time: 'hace 2 horas',
    icon: 'clock',
  },
  {
    id: 2,
    title: 'Alerta de Stock Bajo',
    description: 'El producto SKU-12345 se está agotando',
    status: 'urgent',
    time: 'hace 4 horas',
    icon: 'alert',
  },
  {
    id: 3,
    title: 'Pago Recibido',
    description: 'La factura #INV-2024-005 ha sido pagada',
    status: 'completed',
    time: 'hace 1 día',
    icon: 'check',
  },
  {
    id: 4,
    title: 'Pedido Cliente Listo',
    description: 'El pedido #ORD-2024-042 está listo para recoger',
    status: 'pending',
    time: 'hace 6 horas',
    icon: 'clock',
  },
];

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
    case 'clock':
    default:
      return <Clock className="h-5 w-5 text-yellow-400" />;
  }
};

export default function NotificationsSection() {
  const pendingCount = notificationsData.filter(
    (n) => n.status === 'pending' || n.status === 'urgent'
  ).length;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-400" />
          <div>
            <CardTitle>Tareas Pendientes</CardTitle>
            <CardDescription>Mantén un seguimiento de tus actividades pendientes</CardDescription>
          </div>
        </div>
        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
          {pendingCount} tareas
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {notificationsData.map((notification) => (
            <div
              key={notification.id}
              className="flex gap-4 p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors border border-transparent hover:border-border/50"
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
  );
}
