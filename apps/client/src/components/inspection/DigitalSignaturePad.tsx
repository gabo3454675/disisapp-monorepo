'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

interface DigitalSignaturePadProps {
  value?: string;
  onChange: (signatureDataUrl?: string) => void;
}

export function DigitalSignaturePad({ value, onChange }: DigitalSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(Boolean(value));

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPoint(event);
    drawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPoint(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange(undefined);
  };

  return (
    <div className="space-y-2">
      <div className="rounded-md border bg-background p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={240}
          className="h-36 w-full touch-none rounded border bg-white"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {hasDrawn || value ? 'Firma capturada' : 'Firma pendiente'}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          Limpiar firma
        </Button>
      </div>
    </div>
  );
}

