'use client';

import { Camera } from 'lucide-react';
import Image from 'next/image';

const ANGLES = [
  { key: 'frontal', label: 'Frontal' },
  { key: 'trasera', label: 'Trasera' },
  { key: 'lateralIzquierda', label: 'Lateral izq.' },
  { key: 'lateralDerecha', label: 'Lateral der.' },
] as const;

export type VehicleAngleKey = (typeof ANGLES)[number]['key'];

export type VehicleAnglePhotoMap = Partial<Record<VehicleAngleKey, File>>;

interface VehicleAnglesUploaderProps {
  value: VehicleAnglePhotoMap;
  onChange: (next: VehicleAnglePhotoMap) => void;
}

export function VehicleAnglesUploader({ value, onChange }: VehicleAnglesUploaderProps) {
  const setFile = (key: VehicleAngleKey, file?: File) => {
    const next = { ...value };
    if (!file) {
      delete next[key];
    } else {
      next[key] = file;
    }
    onChange(next);
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {ANGLES.map((angle) => {
        const file = value[angle.key];
        const previewUrl = file ? URL.createObjectURL(file) : null;
        return (
          <label key={angle.key} className="rounded-lg border bg-background p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Camera className="h-4 w-4" />
              {angle.label}
            </div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="mb-2 block w-full text-xs"
              onChange={(e) => setFile(angle.key, e.target.files?.[0])}
            />
            {previewUrl ? (
              <Image
                src={previewUrl}
                alt={`Foto ${angle.label}`}
                width={480}
                height={224}
                unoptimized
                className="h-28 w-full rounded object-cover"
              />
            ) : (
              <div className="flex h-28 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                Sin foto
              </div>
            )}
          </label>
        );
      })}
    </div>
  );
}

