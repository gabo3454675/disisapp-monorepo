# Despliegue en Render (disis monorepo)

## Errores frecuentes: "Cannot POST /auth/login" y 404 al recargar

### 1. Backend (Web Service NestJS)

- **Build:** `pnpm install && pnpm run build` (desde la raíz del monorepo o desde `apps/server` según tu configuración).
- **Start:** `node dist/main.js` (o `pnpm run start:prod` desde `apps/server`).

**Variables de entorno obligatorias en Render:**

| Variable        | Ejemplo / descripción |
|----------------|------------------------|
| `DATABASE_URL` | URL de PostgreSQL (ej. Neon). |
| `JWT_SECRET`   | Clave secreta para JWT. |
| `FRONTEND_URL` | **URL pública del frontend**, ej. `https://disis-monorepo-frontend-glkl.onrender.com`. Necesaria para CORS y que el login funcione desde el navegador. |

Si `FRONTEND_URL` no apunta a tu front en Render, el backend puede rechazar las peticiones por CORS.

### 2. Frontend (Web Service Next.js)

- **Build:** desde la raíz del monorepo o desde `apps/client`: `pnpm install && pnpm run build`.  
  **Importante:** durante el build debe existir la variable `NEXT_PUBLIC_API_URL`.
- **Start:** `pnpm run start` (o `next start -p 3003` desde `apps/client`).

**Variable de entorno obligatoria en Render:**

| Variable                 | Ejemplo / descripción |
|-------------------------|------------------------|
| `NEXT_PUBLIC_API_URL`   | **URL base del API**, con prefijo `/api`. Ejemplo: `https://disis-monorepo-backend.onrender.com/api` (sustituir por la URL real de tu backend en Render). |

Si `NEXT_PUBLIC_API_URL` no está definida en el **momento del build**, el frontend queda compilado con `http://localhost:3001/api` y en producción el navegador intentará llamar al backend en localhost, lo que produce **"Cannot POST /auth/login"** (o 404).  
En Render, añade esta variable en **Environment** del servicio frontend **antes** del primer build.

### 3. Rutas y 404 al recargar

Este proyecto usa **Next.js** con `next start`, no un servidor estático con Express. Las rutas las gestiona Next; no hace falta un catch-all a `index.html`.  
Si ves 404 al recargar:

- Asegúrate de que el servicio frontend en Render está configurado como **Web Service** (no Static Site).
- Comando de inicio debe ser el que ejecuta el servidor Next (por ejemplo `pnpm run start` o `next start`).

### Resumen rápido

| Servicio  | Variable clave           | Valor ejemplo |
|-----------|--------------------------|----------------|
| Backend   | `FRONTEND_URL`           | `https://disis-monorepo-frontend-glkl.onrender.com` |
| Frontend  | `NEXT_PUBLIC_API_URL`    | `https://<tu-backend>.onrender.com/api` |

Después de cambiar `NEXT_PUBLIC_API_URL` en el frontend, hay que **volver a hacer deploy** (rebuild) para que el cambio se aplique.

---

## 4. Módulo `disis-monolith` (Web Service aparte)

El backend principal (`apps/server`) expone rutas bajo `/api/dispatch/*` que hacen **proxy** al servicio `disis-monolith`. Así el frontend y la app móvil solo usan **una URL**: `NEXT_PUBLIC_API_URL` / `EXPO_PUBLIC_API_URL`.

### Build (Render)

Desde la **raíz del monorepo** (Root Directory = repo):

```bash
pnpm install && pnpm --filter @billing-system/disis-monolith prisma:generate && pnpm --filter @billing-system/disis-monolith build
```

### Start

```bash
pnpm --filter @billing-system/disis-monolith start
```

### Variables obligatorias (`disis-monolith`)

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | **La misma** PostgreSQL que usa DISIS (Neon, etc.). No hace falta otra base aparte. |
| `NODE_ENV` | `production` |
| `DISIS_SERVER_URL` | URL del backend NestJS **con** `/api`, ej. `https://disisapp-monorepo-backend-ymda.onrender.com/api` (para sincronizar inventario cuando aplique). |

Tras cambiar el schema Prisma del monolith (ej. `idempotencyKey`), ejecuta migración contra esa misma DB antes o justo después del deploy.

---

## 5. Backend principal: variable `DISIS_MONOLITH_URL`

En el servicio **NestJS** (`apps/server`), añade:

| Variable | Ejemplo |
|----------|---------|
| `DISIS_MONOLITH_URL` | URL **base** del servicio `disis-monolith` en Render **sin** `/api` al final, ej. `https://disis-monolith-xxxx.onrender.com` |

Sin esto, las rutas `/api/dispatch/*` responderán **502** al intentar hacer proxy.

---

## 6. Checklist antes de subir a producción

1. **Backend:** `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `DISIS_MONOLITH_URL`.
2. **Frontend:** `NEXT_PUBLIC_API_URL` definida **antes** del build.
3. **Mobile (EAS/Expo):** `EXPO_PUBLIC_API_URL` = misma base que el backend `/api`.
4. **disis-monolith:** `DATABASE_URL` (misma que DISIS), `DISIS_SERVER_URL` apuntando al backend público.
5. Migraciones Prisma del monolith aplicadas si hay cambios de schema.
6. Volver a desplegar frontend si cambias `NEXT_PUBLIC_*`.

---

## 7. Smoke tests (después del deploy)

### Opción A: script del monorepo

```bash
# Por defecto usa el backend de ejemplo; cambia con variable de entorno:
set SMOKE_API_URL=https://disisapp-monorepo-backend-ymda.onrender.com/api
pnpm smoke:prod
```

### Opción B: curl (PowerShell o bash)

```bash
curl -sS "https://disisapp-monorepo-backend-ymda.onrender.com/api/health"
```

```bash
curl -sS -X POST "https://disisapp-monorepo-backend-ymda.onrender.com/api/dispatch/search-by-national-id" ^
  -H "Content-Type: application/json" ^
  -d "{\"companyId\":\"company_a\",\"nationalId\":\"V12345678\"}"
```

- `GET /api/health` debe responder **200**.
- El POST puede devolver **400** si ese cliente no existe en la DB; **502** indica proxy roto → revisar `DISIS_MONOLITH_URL` y que `disis-monolith` esté levantado.

---

## Resumen de URLs (un solo API para cliente/móvil)

| App | Variable | Valor típico |
|-----|----------|--------------|
| Web | `NEXT_PUBLIC_API_URL` | `https://<backend>.onrender.com/api` |
| Mobile | `EXPO_PUBLIC_API_URL` | Igual que arriba |

No hace falta `NEXT_PUBLIC_DISIS_MONOLITH_URL` ni `EXPO_PUBLIC_DISIS_MONOLITH_URL`: todo pasa por el backend DISIS.
