import type { DiagramPin } from './inspection';

export const DAVEAN_TENANT_SLUG = 'davean' as const;
export const DAVEAN_TEMPLATE_VERSION = 'davean-vehicle-inspection-v1' as const;

export type InspectionStage = 'INGRESO' | 'INSPECCION' | 'SALIDA';
export type CheckSiNo = 'SI' | 'NO' | 'N/A';

export interface DaveanTenantScope {
  organizationSlug: typeof DAVEAN_TENANT_SLUG;
  exclusiveTemplate: true;
}

export interface DaveanIngresoState {
  datosCliente: {
    cliente?: string;
    telefono?: string;
    direccion?: string;
    rifCi?: string;
  };
  vehiculo: {
    marca?: string;
    modelo?: string;
    anio?: number;
    placa?: string;
    color?: string;
  };
  recepcion: {
    fechaIngreso?: string;
    numeroControl?: string;
    tecnico?: string;
    kilometrajeIngreso?: number;
  };
  serviciosSolicitados: Array<{
    concepto: string;
    precioUnitario?: number;
    precio?: number;
  }>;
}

export interface DaveanInspeccionState {
  accesoriosInternos: {
    cauchoRepuesto?: CheckSiNo;
    gatoHidraulicoOMecanico?: CheckSiNo;
    triangulo?: CheckSiNo;
    llaveCruz?: CheckSiNo;
    reproductor?: CheckSiNo;
    pantallaDvd?: CheckSiNo;
    pendrive?: CheckSiNo;
    cargador?: CheckSiNo;
    cornetas?: CheckSiNo;
    plantas?: CheckSiNo;
    antena?: CheckSiNo;
    cenicera?: CheckSiNo;
    tapaSol?: CheckSiNo;
    retrovisorInterno?: CheckSiNo;
    cablesAuxiliares?: CheckSiNo;
    alfombras?: CheckSiNo;
  };
  checklistLucesYExterior: {
    claxonBocina?: CheckSiNo;
    limpiaParabrisas?: CheckSiNo;
    lucesBajas?: CheckSiNo;
    lucesAltas?: CheckSiNo;
    luzIntermitente?: CheckSiNo;
    direccionalIzquierda?: CheckSiNo;
    direccionalDerecha?: CheckSiNo;
    luzFreno?: CheckSiNo;
    luzPequenaStopFaros?: CheckSiNo;
    carelosNeblineros?: CheckSiNo;
    farosAdicionales?: CheckSiNo;
    centroRines?: CheckSiNo;
    tapaGusanillos?: CheckSiNo;
    tasasRines?: CheckSiNo;
    tapaGasolina?: CheckSiNo;
    emblemasCompletos?: CheckSiNo;
    placas?: CheckSiNo;
    alarmaControl?: CheckSiNo;
  };
  danosVehiculo: DiagramPin[];
  observacionesInspeccion?: string;
}

export interface DaveanSalidaState {
  fechaSalida?: string;
  kilometrajeSalida?: number;
  recibidoPor?: string;
  conformidadCliente?: boolean;
  firmaClienteNombre?: string;
}

export interface DaveanVehicleInspectionPayload {
  tenant: DaveanTenantScope;
  templateVersion: typeof DAVEAN_TEMPLATE_VERSION;
  estadoActual: InspectionStage;
  ingreso: DaveanIngresoState;
  inspeccion: DaveanInspeccionState;
  salida: DaveanSalidaState;
}

/**
 * Mapeo compatible con la tabla VehicleInspection actual:
 * - tenantId: se resuelve por organizationSlug = davean
 * - vehicleInfo: resumen de ingreso
 * - diagramPins: inspeccion.danosVehiculo
 * - notes: resumen de inspeccion/salida
 */
export interface DaveanVehicleInspectionPersistenceAdapterInput {
  tenantId: number;
  vehicleInfo: string;
  diagramPins: DiagramPin[];
  notes?: string;
}

