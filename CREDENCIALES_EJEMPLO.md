# 🔐 Credenciales de Ejemplo para Login

## Credenciales de Prueba

Para usar estas credenciales, primero debes ejecutar el seed de la base de datos:

```bash
cd apps/server
pnpm prisma:seed
```

### Usuario Administrador

- **Email:** `admin@example.com`
- **Password:** `admin123`
- **Rol:** OWNER
- **Empresa:** Mi Empresa de Prueba

## 📝 Pasos para Configurar

1. **Asegúrate de que PostgreSQL esté corriendo**
2. **Ejecuta las migraciones:**
   ```bash
   cd apps/server
   pnpm prisma migrate dev
   ```
3. **Ejecuta el seed:**
   ```bash
   pnpm prisma:seed
   ```
4. **Inicia el servidor:**
   ```bash
   pnpm start:dev
   ```
5. **Inicia el cliente:**
   ```bash
   cd ../client
   pnpm dev
   ```

## 🧪 Qué se crea con el seed

- ✅ Usuario: `admin@example.com`
- ✅ Empresa: "Mi Empresa de Prueba"
- ✅ Membresía: Usuario como OWNER de la empresa
- ✅ 2 Productos de ejemplo
- ✅ 1 Cliente de ejemplo

## 🔄 Si necesitas recrear los datos

Solo vuelve a ejecutar:
```bash
pnpm prisma:seed
```

El script usa `upsert`, así que si los datos ya existen, los actualiza en lugar de crear duplicados.
