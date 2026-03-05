# Sistema de Facturación Multi-tenant SaaS B2B

Monorepo para un sistema de facturación multi-empresa construido con tecnologías modernas.

## 🏗️ Estructura del Proyecto

```
.
├── apps/
│   ├── client/          # Frontend Next.js 14 (App Router)
│   └── server/          # Backend NestJS (Clean Architecture)
├── packages/
│   └── shared/          # Tipos TypeScript compartidos
├── package.json         # Configuración raíz del monorepo
└── pnpm-workspace.yaml  # Configuración de workspaces
```

## 🚀 Stack Tecnológico

### Backend (`apps/server`)
- **Framework**: NestJS con Clean Architecture
- **Base de Datos**: PostgreSQL
- **ORM**: Prisma
- **Autenticación**: JWT (Passport)
- **Multi-tenant**: Arquitectura preparada con `tenant_id`

### Frontend (`apps/client`)
- **Framework**: Next.js 14+ (App Router)
- **Estilos**: Tailwind CSS (Mobile-First)
- **Componentes**: Shadcn/ui
- **Estado**: Zustand
- **PWA**: next-pwa

### Compartido (`packages/shared`)
- Tipos TypeScript compartidos entre frontend y backend

## 📦 Instalación

1. **Instalar pnpm** (si no lo tienes):
```bash
npm install -g pnpm
```

2. **Instalar dependencias**:
```bash
pnpm install
```

3. **Configurar variables de entorno** (necesario para el primer arranque):

   Cada app incluye un `.env.example` con todas las variables y comentarios. Cópialo a `.env` (server) o `.env.local` (client) y completa los valores.

   **Backend** (`apps/server`):
   ```bash
   cp .env.example .env
   ```
   Edita `.env` y define al menos: `DATABASE_URL`, `JWT_SECRET`. El resto tiene valores por defecto o es opcional (S3, Firebase, etc.). Ver comentarios en `.env.example`.

   **Frontend** (`apps/client`):
   ```bash
   cp .env.example .env.local
   ```
   Edita `.env.local` y define `NEXT_PUBLIC_API_URL` (ej: `http://localhost:3001/api`). Ver `.env.example` para la descripción de cada variable.

4. **Configurar base de datos**:
```bash
cd apps/server
pnpm prisma generate
pnpm prisma migrate dev
```

## 🛠️ Scripts Disponibles

### Desde la raíz:
- `pnpm dev` - Inicia desarrollo de todos los workspaces
- `pnpm build` - Construye todos los proyectos
- `pnpm lint` - Ejecuta linter en todos los proyectos
- `pnpm type-check` - Verifica tipos TypeScript

### Backend (`apps/server`):
- `pnpm dev` - Inicia servidor en modo desarrollo
- `pnpm prisma:generate` - Genera Prisma Client
- `pnpm prisma:migrate` - Ejecuta migraciones
- `pnpm prisma:studio` - Abre Prisma Studio

### Frontend (`apps/client`):
- `pnpm dev` - Inicia servidor de desarrollo (puerto 3000)
- `pnpm build` - Construye para producción
- `pnpm start` - Inicia servidor de producción

## ⚙️ Configuración inicial

Los archivos **`.env.example`** en `apps/server` y `apps/client` son la referencia para la configuración inicial. Incluyen todas las variables usadas por cada app y comentarios sobre su uso (base de datos, JWT, CORS, S3, Firebase, etc.). Sin copiarlos y completar los valores mínimos, el servidor y el client no podrán arrancar correctamente.

## 📁 Módulos del Backend

- **Auth**: Autenticación JWT y estrategias Passport
- **Tenants**: Gestión de empresas (multi-tenant)
- **Customers**: Gestión de clientes
- **Invoices**: Gestión de facturas
- **Inventory**: Gestión de inventario

## 🎨 Layouts del Frontend

- **`(auth)`**: Layout para páginas de autenticación
- **`(dashboard)`**: Layout para la aplicación principal

## 🔐 Autenticación Multi-tenant

El sistema está preparado para manejar multi-tenancy mediante:
- Decorador `@TenantId()` para extraer tenant del request
- Guard `JwtAuthGuard` que valida JWT y extrae información del tenant
- Schema de Prisma con `tenantId` en todas las entidades relevantes

## 📝 Próximos Pasos

1. Implementar lógica de negocio en los servicios
2. Crear DTOs y validaciones
3. Desarrollar componentes UI con Shadcn/ui
4. Implementar formularios y vistas completas
5. Configurar tests (unitarios e E2E)

## 📄 Licencia

UNLICENSED
