'use client';

import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/store/useThemeStore';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  /** Para sidebar colapsado: solo icono. Para menú móvil: fila completa con etiqueta. */
  variant?: 'compact' | 'full';
  className?: string;
}

export function ThemeToggle({ variant = 'compact', className }: ThemeToggleProps) {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = theme === 'dark';

  if (variant === 'full') {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 w-full rounded-lg border border-border bg-card px-3 py-2.5 min-h-[44px]',
          className
        )}
      >
        <div className="flex items-center gap-3">
          {isDark ? (
            <Moon className="h-5 w-5 text-muted-foreground" aria-hidden />
          ) : (
            <Sun className="h-5 w-5 text-muted-foreground" aria-hidden />
          )}
          <span className="text-sm font-medium text-foreground">Modo oscuro</span>
        </div>
        <Switch
          checked={isDark}
          onCheckedChange={() => toggleTheme()}
          aria-label="Alternar modo oscuro"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 shrink-0',
        className
      )}
    >
      <Sun className="h-4 w-4 text-muted-foreground dark:hidden" aria-hidden />
      <Moon className="h-4 w-4 text-muted-foreground hidden dark:block" aria-hidden />
      <Switch
        checked={isDark}
        onCheckedChange={() => toggleTheme()}
        aria-label="Alternar modo oscuro"
        className="shrink-0"
      />
    </div>
  );
}
