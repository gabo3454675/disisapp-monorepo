# 🔐 Credenciales de Ejemplo - Resumen Rápido

## ✅ Credenciales para Login

**Email:** `admin@example.com`  
**Password:** `admin123`

---

## 📝 Comandos Rápidos

```bash
# 1. Ir a la carpeta del servidor
cd apps/server

# 2. Ejecutar el seed (crea el usuario de ejemplo)
pnpm prisma:seed

# 3. Iniciar el servidor
pnpm start:dev
```

En otra terminal:

```bash
# 4. Ir a la carpeta del cliente
cd apps/client

# 5. Iniciar el frontend
pnpm dev
```

---

## 🎯 Qué hace el seed

El script de seed crea:
- ✅ Usuario: `admin@example.com` con password `admin123`
- ✅ Empresa: "Mi Empresa de Prueba"
- ✅ Asocia al usuario como OWNER de la empresa
- ✅ 2 Productos de ejemplo
- ✅ 1 Cliente de ejemplo

---

## ⚠️ Importante

Asegúrate de que:
1. PostgreSQL esté corriendo
2. La base de datos `facturacion_db` exista
3. Las migraciones estén ejecutadas (`pnpm prisma migrate dev`)

---

## 🔗 URLs

- **Frontend:** http://localhost:3000/login
- **Backend API:** http://localhost:3001/api
