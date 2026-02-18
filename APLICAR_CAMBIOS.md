# Cómo aplicar todos los cambios (Pasos 1–5)

Los archivos **sí están** en el repositorio. Si no los ves o la app no se comporta igual, sigue estos pasos en orden.

---

## 1. Asegurarte de estar en la carpeta correcta

Abre el monorepo desde la raíz:

```
c:\Users\glonga\Desktop\PROYECTO FACTURACION\disisapp-monorepo
```

En Cursor/VS Code: **File → Open Folder** y elige esa carpeta (no una subcarpeta).

---

## 2. Instalar dependencias

En la raíz del monorepo:

```bash
pnpm install
```

Esto instala dependencias de `apps/server`, `apps/client` y `apps/mobile`.

---

## 3. Base de datos (Prisma) – Paso 1

Si la migración ya se aplicó antes, no hace falta repetir. Si tienes una BD nueva o no corriste migraciones:

```bash
cd apps\server
npx prisma migrate deploy
npx prisma generate
cd ..\..
```

---

## 4. Backend (NestJS)

Reinicia el servidor para cargar los nuevos módulos:

```bash
cd apps\server
pnpm run dev
```

Deberías tener:

- JWT con `expiresIn: 365d` (auth.module.ts)
- `DELETE /api/inventory/clear` (Super Admin) – inventory.controller.ts
- `POST /api/inventory/movements` – inventory-movements.controller.ts
- `POST /api/vehicle-inspections` y `GET /api/vehicle-inspections` – vehicle-inspections

---

## 5. Frontend web (Next.js)

```bash
cd apps\client
pnpm run dev
```

En el menú lateral debe aparecer **"Inspección vehículo"** y la ruta `/inspections` con el diagrama, repuestos y export PDF.

---

## 6. App móvil (Expo) – Paso 5

```bash
cd apps\mobile
pnpm start
```

Sesión persistente con SecureStore; no expira por inactividad.

---

## Resumen de archivos creados/modificados

| Paso | Ubicación | Qué se hizo |
|------|-----------|-------------|
| 1 | `apps/server/prisma/schema.prisma` | Enum MovementType, tabla InventoryMovement, tabla VehicleInspection |
| 2 | `apps/server/src/modules/auth/auth.module.ts` | JWT expiresIn 365d |
| 2 | `apps/server/src/common/guards/super-admin.guard.ts` | **Nuevo** – Guard Super Admin global |
| 2 | `apps/server/src/modules/inventory/dto/clear-inventory.dto.ts` | **Nuevo** |
| 2 | `apps/server/src/modules/inventory/inventory.controller.ts` | DELETE clear + SuperAdminGuard |
| 2 | `apps/server/src/modules/inventory/inventory.service.ts` | clearByTenantId() |
| 3 | `apps/server/src/modules/inventory/dto/create-movement.dto.ts` | **Nuevo** |
| 3 | `apps/server/src/modules/inventory/inventory-movements.service.ts` | **Nuevo** |
| 3 | `apps/server/src/modules/inventory/inventory-movements.controller.ts` | **Nuevo** |
| 3 | `apps/server/src/modules/inventory/inventory.module.ts` | Registro de movimientos |
| 4 | `apps/server/src/modules/vehicle-inspections/*` | **Nuevo módulo** (controller, service, dto, module) |
| 4 | `apps/server/src/app.module.ts` | Import VehicleInspectionsModule |
| 4 | `apps/client/.../inspections/page.tsx` | **Nuevo** – Página inspección |
| 4 | `apps/client/src/components/inspection/VehicleDiagramView.tsx` | **Nuevo** |
| 4 | `apps/client/src/lib/exportInspectionPdf.ts` | **Nuevo** |
| 4 | `apps/client/src/types/inspection.ts` | **Nuevo** |
| 4 | `apps/client/package.json` | jspdf, html2canvas |
| 4 | `apps/client/.../sidebar.tsx` y `bottom-nav.tsx` | Enlace "Inspección vehículo" |
| 5 | `apps/mobile/*` | **Nueva app Expo** – AuthProvider, SecureStore, Login, Home |

Si algo no aparece, revisa que la carpeta abierta sea **disisapp-monorepo** (raíz) y que no haya deshecho cambios (Ctrl+Z) o otra rama sin estos commits.
