# 🌱 CÓMO EJECUTAR EL SEED - Guía Paso a Paso

## 📍 Dónde ejecutar el comando

**Debes estar en la carpeta del servidor:**
```
C:\Users\glong\Desktop\PROYECTO FACTURACION\apps\server
```

## 🚀 Pasos Detallados

### Paso 1: Abre una terminal y navega a la carpeta del servidor

```powershell
cd "C:\Users\glong\Desktop\PROYECTO FACTURACION\apps\server"
```

### Paso 2: Ejecuta el seed

```powershell
pnpm prisma:seed
```

### Paso 3: Espera a que termine

Deberías ver algo como esto:

```
🌱 Iniciando seed de base de datos...
✅ Usuario creado: admin@example.com
✅ Empresa creada: Mi Empresa de Prueba
✅ Membresía creada
✅ Producto 1 creado
✅ Producto 2 creado
✅ Cliente creado: Cliente Ejemplo

🎉 Seed completado exitosamente!

📋 Credenciales de acceso:
   Email: admin@example.com
   Password: admin123

💡 Puedes usar estas credenciales para hacer login.
```

## 🔐 Credenciales que se crean automáticamente

El seed crea un usuario con estas credenciales:

- **Email:** `admin@example.com`
- **Password:** `admin123`

**¡NO necesitas crearlas manualmente!** El script las crea automáticamente.

## ✅ Verificación

Si el seed funcionó correctamente, ya puedes hacer login en tu aplicación con:
- Email: `admin@example.com`
- Password: `admin123`

## ⚠️ Si hay errores

### Error: "Cannot find module"
Ejecuta primero:
```powershell
pnpm install
```

### Error: "Database connection"
Asegúrate de que:
1. PostgreSQL esté corriendo
2. La base de datos exista (o créala)
3. El archivo `.env` tenga la DATABASE_URL correcta

### Error: "No migrations found"
Ejecuta primero:
```powershell
pnpm prisma migrate dev
```

## 🔄 Re-ejecutar el seed

Puedes ejecutar el seed múltiples veces. El script usa `upsert`, así que actualiza los datos si ya existen en lugar de crear duplicados.

```powershell
pnpm prisma:seed
```
