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
    <Card className="bg-card border-border hover:border-sidebar-primary/50 transition-all duration-300 group min-w-0">
      <CardContent className="p-4 sm:p-5 md:p-6">
        {/* Top Section */}
        <div className="flex items-start justify-between gap-2 mb-4 sm:mb-6">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm text-muted-foreground mb-1 sm:mb-2 truncate">{title}</p>
            <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground truncate">{value}</h3>
          </div>
          <div className="p-2 sm:p-3 rounded-lg bg-sidebar-primary/10 group-hover:bg-sidebar-primary/20 transition-colors shrink-0">
            <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-sidebar-primary" />
          </div>
        </div>

        {/* Sparkline Chart */}
        <div className="mb-3 sm:mb-4 h-10 sm:h-12">
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
        <div className="flex items-center gap-1 flex-wrap">
          {changeType === 'positive' ? (
            <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500 shrink-0" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-500 shrink-0" />
          )}
          <span
            className={cn(
              'text-xs sm:text-sm font-medium',
              changeType === 'positive' ? 'text-green-500' : 'text-red-500'
            )}
          >
            {change}
          </span>
          <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">vs período anterior</span>
        </div>
      </CardContent>
    </Card>
  );
}
