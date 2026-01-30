'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MoreVertical, TrendingUp, Users, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/useAuthStore';
import MetricCard from '@/components/metric-card';
import NotificationsSection from '@/components/notifications-section';
import apiClient from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';

interface DashboardSummary {
  totalSalesToday: number;
  productsCount: number;
  lowStockCount: number;
  recentTransactions: {
    id: number;
    customerName: string;
    amount: number;
    status: string;
    createdAt: string;
  }[];
}

const revenueData = [
  { month: 'Ene', thisYear: 4000, lastYear: 2400 },
  { month: 'Feb', thisYear: 3000, lastYear: 1398 },
  { month: 'Mar', thisYear: 2000, lastYear: 9800 },
  { month: 'Abr', thisYear: 2780, lastYear: 3908 },
  { month: 'May', thisYear: 1890, lastYear: 4800 },
  { month: 'Jun', thisYear: 2390, lastYear: 3800 },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-VE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '';
  }
};

// Datos por defecto para mostrar siempre contenido
const DEFAULT_SUMMARY: DashboardSummary = {
  totalSalesToday: 0,
  productsCount: 0,
  lowStockCount: 0,
  recentTransactions: [],
};

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user, selectedCompanyId, _hasHydrated } = useAuthStore();
  const { canViewFinancialCharts } = usePermission();
  const [summary, setSummary] = useState<DashboardSummary>(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Asegurar que el componente esté montado en el cliente
  useEffect(() => {
    setMounted(true);
    // Forzar hidratación si no se ha completado
    const timer = setTimeout(() => {
      if (!_hasHydrated) {
        useAuthStore.getState().setHasHydrated(true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [_hasHydrated]);

  const fetchDashboardSummary = useCallback(async () => {
    if (!selectedCompanyId) {
      setLoading(false);
      setError('No hay empresa seleccionada. Por favor, selecciona una empresa.');
      setSummary(DEFAULT_SUMMARY);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<DashboardSummary>('/dashboard/summary');
      setSummary(response.data);
    } catch (err: any) {
      console.error('Error fetching dashboard summary:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Error al cargar los datos del dashboard';
      setError(errorMessage);
      // Siempre establecer datos por defecto para que haya contenido visible
      setSummary(DEFAULT_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId]);

  useEffect(() => {
    if (mounted && _hasHydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [mounted, _hasHydrated, isAuthenticated, router]);

  useEffect(() => {
    // Solo intentar cargar datos después de que todo esté hidratado
    if (mounted && _hasHydrated && isAuthenticated) {
      fetchDashboardSummary();
    }
  }, [mounted, _hasHydrated, isAuthenticated, fetchDashboardSummary]);

  // Mientras se carga en el servidor o hidrata, mostrar un estado de carga
  if (!mounted || !_hasHydrated) {
    return (
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Cargando...</span>
        </div>
      </div>
    );
  }

  // Si no está autenticado después de montar e hidratar, no renderizar nada (será redirigido)
  if (!isAuthenticated) {
    return null;
  }

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  const generateSparklineData = (value: number) => {
    return Array.from({ length: 6 }, (_, i) => {
      const factor = 0.8 + (i * 0.04);
      return Math.max(0, Math.round(value * factor));
    });
  };

  const userName = user?.fullName?.split(' ')[0] || user?.email?.split('@')[0] || 'Usuario';

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header - Siempre visible */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          {greeting()}, {userName}.
        </h1>
        <p className="text-muted-foreground">Esto es lo que está pasando con tu negocio hoy.</p>
      </div>

      {/* Estado de carga */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Cargando datos...</span>
        </div>
      )}

      {/* Mensaje de error */}
      {error && !loading && (
        <Card className="mb-8 bg-destructive/10 border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => fetchDashboardSummary()} variant="outline">
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Contenido del dashboard - SIEMPRE se muestra si no está cargando */}
      {!loading && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard
              title="Ventas de Hoy"
              value={formatCurrency(summary.totalSalesToday)}
              change="+0%"
              changeType={summary.totalSalesToday > 0 ? 'positive' : 'negative'}
              icon={TrendingUp}
              sparklineData={generateSparklineData(summary.totalSalesToday)}
            />
            <MetricCard
              title="Total Productos"
              value={summary.productsCount.toString()}
              change="+0%"
              changeType="positive"
              icon={FileText}
              sparklineData={generateSparklineData(summary.productsCount)}
            />
            <MetricCard
              title="Productos en Stock Bajo"
              value={summary.lowStockCount.toString()}
              change="0%"
              changeType={summary.lowStockCount > 0 ? 'negative' : 'positive'}
              icon={AlertCircle}
              sparklineData={generateSparklineData(summary.lowStockCount)}
            />
            <MetricCard
              title="Facturas Recientes"
              value={summary.recentTransactions.length.toString()}
              change="0%"
              changeType="positive"
              icon={Users}
              sparklineData={generateSparklineData(summary.recentTransactions.length)}
            />
          </div>

          {/* Gráficos financieros - Solo para SUPER_ADMIN/ADMIN/MANAGER */}
          {canViewFinancialCharts && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              {/* Revenue Chart */}
              <Card className="lg:col-span-2 bg-card border-border">
                <CardHeader>
                  <CardTitle>Resumen de Ingresos</CardTitle>
                  <CardDescription>Este mes vs el mes pasado</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" className="text-muted-foreground" />
                      <YAxis className="text-muted-foreground" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Legend />
                      <Bar dataKey="thisYear" fill="#10b981" radius={[8, 8, 0, 0]} name="Este Año" />
                      <Bar dataKey="lastYear" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Año Anterior" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <NotificationsSection />
            </div>
          )}

          {/* Recent Transactions */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Transacciones Recientes</CardTitle>
                <CardDescription>Últimas facturas y pagos</CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="hover:bg-secondary">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {summary.recentTransactions.length > 0 ? (
                  summary.recentTransactions.map((transaction) => {
                    const initials = (transaction.customerName || '')
                      .split(' ')
                      .map((n) => n[0] || '')
                      .filter(Boolean)
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || 'C';
                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{transaction.customerName || 'Cliente'}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(transaction.amount)} • {formatDate(transaction.createdAt)}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={transaction.status === 'PAID' ? 'default' : 'secondary'}
                          className={
                            transaction.status === 'PAID'
                              ? 'bg-green-500/20 text-green-400 border-green-500/30'
                              : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          }
                        >
                          {transaction.status === 'PAID' ? 'Pagado' : transaction.status === 'PENDING' ? 'Pendiente' : 'Cancelado'}
                        </Badge>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No hay transacciones recientes
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
