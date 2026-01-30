# ✅ Checklist de Build - Sistema de Facturación

## 🔧 Correcciones Aplicadas

### Backend (apps/server)
- ✅ **exceljs** agregado a `dependencies` (para importación de Excel)
- ✅ **tsx** agregado a `devDependencies` (para ejecutar seed)
- ✅ **prisma.seed** actualizado para usar `tsx` en lugar de `ts-node`
- ✅ Script `prisma:seed` ya usa `tsx prisma/seed.ts`

### Frontend (apps/client)
- ✅ **@radix-ui/react-progress** agregado a `dependencies` (para barra de progreso)
- ✅ **next-pwa** configurado correctamente
- ✅ **manifest.json** configurado con iconos
- ✅ Componente PWA Install Prompt implementado

## 📦 Dependencias a Instalar

Antes de hacer build, ejecuta:

```bash
# Desde la raíz del proyecto
pnpm install
```

Esto instalará:
- `exceljs` en el servidor
- `tsx` en el servidor
- `@radix-ui/react-progress` en el cliente

## 🏗️ Proceso de Build

### 1. Instalar Dependencias
```bash
pnpm install
```

### 2. Generar Prisma Client
```bash
cd apps/server
pnpm prisma:generate
```

### 3. Build del Backend
```bash
cd apps/server
pnpm build
```

### 4. Build del Frontend
```bash
cd apps/client
pnpm build
```

## ⚠️ Verificaciones Importantes

### Iconos PWA
Asegúrate de que existan estos archivos en `apps/client/public/`:
- `icon-192x192.png` (192x192 píxeles)
- `icon-512x512.png` (512x512 píxeles)

### Variables de Entorno
Verifica que tengas configurado:
- `.env` en `apps/server/` con las variables necesarias
- Base de datos PostgreSQL accesible

### Base de Datos
```bash
cd apps/server
pnpm prisma:migrate  # Si hay migraciones pendientes
pnpm seed           # Para poblar datos iniciales
```

## 🚀 Comandos de Desarrollo

### Backend
```bash
cd apps/server
pnpm start:dev
```

### Frontend
```bash
cd apps/client
pnpm dev
```

## 🐛 Solución de Problemas

### Error: Cannot find module 'exceljs'
```bash
cd apps/server
pnpm install exceljs
```

### Error: Cannot find module 'tsx'
```bash
cd apps/server
pnpm install -D tsx
```

### Error: Cannot find module '@radix-ui/react-progress'
```bash
cd apps/client
pnpm install @radix-ui/react-progress
```

### Error de Prisma
```bash
cd apps/server
pnpm prisma:generate
```

### Error de TypeScript
```bash
# Backend
cd apps/server
pnpm type-check

# Frontend
cd apps/client
pnpm type-check
```

## ✅ Verificación Final

Antes de deployar, verifica:

1. ✅ `pnpm install` ejecutado sin errores
2. ✅ `pnpm build` funciona en ambos proyectos
3. ✅ No hay errores de TypeScript (`pnpm type-check`)
4. ✅ Los iconos PWA existen
5. ✅ El seed se ejecuta correctamente
6. ✅ El servidor inicia sin errores
7. ✅ El cliente inicia sin errores
