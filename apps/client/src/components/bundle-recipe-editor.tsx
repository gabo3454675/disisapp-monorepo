'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Layers, Search, Trash2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RecipeLine = { productId: number; quantity: number };

export type RecipeCatalogItem = {
  id: number;
  name: string;
  sku?: string | null;
  isBundle?: boolean;
};

type Props = {
  value: RecipeLine[];
  onChange: (v: RecipeLine[]) => void;
  catalog: RecipeCatalogItem[];
  /** Producto que se está editando (no puede ser componente de sí mismo) */
  excludeProductId?: number | null;
  variant: 'combo' | 'service';
  className?: string;
};

export function parseRecipeFromUnknown(raw: unknown): RecipeLine[] {
  if (!Array.isArray(raw)) return [];
  const out: RecipeLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as { productId?: unknown; quantity?: unknown };
    const productId = Number(o.productId);
    const quantity = Number(o.quantity);
    if (!Number.isFinite(productId) || productId <= 0) continue;
    if (!Number.isFinite(quantity) || quantity < 1) continue;
    out.push({ productId, quantity: Math.max(1, Math.floor(quantity)) });
  }
  return out;
}

export function BundleRecipeEditor({
  value,
  onChange,
  catalog,
  excludeProductId,
  variant,
  className,
}: Props) {
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const eligible = useMemo(() => {
    return catalog.filter((p) => p.id !== excludeProductId && !p.isBundle);
  }, [catalog, excludeProductId]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? eligible.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.sku && String(p.sku).toLowerCase().includes(q)),
        )
      : eligible;
    return base.slice(0, 25);
  }, [eligible, query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const usedIds = new Set(value.map((l) => l.productId));

  const addLine = (productId: number) => {
    if (usedIds.has(productId)) {
      onChange(
        value.map((l) =>
          l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l,
        ),
      );
    } else {
      onChange([...value, { productId, quantity: 1 }]);
    }
    setQuery('');
    setMenuOpen(false);
  };

  const updateQty = (productId: number, quantity: number) => {
    const q = Math.max(1, Math.floor(Number(quantity)) || 1);
    onChange(value.map((l) => (l.productId === productId ? { ...l, quantity: q } : l)));
  };

  const removeLine = (productId: number) => {
    onChange(value.filter((l) => l.productId !== productId));
  };

  const nameOf = (id: number) => catalog.find((p) => p.id === id)?.name ?? `Producto #${id}`;

  return (
    <div
      ref={wrapRef}
      className={cn(
        'rounded-xl border border-primary/15 bg-gradient-to-br from-muted/40 via-background to-muted/20 p-4 shadow-sm space-y-4',
        className,
      )}
    >
      <div className="flex gap-3">
        <div className="shrink-0 rounded-xl bg-primary/12 p-2.5 text-primary ring-1 ring-primary/20">
          <Layers className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">
            {variant === 'combo' ? '¿Qué incluye este combo?' : '¿Qué insumos se descuentan?'}
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {variant === 'combo'
              ? 'Busca cada producto del inventario y define cuántas unidades entran por cada paquete vendido. El cliente paga el precio del combo que pusiste arriba.'
              : 'Opcional: vincula productos reales (hielo, jugos, botellas…). Si no añades nada, solo se cobra el servicio sin mover inventario.'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {value.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/35 bg-background/40 py-10 px-4 text-center">
            <Package className="h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground max-w-sm">
              {variant === 'combo'
                ? 'Añade al menos un producto para que el combo sea válido.'
                : 'Sin insumos: al vender solo registrarás el cobro del servicio.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {value.map((line) => (
              <li
                key={line.productId}
                className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/80 px-3 py-2.5 shadow-sm"
              >
                <span className="flex-1 min-w-[160px] text-sm font-medium leading-snug">
                  {nameOf(line.productId)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Cant.</span>
                  <Input
                    type="number"
                    min={1}
                    className="h-9 w-[72px] text-center tabular-nums"
                    value={line.quantity}
                    onChange={(e) => updateQty(line.productId, parseInt(e.target.value, 10))}
                  />
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    / {variant === 'combo' ? 'combo' : 'venta'}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeLine(line.productId)}
                  aria-label="Quitar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-medium flex items-center gap-1.5 text-foreground/90">
          <Search className="h-3.5 w-3.5" />
          Buscar en inventario y añadir
        </Label>
        <div className="relative">
          <Input
            placeholder="Escribe nombre o SKU…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setMenuOpen(true);
            }}
            onFocus={() => setMenuOpen(true)}
            autoComplete="off"
          />
          {menuOpen && suggestions.length > 0 && (
            <ul
              className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-lg"
              role="listbox"
            >
              {suggestions.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-accent focus:bg-accent outline-none"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addLine(p.id)}
                  >
                    <span className="font-medium line-clamp-2">{p.name}</span>
                    {p.sku ? (
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{p.sku}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {menuOpen && query.trim() && suggestions.length === 0 && (
            <p className="absolute z-50 mt-1 w-full rounded-md border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-md">
              No hay coincidencias. Prueba otro nombre o SKU.
            </p>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Solo se listan productos sueltos del inventario (no otros combos). Si repites el mismo producto, se suma la
          cantidad.
        </p>
      </div>
    </div>
  );
}
