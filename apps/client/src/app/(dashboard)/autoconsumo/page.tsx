'use client';

import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, PackageMinus, TrendingDown } from 'lucide-react';
import apiClient from '@/lib/api';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';

interface KpisResponse {
  economicImpactByDay: { date: string; totalCost: number; count: number }[];
  topProducts: { productId: number; productName: string; quantity: number; totalCost: number }[];
  reasonDistribution: { reason: string | null; count: number; totalCost: number }[];
}

const REASON_LABELS: Record<string, string> = {
  MERMA: 'Merma',
  MUESTRAS: 'Muestras',
  USO_OPERATIVO: 'Uso operativo',
  SIN_CLASIFICAR: 'Sin clasificar',
};

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function AutoconsumoPage() {
  const [kpis, setKpis] = useState<KpisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { formatCurrency } = useDisplayCurrency();

  useEffect(() => {
    const from = dateFrom || undefined;
    const to = dateTo || undefined;
    const params = new URLSearchParams();
    if (from) params.set('dateFrom', from);
    if (to) params.set('dateTo', to);
    setLoading(true);
    apiClient
      .get<KpisResponse>(`/inventory/movements/kpis?${params.toString()}`)
      .then((res) => setKpis(res.data))
      .catch(() => setKpis({ economicImpactByDay: [], topProducts: [], reasonDistribution: [] }))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  const pieData =
    kpis?.reasonDistribution.map((r, i) => ({
      name: REASON_LABELS[r.reason ?? 'SIN_CLASIFICAR'] ?? r.reason ?? 'Sin clasificar',
      value: r.totalCost,
      count: r.count,
      color: COLORS[i % COLORS.length],
    })) ?? [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <PackageMinus className="h-7 w-7" />
            Autoconsumo e inventario
          </h1>
          <p className="text-muted-foreground">
            Impacto económico, productos más consumidos y distribución por motivo
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Desde"
          />
          <span className="text-muted-foreground text-sm">a</span>
          <input
            type="date"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Hasta"
          />
        </div>
      </div>

      {/* Impacto económico por día - Gráfico de área */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-amber-500" />
            Impacto económico diario
          </CardTitle>
          <CardDescription>
            Valor monetario (costo) del consumo interno por día
          </CardDescription>
        </CardHeader>
        <CardContent>
          {kpis?.economicImpactByDay.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={kpis.economicImpactByDay}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorTotalCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                />
                <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Costo']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString('es-VE')}
                />
                <Area
                  type="monotone"
                  dataKey="totalCost"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorTotalCost)"
                  name="Costo"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-12">
              No hay datos de autoconsumo en el rango seleccionado.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productos más consumidos - Barras horizontales */}
        <Card>
          <CardHeader>
            <CardTitle>Productos más consumidos</CardTitle>
            <CardDescription>Por valor total (costo)</CardDescription>
          </CardHeader>
          <CardContent>
            {kpis?.topProducts.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  layout="vertical"
                  data={kpis.topProducts}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                  <YAxis
                    type="category"
                    dataKey="productName"
                    width={120}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.productName}
                  />
                  <Bar
                    dataKey="totalCost"
                    fill="#3b82f6"
                    radius={[0, 4, 4, 0]}
                    name="Costo total"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">
                No hay datos de productos.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Distribución por motivo - Dona */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución por motivo</CardTitle>
            <CardDescription>Merma, muestras o uso operativo</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    content={({ active, payload }) =>
                      active && payload?.[0] ? (
                        <div className="rounded-lg border bg-background p-3 shadow-md">
                          <p className="font-medium">{payload[0].name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(Number(payload[0].value))} ·{' '}
                            {(payload[0].payload as { count: number }).count} movimientos
                          </p>
                        </div>
                      ) : null
                    }
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-12">
                No hay datos por motivo.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
