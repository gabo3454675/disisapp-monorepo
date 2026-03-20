'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import type { CheckSiNo, DaveanVehicleInspectionPayload, InspectionStage } from '@/types/davean-inspection';
import { DigitalSignaturePad } from './DigitalSignaturePad';
import { VehicleAnglesUploader, type VehicleAnglePhotoMap } from './VehicleAnglesUploader';

const QUICK_OPTIONS: CheckSiNo[] = ['SI', 'NO', 'N/A'];

const ACCESORIOS_KEYS = [
  ['cauchoRepuesto', 'Caucho de repuesto'],
  ['gatoHidraulicoOMecanico', 'Gato'],
  ['triangulo', 'Triángulo'],
  ['llaveCruz', 'Llave cruz'],
  ['reproductor', 'Reproductor'],
  ['pantallaDvd', 'Pantalla DVD'],
  ['pendrive', 'Pendrive'],
  ['cargador', 'Cargador'],
  ['cornetas', 'Cornetas'],
] as const;

const EXTERIOR_KEYS = [
  ['claxonBocina', 'Claxon'],
  ['limpiaParabrisas', 'Limpia parabrisas'],
  ['lucesBajas', 'Luces bajas'],
  ['lucesAltas', 'Luces altas'],
  ['luzIntermitente', 'Intermitente'],
  ['direccionalIzquierda', 'Direccional izq.'],
  ['direccionalDerecha', 'Direccional der.'],
  ['luzFreno', 'Luz freno'],
  ['placas', 'Placas'],
  ['alarmaControl', 'Alarma'],
] as const;

interface DaveanInspectionMobileFormProps {
  value: DaveanVehicleInspectionPayload;
  signature?: string;
  photos: VehicleAnglePhotoMap;
  onSignatureChange: (signatureDataUrl?: string) => void;
  onPhotosChange: (photos: VehicleAnglePhotoMap) => void;
  onChange: (next: DaveanVehicleInspectionPayload) => void;
}

export function DaveanInspectionMobileForm({
  value,
  signature,
  photos,
  onSignatureChange,
  onPhotosChange,
  onChange,
}: DaveanInspectionMobileFormProps) {
  const setStage = (stage: InspectionStage) => onChange({ ...value, estadoActual: stage });

  const setIngreso = (path: string, val: string | number) => {
    const next = structuredClone(value);
    const parts = path.split('.');
    let current: Record<string, unknown> = next.ingreso as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = val;
    onChange(next);
  };

  const setChecklist = (
    section: 'accesoriosInternos' | 'checklistLucesYExterior',
    key: string,
    val: CheckSiNo
  ) => {
    onChange({
      ...value,
      inspeccion: {
        ...value.inspeccion,
        [section]: {
          ...value.inspeccion[section],
          [key]: val,
        },
      },
    });
  };

  const setSalida = (key: keyof DaveanVehicleInspectionPayload['salida'], val: string | number | boolean) =>
    onChange({
      ...value,
      salida: { ...value.salida, [key]: val },
    });

  const OptionButtons = ({
    selected,
    onPick,
  }: {
    selected?: CheckSiNo;
    onPick: (value: CheckSiNo) => void;
  }) => (
    <div className="grid w-full grid-cols-3 gap-1 sm:max-w-[240px]">
      {QUICK_OPTIONS.map((option) => (
        <Button
          key={option}
          type="button"
          variant={selected === option ? 'default' : 'outline'}
          size="sm"
          onClick={() => onPick(option)}
          className="text-xs"
        >
          {option}
        </Button>
      ))}
    </div>
  );

  return (
    <Tabs value={value.estadoActual} onValueChange={(s) => setStage(s as InspectionStage)}>
      <TabsList className="grid h-auto w-full grid-cols-3">
        <TabsTrigger value="INGRESO">Ingreso</TabsTrigger>
        <TabsTrigger value="INSPECCION">Inspección</TabsTrigger>
        <TabsTrigger value="SALIDA">Salida</TabsTrigger>
      </TabsList>

      <TabsContent value="INGRESO" className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Cliente</Label>
            <Input value={value.ingreso.datosCliente.cliente ?? ''} onChange={(e) => setIngreso('datosCliente.cliente', e.target.value)} />
          </div>
          <div>
            <Label>Placa</Label>
            <Input value={value.ingreso.vehiculo.placa ?? ''} onChange={(e) => setIngreso('vehiculo.placa', e.target.value)} />
          </div>
          <div>
            <Label>Kilometraje</Label>
            <Input
              type="number"
              min={0}
              value={value.ingreso.recepcion.kilometrajeIngreso ?? ''}
              onChange={(e) => setIngreso('recepcion.kilometrajeIngreso', Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label>Marca</Label>
            <Input value={value.ingreso.vehiculo.marca ?? ''} onChange={(e) => setIngreso('vehiculo.marca', e.target.value)} />
          </div>
          <div>
            <Label>Modelo</Label>
            <Input value={value.ingreso.vehiculo.modelo ?? ''} onChange={(e) => setIngreso('vehiculo.modelo', e.target.value)} />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="INSPECCION" className="space-y-4">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="space-y-2 rounded-lg border p-3 md:p-4">
            <h3 className="text-sm font-semibold">Inventario interno (rápido)</h3>
            <div className="space-y-2">
              {ACCESORIOS_KEYS.map(([key, label]) => (
                <div key={key} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto]">
                  <p className="text-sm">{label}</p>
                  <OptionButtons
                    selected={value.inspeccion.accesoriosInternos[key]}
                    onPick={(val) => setChecklist('accesoriosInternos', key, val)}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2 rounded-lg border p-3 md:p-4">
            <h3 className="text-sm font-semibold">Luces y exterior</h3>
            <div className="space-y-2">
              {EXTERIOR_KEYS.map(([key, label]) => (
                <div key={key} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_auto]">
                  <p className="text-sm">{label}</p>
                  <OptionButtons
                    selected={value.inspeccion.checklistLucesYExterior[key]}
                    onPick={(val) => setChecklist('checklistLucesYExterior', key, val)}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      </TabsContent>

      <TabsContent value="SALIDA" className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Label>Km salida</Label>
            <Input
              type="number"
              min={0}
              value={value.salida.kilometrajeSalida ?? ''}
              onChange={(e) => setSalida('kilometrajeSalida', Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label>Recibido por</Label>
            <Input value={value.salida.recibidoPor ?? ''} onChange={(e) => setSalida('recibidoPor', e.target.value)} />
          </div>
        </div>

        <div className="space-y-2 rounded-lg border p-3 md:p-4">
          <h3 className="text-sm font-semibold">Fotos (4 ángulos)</h3>
          <VehicleAnglesUploader value={photos} onChange={onPhotosChange} />
        </div>

        <div className="space-y-2 rounded-lg border p-3 md:p-4">
          <h3 className="text-sm font-semibold">Firma digital del cliente</h3>
          <DigitalSignaturePad value={signature} onChange={onSignatureChange} />
        </div>
      </TabsContent>
    </Tabs>
  );
}

