/**
 * Servicio de conversión de moneda para el POS y facturación.
 * Usa la tasa configurada (BCV/Paralelo) para convertir USD ↔ BS.
 * Importante: El IVA 16% debe calcularse siempre sobre el monto ya convertido a BS.
 */

export type PaymentCurrency = 'BS' | 'USD';
export type ProductCurrency = 'USD' | 'VES';

/** Redondeo a 2 decimales (criterios SENIAT, evita objeciones). */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Convierte monto en USD a BS usando la tasa configurada.
 * Usar antes de aplicar IVA cuando el pago es en Bolívares.
 */
export function convertUsdToBs(amountUsd: number, exchangeRate: number): number {
  return round2(amountUsd * exchangeRate);
}

/**
 * Convierte monto en BS a USD usando la tasa configurada.
 */
export function convertBsToUsd(amountBs: number, exchangeRate: number): number {
  return round2(amountBs / exchangeRate);
}

/**
 * Obtiene el precio unitario en la moneda de pago.
 * - Pago en BS: si producto en USD → precio * tasa; si en VES → precio.
 * - Pago en USD: si producto en VES → precio / tasa; si en USD → precio.
 */
export function convertToPaymentCurrency(
  unitPrice: number,
  productCurrency: ProductCurrency,
  paymentCurrency: PaymentCurrency,
  exchangeRate: number
): number {
  if (paymentCurrency === 'BS') {
    return productCurrency === 'USD' ? round2(unitPrice * exchangeRate) : round2(unitPrice);
  }
  return productCurrency === 'VES' ? round2(unitPrice / exchangeRate) : round2(unitPrice);
}

/**
 * Calcula la base imponible en BS para IVA (solo ítems no exentos).
 * El IVA 16% debe aplicarse sobre este monto (ya en BS).
 */
export function getIvaBaseInBs(
  lineAmountsInBs: number[],
  isExempt: (index: number) => boolean
): number {
  const nonExemptSum = lineAmountsInBs.reduce(
    (sum, amount, i) => sum + (isExempt(i) ? 0 : amount),
    0
  );
  return round2(nonExemptSum);
}

/**
 * Calcula IVA 16% sobre la base en BS (redondeado a 2 decimales).
 * Solo debe usarse cuando el pago es en Bolívares; la base debe estar ya convertida a BS.
 */
export function calculateIvaOnBaseInBs(ivaBaseBs: number): number {
  return round2(ivaBaseBs * 0.16);
}

/**
 * Calcula total en BS: subtotal en BS + IVA (sobre base no exenta en BS).
 */
export function calculateTotalInBs(
  subtotalBs: number,
  ivaBaseBs: number
): number {
  const iva = calculateIvaOnBaseInBs(ivaBaseBs);
  const exemptSum = round2(subtotalBs - ivaBaseBs);
  return round2(ivaBaseBs * 1.16 + exemptSum);
}

/**
 * Calcula IGTF 3% sobre subtotal en USD (pago en divisas).
 */
export function calculateIgtfOnSubtotalUsd(subtotalUsd: number): number {
  return round2(subtotalUsd * 0.03);
}
