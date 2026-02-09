export class SalesChartDayDto {
  date: string; // YYYY-MM-DD
  ventasUsd: number;
  ventasBs: number;
}

export class TopProductMarginDto {
  productId: number;
  productName: string;
  margin: number;
}

export class DashboardHealthDto {
  salesChartLastMonth: SalesChartDayDto[];
  topProductsByMargin: TopProductMarginDto[];
  ticketPromedio: number;
  crecimientoMensual: number; // porcentaje, ej. 12.5
  totalImpuestosAcumulados: number; // IVA/IGTF estimado del mes
}
