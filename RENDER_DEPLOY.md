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
