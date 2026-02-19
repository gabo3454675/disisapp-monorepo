No hay configuración para Render en el repo. La guía actual es para EC2 + Vercel. Para **Render** puedes hacer lo siguiente:

---

## Desplegar el monorepo en Render

En Render sueles usar **dos Web Services**: uno para el **API (Nest)** y otro para el **frontend (Next.js)**. Opcionalmente, una **PostgreSQL** de Render.

---

### 1. Base de datos (recomendado)

- En el dashboard: **New → PostgreSQL**.
- Crear la base y anotar **Internal Database URL** (o **External** si algo fuera de Render la usa).
- Esa URL será tu **`DATABASE_URL`** para el backend.

---

### 2. Backend (NestJS) – Web Service

- **New → Web Service**, conectar el repo del monorepo.

Configuración sugerida:

| Campo | Valor |
|-------|--------|
| **Root Directory** | (dejar vacío = raíz del repo) |
| **Runtime** | Node |
| **Build Command** | `pnpm install && pnpm --filter @billing-system/server build` |
| **Start Command** | `cd apps/server && node dist/main.js` |

**Variables de entorno** (Environment):

- `NODE_ENV` = `production`
- `PORT` = lo define Render (no hace falta ponerlo a mano)
- `DATABASE_URL` = URL de la PostgreSQL de Render (Internal Database URL)
- `JWT_SECRET` = valor seguro (ej. `openssl rand -base64 32`)
- `JWT_EXPIRES_IN` = `24h`
- `FRONTEND_URL` = URL del frontend en Render (ej. `https://tu-app.onrender.com`) cuando la tengas
- `BASE_URL` = URL del propio backend (ej. `https://tu-api.onrender.com`)

Después del primer deploy, en el backend hay que aplicar migraciones. Puedes hacerlo en un **Background Worker** de Render o una vez por SSH/shell (Render no tiene “run command” como tal, pero puedes usar un **pre-deploy script** si lo soporta tu plan). Lo más simple: en **Build Command** añadir generación y migraciones:

```bash
pnpm install && pnpm --filter @billing-system/server build && cd apps/server && pnpm prisma generate && pnpm prisma migrate deploy
```

(Asumiendo que `prisma` está en dependencias del server; si no, usar `npx prisma`.)

Guarda y despliega. Anota la URL del servicio (ej. `https://tu-api.onrender.com`).

---

### 3. Frontend (Next.js) – Web Service

- **New → Web Service**, mismo repo.

| Campo | Valor |
|-------|--------|
| **Root Directory** | (vacío) |
| **Runtime** | Node |
| **Build Command** | `pnpm install && pnpm --filter @billing-system/client build` |
| **Start Command** | `cd apps/client && pnpm start` |

**Variables de entorno**:

- `NEXT_PUBLIC_API_URL` = URL del API **incluyendo** `/api` (ej. `https://tu-api.onrender.com/api`)

En Render, **PORT** lo asigna automáticamente. Si en `apps/client/package.json` el script es `next start -p 3003`, en producción es mejor usar el puerto de Render. Puedes dejar `next start` sin `-p` (Next usa `process.env.PORT`) o cambiar el script a algo como `next start -p $PORT` para que no falle en Render.

---

### 4. CORS en el backend

En `apps/server/src/main.ts`, en desarrollo se permiten `localhost:3000` y `3001`. En producción se usan `FRONTEND_URL` y una lista de dominios. Asegúrate de que la URL del frontend en Render (ej. `https://tu-app.onrender.com`) esté en los orígenes permitidos. Si usas `FRONTEND_URL` en el backend y la defines como la URL del Web Service del frontend, y en el código de CORS en producción se usa `frontendUrl`, con eso suele bastar.

---

### 5. Resumen de URLs

- Frontend en Render → `https://tu-app.onrender.com`
- Backend en Render → `https://tu-api.onrender.com` (las rutas del API son `https://tu-api.onrender.com/api/...`)
- En el frontend: `NEXT_PUBLIC_API_URL=https://tu-api.onrender.com/api`
- En el backend: `FRONTEND_URL=https://tu-app.onrender.com` y `BASE_URL=https://tu-api.onrender.com`

---

### 6. Opcional: Blueprint (`render.yaml`)

Puedes definir los dos servicios en un **Blueprint** en la raíz del repo para que Render cree ambos a partir del mismo repo. La estructura sería algo así (adaptando nombres y env a lo que uses):

```yaml
# render.yaml (en la raíz del repo)
services:
  - type: web
    name: disis-api
    runtime: node
    buildCommand: pnpm install && pnpm --filter @billing-system/server build && cd apps/server && npx prisma generate && npx prisma migrate deploy
    startCommand: cd apps/server && node dist/main.js
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: tu-db
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: NODE_ENV
        value: production
      # ... resto

  - type: web
    name: disis-client
    runtime: node
    buildCommand: pnpm install && pnpm --filter @billing-system/client build
    startCommand: cd apps/client && pnpm start
    envVars:
      - key: NEXT_PUBLIC_API_URL
        sync: false  # lo configuras a mano
```

La base de datos la creas aparte y la enlazas por nombre en el Blueprint.

---

Si quieres, en el siguiente paso podemos bajar esto a tu repo concreto: por ejemplo un `render.yaml` listo para copiar y pegar y los cambios exactos en `package.json` del client para el `start` en Render.