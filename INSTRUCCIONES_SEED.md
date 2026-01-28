# 🌱 Instrucciones para Crear Usuario de Ejemplo

## 📋 Credenciales de Ejemplo

Después de ejecutar el seed, usa estas credenciales:

- **Email:** `admin@example.com`
- **Password:** `admin123`

## 🚀 Pasos para Ejecutar el Seed

### 1. Asegúrate de que PostgreSQL esté corriendo
```bash
# Verifica que PostgreSQL esté activo
```

### 2. Verifica que la base de datos exista
Asegúrate de que la base de datos `facturacion_db` esté creada o cámbiala en el `.env`

### 3. Ejecuta las migraciones (si no lo has hecho)
```bash
cd apps/server
pnpm prisma migrate dev
```

### 4. Genera el Prisma Client
```bash
pnpm prisma:generate
```

### 5. Ejecuta el seed
```bash
pnpm prisma:seed
```

### 6. Verifica que todo funcionó
Deberías ver mensajes como:
```
🌱 Iniciando seed de base de datos...
✅ Usuario creado: admin@example.com
✅ Empresa creada: Mi Empresa de Prueba
✅ Membresía creada
✅ Producto 1 creado
✅ Producto 2 creado
✅ Cliente creado: Cliente Ejemplo
🎉 Seed completado exitosamente!
```

## 🧪 Probar el Login

1. Inicia el servidor:
```bash
cd apps/server
pnpm start:dev
```

2. Inicia el cliente:
```bash
cd apps/client
pnpm dev
```

3. Ve a `http://localhost:3000/login`
4. Usa las credenciales:
   - Email: `admin@example.com`
   - Password: `admin123`

## 🔄 Si necesitas recrear los datos

Simplemente vuelve a ejecutar:
```bash
pnpm prisma:seed
```

El script usa `upsert` y `findFirst` para evitar duplicados, así que puedes ejecutarlo múltiples veces sin problemas.
