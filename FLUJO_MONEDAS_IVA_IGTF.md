# Flujo de monedas, IVA e IGTF (SENIAT)

Este documento fija las reglas de negocio para que Cursor y el equipo no se pierdan con Bolívares, IVA 16% e IGTF. **No cambiar la lógica sin revisar este flujo.**

---

## 1. Registro del producto (origen de la verdad)

- **El producto se guarda en la moneda que elija el usuario** al crear/editar: **USD** o **BS (VES)**.
- En base de datos:
  - `Product.salePrice`: número (ej. 10.50).
  - `Product.salePriceCurrency`: `"USD"` o `"VES"`.
- Si no se indica moneda (productos antiguos), se asume **USD** por defecto.

---

## 2. Conversión en tiempo real (POS)

Cuando en el POS el usuario elige **“Pagar en BS”** o **“Pagar en USD”**:

1. Se usa la **tasa del día** (`exchangeRate` de la organización = tasa BCV/Paralelo).
2. Para cada ítem del carrito:
   - **Precio unitario en moneda de pago**:
     - Si **pago en BS** y el producto está en **USD** → `precio_unidad * tasa_bcv` (convertir a Bolívares).
     - Si **pago en BS** y el producto está en **VES** → `precio_unidad` (ya está en BS).
     - Si **pago en USD** y el producto está en **VES** → `precio_unidad / tasa_bcv` (convertir a dólares).
     - Si **pago en USD** y el producto está en **USD** → `precio_unidad` (ya está en USD).
3. **Redondeo**: todos los montos se redondean a **2 decimales** (`Math.round(x * 100) / 100`) para evitar diferencias que el SENIAT pueda objetar.

---

## 3. IVA 16% (solo cuando se paga en BS)

- **Importante:** El **16% de IVA se calcula después de la conversión** a la moneda de pago (BS).
- Pasos:
  1. Convertir cada línea a BS con la tasa del día (como arriba).
  2. Subtotal en BS = suma de (precio unitario en BS × cantidad) por ítem, redondeado a 2 decimales.
  3. Base imponible IVA = solo la parte **no exenta** (productos con `isExempt === false`).
  4. IVA = 16% sobre esa base, **redondeado a 2 decimales**.
  5. Total = subtotal (BS) + IVA; productos exentos no llevan IVA.

- Así se evitan errores de redondeo por convertir después de aplicar impuestos.

---

## 4. IGTF 3% (pago en divisas)

- Cuando el **pago final es en divisas (USD)**:
  - Se aplica **IGTF 3%** sobre el **total** (subtotal en USD ya convertido).
  - IGTF = subtotal × 0.03, redondeado a 2 decimales.
  - Total = subtotal + IGTF.

- Cuando el pago es en **BS**, no se aplica IGTF (sí IVA 16% como arriba).

---

## 5. Resumen rápido para Cursor

| Escenario              | Conversión                          | Impuesto      |
|------------------------|-------------------------------------|---------------|
| Pago en BS             | USD → BS: `precio × tasa_bcv`       | IVA 16% sobre base no exenta (después de convertir a BS) |
| Pago en BS             | Precio ya en VES                    | IVA 16% sobre base no exenta |
| Pago en USD (divisas)  | VES → USD: `precio / tasa_bcv`      | IGTF 3% sobre total |
| Pago en USD            | Precio ya en USD                    | IGTF 3% sobre total |

- **Siempre** redondear a 2 decimales en cada paso.
- **Nunca** calcular IVA antes de convertir a la moneda de pago (BS).

---

## 6. Servicio de conversión de moneda

- **Cliente:** `apps/client/src/lib/currencyConversion.ts`
  - `convertUsdToBs(amountUsd, exchangeRate)`: convierte USD → BS con la tasa configurada (usar antes de aplicar IVA).
  - `convertToPaymentCurrency(...)`: precio unitario en moneda de pago (BS o USD).
  - `getIvaBaseInBs`, `calculateIvaOnBaseInBs`, `calculateTotalInBs`: IVA 16% sobre monto ya en BS.
  - `calculateIgtfOnSubtotalUsd`: IGTF 3% cuando pago en USD.
- **Servidor:** `apps/server/src/common/helpers/currency.helper.ts`
  - `convertUsdToBs`, `convertBsToUsd`, `round2` para facturación y `credit_transactions` (amount_bs, exchange_rate).

## 7. Dónde está implementado

- **Producto (moneda de registro):** `Product.salePriceCurrency` en Prisma; formulario en `apps/client/.../products/page.tsx` (selector USD / BS).
- **Tasa del día:** `Organization.exchangeRate`; hook `useExchangeRate()` en el cliente; se actualiza en Configuración / Equipo.
- **POS (conversión + IVA/IGTF):** Usa `currencyConversion.ts`; el IVA se calcula siempre sobre el monto en BS (cuando el usuario selecciona pago en Bolívares).
