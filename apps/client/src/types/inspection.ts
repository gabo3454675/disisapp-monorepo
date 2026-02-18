export type DiagramView = 'frontal' | 'trasera' | 'lateral' | 'superior';
export type PinStatus = 'damaged' | 'repaired';

export interface DiagramPin {
  view: DiagramView;
  x: number; // 0-100
  y: number; // 0-100
  status: PinStatus;
}

export interface UsedPart {
  productId: number;
  quantity: number;
  productName?: string;
}

export interface InspectionPayload {
  diagramPins?: DiagramPin[];
  usedParts?: UsedPart[];
  vehicleInfo?: string;
  notes?: string;
}
