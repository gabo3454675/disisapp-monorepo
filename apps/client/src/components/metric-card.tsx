'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
  icon: LucideIcon;
  sparklineData: number[];
}

export default function MetricCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  sparklineData,
}: MetricCardProps) {
  const changeData = sparklineData.map((val) => ({ value: val }));

  return (
    <Card className="bg-card border-border hover:border-sidebar-primary/50 transition-all duration-300 group">
      <CardContent className="p-6">
        {/* Top Section */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm text-muted-foreground mb-2">{title}</p>
            <h3 className="text-2xl md:text-3xl font-bold text-foreground">{value}</h3>
          </div>
          <div className="p-3 rounded-lg bg-sidebar-primary/10 group-hover:bg-sidebar-primary/20 transition-colors">
            <Icon className="h-6 w-6 text-sidebar-primary" />
          </div>
        </div>

        {/* Sparkline Chart */}
        <div className="mb-4 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={changeData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={changeType === 'positive' ? '#10b981' : '#ef4444'}
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Change Badge */}
        <div className="flex items-center gap-1">
          {changeType === 'positive' ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <span
            className={cn(
              'text-sm font-medium',
              changeType === 'positive' ? 'text-green-500' : 'text-red-500'
            )}
          >
            {change}
          </span>
          <span className="text-sm text-muted-foreground">vs período anterior</span>
        </div>
      </CardContent>
    </Card>
  );
}
