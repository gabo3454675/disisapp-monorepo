'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { MoreVertical, TrendingUp, Users, FileText, AlertCircle, Loader2, ListTodo, ExternalLink, Receipt, Percent, Banknote } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/useAuthStore';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import MetricCard from '@/components/metric-card';
import NotificationsSection from '@/components/notifications-section';
import { RateConfigModal } from '@/components/rate-config-modal';
import apiClient from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';

// Cargar componentes pesados de Recharts solo en el cliente
const ResponsiveContainer = dynamic<any>(
  () => import('recharts').then((m) => m.ResponsiveContainer as any),
  { ssr: false }
);
const CartesianGrid = dynamic<any>(
  () => import('recharts').then((m) => m.CartesianGrid as any),
  { ssr: false }
);
const XAxis = dynamic<any>(
  () => import('recharts').then((m) => m.XAxis as any),
  { ssr: false }
);
const YAxis = dynamic<any>(
  () => import('recharts').then((m) => m.YAxis as any),
  { ssr: false }
);
const Tooltip = dynamic<any>(
  () => import('recharts').then((m) => m.Tooltip as any),
  { ssr: false }
);
const Legend = dynamic<any>(
  () => import('recharts').then((m) => m.Legend as any),
  { ssr: false }
);
const AreaChart = dynamic<any>(
  () => import('recharts').then((m) => m.AreaChart as any),
  { ssr: false }
);
const Area = dynamic<any>(
  () => import('recharts').then((m) => m.Area as any),
  { ssr: false }
);
const BarChart = dynamic<any>(
  () => import('recharts').then((m) => m.BarChart as any),
  { ssr: false }
);
const Bar = dynamic<any>(
  () => import('recharts').then((m) => m.Bar as any),
  { ssr: false }
);
const ComposedChart = dynamic<any>(
  () => import('recharts').then((m) => m.ComposedChart as any),
  { ssr: false }
);
const Line = dynamic<any>(
  () => import('recharts').then((m) => m.Line as any),
  { ssr: false }
);
const ScatterChart = dynamic<any>(
  () => import('recharts').then((m) => m.ScatterChart as any),
  { ssr: false }
);
const Scatter = dynamic<any>(
  () => import('recharts').then((m) => m.Scatter as any),
  { ssr: false }
);
const ZAxis = dynamic<any>(
  () => import('recharts').then((m) => m.ZAxis as any),
  { ssr: false }
);

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

interface DashboardHealth {
  salesChartLastMonth: { date: string; ventasUsd: number; ventasBs: number }[];
  topProductsByMargin: { productId: number; productName: string; margin: number }[];
  ticketPromedio: number;
  crecimientoMensual: number;
  totalVentasMes: number;
}

const DEFAULT_HEALTH: DashboardHealth = {
  salesChartLastMonth: [],
  topProductsByMargin: [],
  ticketPromedio: 0,
  crecimientoMensual: 0,
  totalVentasMes: 0,
};

interface MarginErosionProduct {
  productId: number;
  productName: string;
  costPrice: number;
  salePrice: number;
  marginPct: number;
  marginCritical: boolean;
}

interface DebtAgeCustomer {
  customerId: number;
  customerName: string;
  aTiempo: number;
  vencidas1_15: number;
  criticas30: number;
}

interface DashboardDiagnosis {
  marginErosion: MarginErosionProduct[];
  debtAgeByCustomer: DebtAgeCustomer[];
}

const DEFAULT_DIAGNOSIS: DashboardDiagnosis = {
  marginErosion: [],
  debtAgeByCustomer: [],
};

interface ParetoCustomer {
  customerId: number;
  customerName: string;
  volume: number;
  frequency: number;
  segment: 'Leales' | 'En Riesgo' | 'Transaccionales';
}

interface FrictionFunnel {
  totalCreadas: number;
  totalPagadas: number;
  tiempoPromedioHoras: number;
  tiempoPromedioDias: number;
  cuelloDeBotella: 'cobranza' | 'despacho' | null;
  mensajeAlerta: string | null;
}

interface StrategyInsight {
  tipo: string;
  texto: string;
  entidad?: string;
}

interface DashboardStrategy {
  paretoCustomers: ParetoCustomer[];
  frictionFunnel: FrictionFunnel;
  insights: StrategyInsight[];
}

const DEFAULT_STRATEGY: DashboardStrategy = {
  paretoCustomers: [],
  frictionFunnel: {
    totalCreadas: 0,
    totalPagadas: 0,
    tiempoPromedioHoras: 0,
    tiempoPromedioDias: 0,
    cuelloDeBotella: null,
    mensajeAlerta: null,
  },
  insights: [],
};

interface PendingTask {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  createdAt: string;
  createdBy: { id: number; fullName: string | null; email: string };
  organization: { id: number; nombre: string };
  invoice?: { id: number; totalAmount: unknown; status: string } | null;
}

interface CreatedByMeTask {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  assignedTo: { id: number; fullName: string | null; email: string };
  organization: { id: number; nombre: string };
  invoice?: { id: number; totalAmount: unknown; status: string } | null;
}

/** Retorna true si la tasa fue actualizada hoy (misma fecha que hoy). */
function isRateUpdatedToday(rateUpdatedAt: string | null | undefined): boolean {
  if (!rateUpdatedAt) return false;
  try {
    const d = new Date(rateUpdatedAt);
    const today = new Date();
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  } catch {
    return false;
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, user, selectedOrganizationId, selectedCompanyId, _hasHydrated, getCurrentOrganization } = useAuthStore();
  const selectedId = selectedOrganizationId || selectedCompanyId;
  const { canViewFinancialCharts, isSuperAdmin, isAdmin, isManager } = usePermission();
  const [summary, setSummary] = useState<DashboardSummary>(DEFAULT_SUMMARY);
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [createdByMeTasks, setCreatedByMeTasks] = useState<CreatedByMeTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingCreatedByMe, setLoadingCreatedByMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [rateConfigModalOpen, setRateConfigModalOpen] = useState(false);
  const [health, setHealth] = useState<DashboardHealth>(DEFAULT_HEALTH);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DashboardDiagnosis>(DEFAULT_DIAGNOSIS);
  const [loadingDiagnosis, setLoadingDiagnosis] = useState(false);
  const [strategy, setStrategy] = useState<DashboardStrategy>(DEFAULT_STRATEGY);
  const [loadingStrategy, setLoadingStrategy] = useState(false);
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>('');
  const searchParams = useSearchParams();
  const [inspeccionRestringidaMessage, setInspeccionRestringidaMessage] = useState(false);

  const canSeeCreatedByMe = isSuperAdmin || isAdmin || isManager;
  const { formatForDisplay, displayCurrency } = useDisplayCurrency();
  const selectedIdRef = useRef<number | null>(selectedId);
  selectedIdRef.current = selectedId;

  const ventasMesHealth = useMemo(() => {
    const value = health.totalVentasMes;
    return { value, sparkline: [value * 0.5, value * 0.7, value * 0.85, value, value * 1.05, value] };
  }, [health.totalVentasMes]);

  const currentOrg = getCurrentOrganization();
  const orgWithRate = currentOrg && 'rateUpdatedAt' in currentOrg ? currentOrg : null;
  const showRateSystemTask =
    (isSuperAdmin || isAdmin || isManager) &&
    !!orgWithRate &&
    !isRateUpdatedToday(orgWithRate.rateUpdatedAt);

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
    if (!selectedId) {
      setLoading(false);
      setError('No hay empresa seleccionada. Por favor, selecciona una empresa.');
      setSummary(DEFAULT_SUMMARY);
      return;
    }

    const idAtStart = selectedId;
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<DashboardSummary>('/dashboard/summary');
      if (selectedIdRef.current === idAtStart) {
        setSummary(response.data);
      }
    } catch (err: any) {
      if (selectedIdRef.current === idAtStart) {
        console.error('Error fetching dashboard summary:', err);
        const errorMessage = err.response?.data?.message || err.message || 'Error al cargar los datos del dashboard';
        setError(errorMessage);
        setSummary(DEFAULT_SUMMARY);
      }
    } finally {
      if (selectedIdRef.current === idAtStart) {
        setLoading(false);
      }
    }
  }, [selectedId]);

  const fetchDashboardHealth = useCallback(async () => {
    if (!selectedId) return;
    const idAtStart = selectedId;
    try {
      setLoadingHealth(true);
      const res = await apiClient.get<DashboardHealth>('/dashboard/health');
      if (selectedIdRef.current === idAtStart) {
        setHealth(res.data);
      }
    } catch {
      if (selectedIdRef.current === idAtStart) {
        setHealth(DEFAULT_HEALTH);
      }
    } finally {
      if (selectedIdRef.current === idAtStart) {
        setLoadingHealth(false);
      }
    }
  }, [selectedId]);

  const fetchMyPendingTasks = useCallback(async () => {
    if (!isAuthenticated || !selectedId) return;
    try {
      setLoadingTasks(true);
      const url = taskCategoryFilter ? `/tasks/my-pending?category=${encodeURIComponent(taskCategoryFilter)}` : '/tasks/my-pending';
      const res = await apiClient.get<PendingTask[]>(url);
      setPendingTasks(Array.isArray(res.data) ? res.data : []);
    } catch {
      setPendingTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [isAuthenticated, selectedId, taskCategoryFilter]);

  const fetchCreatedByMeTasks = useCallback(async () => {
    if (!isAuthenticated || !canSeeCreatedByMe || !selectedId) return;
    try {
      setLoadingCreatedByMe(true);
      const res = await apiClient.get<CreatedByMeTask[]>('/tasks/created-by-me');
      setCreatedByMeTasks(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCreatedByMeTasks([]);
    } finally {
      setLoadingCreatedByMe(false);
    }
  }, [isAuthenticated, canSeeCreatedByMe, selectedId]);

  useEffect(() => {
    if (mounted && _hasHydrated && isAuthenticated) {
      fetchMyPendingTasks();
      fetchCreatedByMeTasks();
    }
  }, [mounted, _hasHydrated, isAuthenticated, fetchMyPendingTasks, fetchCreatedByMeTasks]);

  useEffect(() => {
    const onTasksUpdated = () => {
      fetchMyPendingTasks();
      fetchCreatedByMeTasks();
    };
    window.addEventListener('tasks-updated', onTasksUpdated);
    return () => window.removeEventListener('tasks-updated', onTasksUpdated);
  }, [fetchMyPendingTasks, fetchCreatedByMeTasks]);

  useEffect(() => {
    if (mounted && _hasHydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [mounted, _hasHydrated, isAuthenticated, router]);

  // Al cambiar de organización: resetear datos mostrados y cargar los de la nueva org
  useEffect(() => {
    if (!selectedId || !mounted || !_hasHydrated) return;
    setSummary(DEFAULT_SUMMARY);
    setHealth(DEFAULT_HEALTH);
    setDiagnosis(DEFAULT_DIAGNOSIS);
    setStrategy(DEFAULT_STRATEGY);
    setError(null);
    setLoading(true);
    setLoadingHealth(true);
    setLoadingDiagnosis(true);
    setLoadingStrategy(true);
  }, [selectedId, mounted, _hasHydrated]);

  useEffect(() => {
    // Solo intentar cargar datos después de que todo esté hidratado
    if (mounted && _hasHydrated && isAuthenticated) {
      fetchDashboardSummary();
    }
  }, [mounted, _hasHydrated, isAuthenticated, fetchDashboardSummary]);

  useEffect(() => {
    if (mounted && _hasHydrated && isAuthenticated && canViewFinancialCharts) {
      fetchDashboardHealth();
    }
  }, [mounted, _hasHydrated, isAuthenticated, canViewFinancialCharts, fetchDashboardHealth]);

  const fetchDashboardDiagnosis = useCallback(async () => {
    if (!selectedId) return;
    const idAtStart = selectedId;
    try {
      setLoadingDiagnosis(true);
      const res = await apiClient.get<DashboardDiagnosis>('/dashboard/diagnosis');
      if (selectedIdRef.current === idAtStart) {
        setDiagnosis(res.data);
      }
    } catch {
      if (selectedIdRef.current === idAtStart) {
        setDiagnosis(DEFAULT_DIAGNOSIS);
      }
    } finally {
      if (selectedIdRef.current === idAtStart) {
        setLoadingDiagnosis(false);
      }
    }
  }, [selectedId]);

  useEffect(() => {
    if (mounted && _hasHydrated && isAuthenticated && canViewFinancialCharts) {
      fetchDashboardDiagnosis();
    }
  }, [mounted, _hasHydrated, isAuthenticated, canViewFinancialCharts, fetchDashboardDiagnosis]);

  const fetchDashboardStrategy = useCallback(async () => {
    if (!selectedId) return;
    const idAtStart = selectedId;
    try {
      setLoadingStrategy(true);
      const res = await apiClient.get<DashboardStrategy>('/dashboard/strategy');
      if (selectedIdRef.current === idAtStart) {
        setStrategy(res.data);
      }
    } catch {
      if (selectedIdRef.current === idAtStart) {
        setStrategy(DEFAULT_STRATEGY);
      }
    } finally {
      if (selectedIdRef.current === idAtStart) {
        setLoadingStrategy(false);
      }
    }
  }, [selectedId]);

  useEffect(() => {
    if (mounted && _hasHydrated && isAuthenticated && canViewFinancialCharts) {
      fetchDashboardStrategy();
    }
  }, [mounted, _hasHydrated, isAuthenticated, canViewFinancialCharts, fetchDashboardStrategy]);

  useEffect(() => {
    if (searchParams.get('error') === 'inspeccion_restringida') {
      setInspeccionRestringidaMessage(true);
      router.replace('/');
    }
  }, [searchParams, router]);

  // Mientras se carga en el servidor o hidrata, mostrar un estado de carga
  if (!mounted || !_hasHydrated) {
    return (
      <div className="min-w-0 overflow-x-hidden px-4 py-5 sm:px-5 md:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-sm sm:text-base text-muted-foreground">Cargando...</span>
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
    <div className="min-w-0 overflow-x-hidden px-4 py-5 sm:px-5 sm:py-6 md:px-6 md:py-7 lg:px-8 lg:py-8 max-w-7xl mx-auto">
      {/* Header - Siempre visible */}
      <div className="mb-5 md:mb-8">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1.5 md:mb-2 truncate">
          {greeting()}, {userName}.
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">Esto es lo que está pasando con tu negocio hoy.</p>
      </div>

      {/* Mensaje al redirigir desde Inspección sin acceso */}
      {inspeccionRestringidaMessage && (
        <Card className="mb-6 bg-amber-500/10 border-amber-500/40">
          <CardContent className="py-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-foreground">
              No tienes acceso al módulo de Inspección de vehículos. Está restringido a la empresa autorizada (Davean) y a usuarios con rol ADMIN u OPERATOR.
            </p>
            <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setInspeccionRestringidaMessage(false)}>
              Cerrar
            </Button>
          </CardContent>
        </Card>
      )}

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

      {/* Contenido del dashboard - key por organización para evitar estado viejo al cambiar de empresa */}
      {!loading && (
        <div key={selectedId ?? 'none'}>
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 md:mb-8">
            <MetricCard
              title="Ventas de Hoy"
              value={formatForDisplay(summary.totalSalesToday)}
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

          {/* Mis Tareas Pendientes */}
          <Card className="mb-6 md:mb-8 bg-card border-border">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <ListTodo className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                <span className="min-w-0">Mis Tareas Pendientes</span>
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Tareas asignadas a ti (pendientes o en progreso)</CardDescription>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  variant={taskCategoryFilter === '' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTaskCategoryFilter('')}
                >
                  Todas
                </Button>
                <Button
                  variant={taskCategoryFilter === 'COBRANZA' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTaskCategoryFilter('COBRANZA')}
                >
                  Cobranza
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
              {loadingTasks ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingTasks.length === 0 && !showRateSystemTask ? (
                <p className="text-sm text-muted-foreground text-center py-8">No tienes tareas pendientes</p>
              ) : (
                <div className="space-y-3">
                  {/* Tarea de sistema: Actualizar Tasa del Día (solo SUPER_ADMIN, ADMIN, MANAGER) */}
                  {showRateSystemTask && (
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground text-sm sm:text-base">Actualizar Tasa del Día</p>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                          La tasa de cambio no ha sido actualizada hoy. Por favor verifica el valor actual.
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">Tarea de sistema</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                        <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40">
                          Alta
                        </Badge>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setRateConfigModalOpen(true)}
                          className="gap-1.5 shrink-0"
                        >
                          <TrendingUp className="h-3.5 w-3.5" />
                          Configurar tasa
                        </Button>
                      </div>
                    </div>
                  )}
                  {pendingTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground text-sm sm:text-base break-words">{task.title}</p>
                        {task.description && (
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2 truncate">
                          Asignada por {task.createdBy?.fullName || task.createdBy?.email} • {task.organization?.nombre}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                        {task.invoice && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/invoices?highlight=${task.invoice?.id}`)}
                            className="text-xs shrink-0"
                          >
                            <ExternalLink className="h-3 w-3 mr-1 shrink-0" />
                            Ver factura #{task.invoice.id}
                          </Button>
                        )}
                        <Badge variant={task.status === 'IN_PROGRESS' ? 'default' : 'secondary'} className="text-xs shrink-0">
                          {task.status === 'PENDING' ? 'Pendiente' : task.status === 'IN_PROGRESS' ? 'En progreso' : task.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tareas que asigné - Solo SUPER_ADMIN, ADMIN, MANAGER (ven estado actualizado por el asignado) */}
          {canSeeCreatedByMe && (
            <Card className="mb-6 md:mb-8 bg-card border-border">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <ListTodo className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  Tareas que asigné
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Estado actualizado por el equipo (En progreso / Completada)</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {loadingCreatedByMe ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : createdByMeTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No has asignado tareas aún</p>
                ) : (
                  <div className="space-y-3">
                    {createdByMeTasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-start justify-between gap-4 p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">{t.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Asignada a: {t.assignedTo?.fullName || t.assignedTo?.email} • {t.organization?.nombre}
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className={
                            t.status === 'DONE'
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                              : t.status === 'IN_PROGRESS'
                                ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/40'
                                : 'bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/40'
                          }
                        >
                          {t.status === 'PENDING' ? 'Pendiente' : t.status === 'IN_PROGRESS' ? 'En progreso' : 'Completada'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Dashboard de Salud General - Solo para SUPER_ADMIN/ADMIN/MANAGER */}
          {canViewFinancialCharts && (
            <div className="space-y-5 md:space-y-8 mb-6 md:mb-8">
              <div>
                <h2 className="text-lg sm:text-xl font-semibold mb-2 md:mb-4">Salud General</h2>
                <p className="text-muted-foreground text-xs sm:text-sm mb-4 md:mb-6">
                  Visión rápida de ventas, márgenes e impuestos del último mes.
                </p>
              </div>

              {/* KPI Cards: Venta promedio, Crecimiento mensual, Ventas del mes (cobro real) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <MetricCard
                  title="Venta promedio por factura"
                  value={loadingHealth ? '—' : formatForDisplay(health.ticketPromedio)}
                  change={health.crecimientoMensual >= 0 ? `+${health.crecimientoMensual}%` : `${health.crecimientoMensual}%`}
                  changeType={health.crecimientoMensual >= 0 ? 'positive' : 'negative'}
                  icon={Receipt}
                  sparklineData={[health.ticketPromedio * 0.9, health.ticketPromedio * 0.95, health.ticketPromedio, health.ticketPromedio * 1.02, health.ticketPromedio * 0.98, health.ticketPromedio]}
                />
                <MetricCard
                  title="Crecimiento mensual"
                  value={loadingHealth ? '—' : `${health.crecimientoMensual >= 0 ? '+' : ''}${health.crecimientoMensual}%`}
                  change="vs mes anterior"
                  changeType={health.crecimientoMensual >= 0 ? 'positive' : 'negative'}
                  icon={Percent}
                  sparklineData={[0, Math.max(0, health.crecimientoMensual * 0.3), health.crecimientoMensual * 0.6, health.crecimientoMensual, health.crecimientoMensual * 1.05, health.crecimientoMensual]}
                />
                <MetricCard
                  title="Ventas del mes"
                  value={loadingHealth ? '—' : formatForDisplay(ventasMesHealth.value)}
                  change="Mes en curso"
                  changeType="positive"
                  icon={Banknote}
                  sparklineData={ventasMesHealth.sparkline}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-8">
                {/* Gráfico de áreas: Ventas $ vs Ventas Bs (último mes) */}
                <Card className="lg:col-span-2 bg-card border-border overflow-hidden">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">Ventas: USD esperadas vs Bs reales</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Último mes por día</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    {loadingHealth ? (
                      <div className="flex items-center justify-center h-[240px] sm:h-[280px] md:h-[300px] min-h-[200px]">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : health.salesChartLastMonth.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8 sm:py-12">Sin datos del último mes</p>
                    ) : (
                      <div className="h-[240px] sm:h-[280px] md:h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={health.salesChartLastMonth.map((d) => ({
                            ...d,
                            fecha: new Date(d.date).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }),
                          }))}
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorVentasUsd" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorVentasBs" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="fecha" className="text-muted-foreground" tick={{ fontSize: 12 }} />
                          <YAxis
                            className="text-muted-foreground"
                            tick={{ fontSize: 12 }}
                            tickFormatter={(v: number) =>
                              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                            }
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                            formatter={(value: number) => [value.toFixed(2), '']}
                            labelFormatter={(label) => `Fecha: ${label}`}
                          />
                          <Legend />
                          <Area type="monotone" dataKey="ventasUsd" name="Ventas en $" stroke="#3b82f6" fillOpacity={1} fill="url(#colorVentasUsd)" />
                          <Area type="monotone" dataKey="ventasBs" name="Ventas en Bs" stroke="#10b981" fillOpacity={1} fill="url(#colorVentasBs)" />
                        </AreaChart>
                      </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Top 5 productos por margen */}
                <Card className="bg-card border-border overflow-hidden">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">Top 5 por margen</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Productos que más ganancia neta generan</CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    {loadingHealth ? (
                      <div className="flex items-center justify-center h-[240px] sm:h-[280px] md:h-[300px] min-h-[200px]">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : health.topProductsByMargin.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8 sm:py-12">Sin ventas en el último mes</p>
                    ) : (
                      <div className="h-[240px] sm:h-[280px] md:h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={health.topProductsByMargin.map((p) => ({ ...p, name: p.productName.length > 18 ? p.productName.slice(0, 18) + '…' : p.productName }))}
                          layout="vertical"
                          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis type="number" className="text-muted-foreground" tickFormatter={(v) => formatForDisplay(v)} />
                          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(var(--card))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px',
                            }}
                            formatter={(value: number) => [formatForDisplay(value), 'Margen']}
                          />
                          <Bar dataKey="margin" name="Margen" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <NotificationsSection />

              {/* Diagnóstico: Erosión de margen + Antigüedad de deuda */}
              <div className="pt-6 md:pt-8 border-t border-border">
                <div className="mb-4 md:mb-6">
                  <h2 className="text-lg sm:text-xl font-semibold mb-2">Diagnóstico</h2>
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    Detecta dónde se erosiona el margen y qué clientes priorizar para cobro.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-8 mb-6 md:mb-8">
                  {/* Erosión de margen: líneas costo vs precio, puntos rojos si margen &lt; 15% */}
                  <Card className="bg-card border-border overflow-hidden">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="text-base sm:text-lg">Erosión de margen</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        Costo de reposición vs precio de venta. Puntos en rojo = margen &lt; 15% (riesgo por tasa BCV).
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                      {loadingDiagnosis ? (
                        <div className="flex items-center justify-center h-[240px] sm:h-[280px] md:h-[300px] min-h-[200px]">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : diagnosis.marginErosion.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8 sm:py-12">Sin productos con precio de venta</p>
                      ) : (
                        <div className="h-[260px] sm:h-[280px] md:h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            data={diagnosis.marginErosion.map((p) => ({
                              ...p,
                              name: p.productName.length > 14 ? p.productName.slice(0, 14) + '…' : p.productName,
                            }))}
                            margin={{ top: 10, right: 20, left: 0, bottom: 60 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="name" className="text-muted-foreground" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 10 }} />
                            <YAxis className="text-muted-foreground" tick={{ fontSize: 11 }} tickFormatter={(v) => formatForDisplay(v)} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                              formatter={(value: number) => [formatForDisplay(value), '']}
                              labelFormatter={(_, payload) => payload?.[0]?.payload?.productName}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="costPrice" name="Costo reposición" stroke="#f59e0b" strokeWidth={2} dot={false} />
                            <Line
                              type="monotone"
                              dataKey="salePrice"
                              name="Precio venta"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              dot={({ cx, cy, payload }) =>
                                payload.marginCritical ? (
                                  <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#b91c1c" strokeWidth={2} />
                                ) : (
                                  <circle cx={cx} cy={cy} r={3} fill="#3b82f6" />
                                )
                              }
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Antigüedad de deuda: barras apiladas por cliente */}
                  <Card className="bg-card border-border overflow-hidden">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="text-base sm:text-lg">Antigüedad de deuda</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        Cuentas por cobrar: A tiempo, vencidas 1-15 días y críticas +30. Identifica a quién llamar hoy.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                      {loadingDiagnosis ? (
                        <div className="flex items-center justify-center h-[240px] sm:h-[280px] md:h-[300px] min-h-[200px]">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : diagnosis.debtAgeByCustomer.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8 sm:py-12">No hay facturas pendientes de cobro</p>
                      ) : (
                        <div className="h-[260px] sm:h-[280px] md:h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={diagnosis.debtAgeByCustomer.slice(0, 10).map((c) => ({
                              ...c,
                              name: c.customerName.length > 12 ? c.customerName.slice(0, 12) + '…' : c.customerName,
                            }))}
                            margin={{ top: 10, right: 10, left: 0, bottom: 40 }}
                            layout="vertical"
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis type="number" className="text-muted-foreground" tickFormatter={(v) => formatForDisplay(v)} />
                            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                              formatter={(value: number) => [formatForDisplay(value), '']}
                              labelFormatter={(_, payload) => payload?.[0]?.payload?.customerName}
                            />
                            <Legend />
                            <Bar dataKey="aTiempo" name="A tiempo" stackId="deuda" fill="#22c55e" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="vencidas1_15" name="Vencidas 1-15 días" stackId="deuda" fill="#eab308" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="criticas30" name="Críticas +30 días" stackId="deuda" fill="#ef4444" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Estrategia: Pareto 80/20 + Embudo fricción + Insights */}
              <div className="pt-6 md:pt-8 border-t border-border">
                <div className="mb-4 md:mb-6">
                  <h2 className="text-lg sm:text-xl font-semibold mb-2">Estrategia</h2>
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    Consultoría automática: Pareto de clientes, fricción operativa e insights en lenguaje natural.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-8 mb-6 md:mb-8">
                  {/* Pareto 80/20: dispersión volumen vs frecuencia, etiquetas Leales / En Riesgo / Transaccionales */}
                  <Card className="lg:col-span-2 bg-card border-border overflow-hidden">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="text-base sm:text-lg">Pareto 80/20 — Clientes</CardTitle>
                      <CardDescription className="text-xs sm:text-sm hidden sm:block">
                        Volumen de compra vs frecuencia. Leales (alto volumen y frecuencia), Transaccionales (mucha frecuencia, poco volumen), En Riesgo (bajo engagement).
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                      {loadingStrategy ? (
                        <div className="flex items-center justify-center h-[240px] sm:h-[280px] md:h-[300px] min-h-[200px]">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : strategy.paretoCustomers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8 sm:py-12">Sin datos de clientes en el último año</p>
                      ) : (
                        <div className="h-[260px] sm:h-[280px] md:h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis type="number" dataKey="frequency" name="Frecuencia" className="text-muted-foreground" tick={{ fontSize: 11 }} />
                            <YAxis type="number" dataKey="volume" name="Volumen" className="text-muted-foreground" tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))} />
                            <ZAxis type="number" dataKey="customerId" range={[80, 400]} name="" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                              }}
                              formatter={(value: number, name: string) => [name === 'Volumen' ? formatForDisplay(value) : value, name]}
                              labelFormatter={(_, payload) => payload?.[0]?.payload?.customerName}
                            />
                            <Legend />
                            <Scatter name="Leales" data={strategy.paretoCustomers.filter((c) => c.segment === 'Leales')} fill="#22c55e" fillOpacity={0.8} />
                            <Scatter name="Transaccionales" data={strategy.paretoCustomers.filter((c) => c.segment === 'Transaccionales')} fill="#3b82f6" fillOpacity={0.8} />
                            <Scatter name="En Riesgo" data={strategy.paretoCustomers.filter((c) => c.segment === 'En Riesgo')} fill="#f59e0b" fillOpacity={0.8} />
                          </ScatterChart>
                        </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Embudo de fricción operativa */}
                  <Card className="bg-card border-border">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="text-base sm:text-lg">Embudo de fricción</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        Tiempo desde creación de la factura hasta que se marca como Pagada.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
                      {loadingStrategy ? (
                        <div className="flex items-center justify-center h-[180px] sm:h-[200px] min-h-[160px]">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Creadas (Presupuesto/Orden)</span>
                            <span className="font-medium">{strategy.frictionFunnel.totalCreadas}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Pagadas</span>
                            <span className="font-medium text-green-600 dark:text-green-400">{strategy.frictionFunnel.totalPagadas}</span>
                          </div>
                          <div className="pt-2 border-t border-border">
                            <p className="text-sm text-muted-foreground">Tiempo promedio hasta pago</p>
                            <p className="text-xl font-semibold">
                              {strategy.frictionFunnel.tiempoPromedioDias >= 1
                                ? `${strategy.frictionFunnel.tiempoPromedioDias} días`
                                : `${strategy.frictionFunnel.tiempoPromedioHoras} h`}
                            </p>
                          </div>
                          {strategy.frictionFunnel.mensajeAlerta && (
                            <div className={`rounded-lg p-3 text-xs sm:text-sm ${strategy.frictionFunnel.cuelloDeBotella === 'cobranza' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300' : 'bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-300'}`}>
                              <p className="font-medium">Cuello de botella: {strategy.frictionFunnel.cuelloDeBotella === 'cobranza' ? 'Cobranza' : 'Despacho'}</p>
                              <p className="mt-1 text-muted-foreground break-words">{strategy.frictionFunnel.mensajeAlerta}</p>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Insights en lenguaje natural */}
                <Card className="bg-card border-border">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-base sm:text-lg">Insights para tu negocio</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Recomendaciones automáticas según ventas, márgenes y cobranza.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0">
                    {loadingStrategy ? (
                      <div className="flex items-center justify-center py-6 sm:py-8 min-h-[120px]">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : strategy.insights.length === 0 ? (
                      <p className="text-xs sm:text-sm text-muted-foreground text-center py-6">No hay insights aún. Genera ventas y márgenes para recibir recomendaciones.</p>
                    ) : (
                      <ul className="space-y-2 sm:space-y-3">
                        {strategy.insights.map((insight, i) => (
                          <li
                            key={i}
                            className="flex gap-2 sm:gap-3 p-3 rounded-lg bg-secondary/50 border border-border/50 min-w-0"
                          >
                            {insight.tipo === 'producto_margen' && (
                              <span className="flex-shrink-0 rounded-full bg-amber-500/20 p-1.5" title="Producto / margen">
                                <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              </span>
                            )}
                            {insight.tipo === 'cliente_riesgo' && (
                              <span className="flex-shrink-0 rounded-full bg-blue-500/20 p-1.5" title="Cliente">
                                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                              </span>
                            )}
                            {insight.tipo === 'cuello_botella' && (
                              <span className="flex-shrink-0 rounded-full bg-red-500/20 p-1.5" title="Fricción">
                                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                              </span>
                            )}
                            {!['producto_margen', 'cliente_riesgo', 'cuello_botella'].includes(insight.tipo) && (
                              <span className="flex-shrink-0 rounded-full bg-primary/20 p-1.5" title="Insight">
                                <TrendingUp className="h-4 w-4 text-primary" />
                              </span>
                            )}
                            <p className="text-xs sm:text-sm text-foreground leading-relaxed break-words min-w-0">{insight.texto}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Recent Transactions */}
          <Card className="bg-card border-border overflow-hidden mb-6 md:mb-8">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 sm:p-6">
              <div className="min-w-0">
                <CardTitle className="text-base sm:text-lg">Transacciones Recientes</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Últimas facturas y pagos</CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="hover:bg-secondary shrink-0 h-9 w-9">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-3 sm:space-y-4">
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
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 sm:p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors min-w-0"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Avatar className="h-9 w-9 sm:h-10 sm:w-10 shrink-0">
                            <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-xs sm:text-sm">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground text-sm sm:text-base truncate">{transaction.customerName || 'Cliente'}</p>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">
                              {formatForDisplay(transaction.amount)} • {formatDate(transaction.createdAt)}
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
        </div>
      )}

      <RateConfigModal open={rateConfigModalOpen} onOpenChange={setRateConfigModalOpen} />
    </div>
  );
}
