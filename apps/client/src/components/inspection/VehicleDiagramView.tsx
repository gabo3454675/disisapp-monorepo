'use client';
import { cn } from '@/lib/utils';
import type { DiagramPin, DiagramView, PinStatus } from '@/types/inspection';

const VIEWS: { id: DiagramView; label: string }[] = [
  { id: 'frontal', label: 'Frontal' },
  { id: 'trasera', label: 'Trasera' },
  { id: 'lateral', label: 'Lateral' },
  { id: 'superior', label: 'Superior' },
];

interface VehicleDiagramViewProps {
  pins: DiagramPin[];
  onAddPin: (view: DiagramView, x: number, y: number, status: PinStatus) => void;
  pinMode: PinStatus;
  activeView: DiagramView;
  onViewChange: (view: DiagramView) => void;
  /** Ref para captura en PDF */
  diagramRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

export function VehicleDiagramView({
  pins,
  onAddPin,
  pinMode,
  activeView,
  onViewChange,
  diagramRef,
  className,
}: VehicleDiagramViewProps) {
  const handleDiagramClick = (e: React.MouseEvent<HTMLDivElement>, view: DiagramView) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onAddPin(view, Math.min(100, Math.max(0, x)), Math.min(100, Math.max(0, y)), pinMode);
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onViewChange(v.id)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              activeView === v.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div
        ref={diagramRef}
        className="relative w-full aspect-[4/3] max-w-lg mx-auto border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/30 overflow-hidden"
      >
        {/* Área clickeable por vista */}
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => handleDiagramClick(e, activeView)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
          }}
          className="absolute inset-0 cursor-crosshair flex items-center justify-center"
          title="Haz clic para colocar un pin"
        >
          {/* Silueta simple del vehículo según vista (placeholder) */}
          <div className="w-3/4 h-2/3 rounded-lg border-2 border-muted-foreground/50 bg-background/50 flex items-center justify-center text-muted-foreground text-sm">
            Vista {VIEWS.find((v) => v.id === activeView)?.label}
          </div>
        </div>

        {/* Pins de esta vista */}
        {pins
          .filter((p) => p.view === activeView)
          .map((pin, i) => (
            <div
              key={`${pin.view}-${pin.x}-${pin.y}-${i}`}
              className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-white shadow pointer-events-none"
              style={{
                left: `${pin.x}%`,
                top: `${pin.y}%`,
                backgroundColor: pin.status === 'damaged' ? '#dc2626' : '#16a34a',
              }}
              title={pin.status === 'damaged' ? 'Dañado' : 'Reparado'}
            />
          ))}
      </div>
    </div>
  );
}
