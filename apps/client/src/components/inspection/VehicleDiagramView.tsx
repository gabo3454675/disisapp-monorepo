'use client';
import { cn } from '@/lib/utils';
import type { DiagramPin, DiagramView, PinStatus } from '@/types/inspection';

/** Silueta del vehículo por vista (frontal, trasera, lateral, superior) para el diagrama Davean */
function VehicleSilhouette({ view }: { view: DiagramView }) {
  const w = 160;
  const h = 100;
  if (view === 'frontal') {
    return (
      <svg width="70%" height="70%" viewBox="0 0 120 160" className="text-muted-foreground/70" fill="currentColor">
        <rect x="20" y="30" width="80" height="100" rx="8" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="35" cy="50" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="85" cy="50" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
        <rect x="45" y="70" width="30" height="40" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    );
  }
  if (view === 'trasera') {
    return (
      <svg width="70%" height="70%" viewBox="0 0 120 160" className="text-muted-foreground/70" fill="currentColor">
        <rect x="20" y="30" width="80" height="100" rx="8" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="35" cy="50" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="85" cy="50" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
        <rect x="50" y="75" width="20" height="35" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    );
  }
  if (view === 'lateral') {
    return (
      <svg width="85%" height="70%" viewBox="0 0 200 120" className="text-muted-foreground/70" fill="currentColor">
        <path
          d="M 25 70 L 45 70 L 55 55 L 145 55 L 175 70 L 175 85 L 25 85 Z"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <circle cx="55" cy="88" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="145" cy="88" r="12" stroke="currentColor" strokeWidth="2" fill="none" />
        <rect x="70" y="58" width="50" height="25" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    );
  }
  if (view === 'superior') {
    return (
      <svg width="85%" height="70%" viewBox="0 0 200 120" className="text-muted-foreground/70" fill="currentColor">
        <rect x="25" y="25" width="150" height="70" rx="8" stroke="currentColor" strokeWidth="2" fill="none" />
        <rect x="70" y="35" width="60" height="50" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="50" cy="60" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <circle cx="150" cy="60" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    );
  }
  return null;
}

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
          {/* Silueta del vehículo según vista (diagrama Davean) */}
          <VehicleSilhouette view={activeView} />
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
