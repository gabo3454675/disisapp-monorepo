# Módulo de Productos - Implementación

## ✅ Archivos Creados

### 1. DTOs (Data Transfer Objects)
- ✅ `src/modules/products/dto/create-product.dto.ts`
  - Campos requeridos: `name`, `salePrice`
  - Campos opcionales: `sku`, `barcode`, `costPrice`, `stock`, `minStock`
  - **NO incluye `companyId`** - Se obtiene del contexto (Token/Guard)
  
- ✅ `src/modules/products/dto/update-product.dto.ts`
  - Todos los campos opcionales
  - Permite actualización parcial

### 2. Service
- ✅ `src/modules/products/products.service.ts`
  - Métodos implementados:
    - `create()` - Crea producto con validación de SKU/barcode único
    - `findAll()` - Lista productos de la empresa
    - `findOne()` - Obtiene un producto (verifica pertenencia a empresa)
    - `findByBarcode()` - Búsqueda por código de barras
    - `update()` - Actualiza producto (verifica pertenencia)
    - `remove()` - Elimina producto (verifica pertenencia)
    - `uploadImageToS3()` - Stub para subida de imágenes (TODO)

### 3. Controller
- ✅ `src/modules/products/products.controller.ts`
  - Rutas CRUD completas
  - **Todas protegidas** con `@UseGuards(JwtAuthGuard, TenantGuard)`
  - Usa `@ActiveTenant()` para obtener `companyId`
  - Endpoint para búsqueda por código de barras: `GET /products/barcode/:barcode`
  - Soporte para subida de imágenes (stub)

### 4. Module
- ✅ `src/modules/products/products.module.ts`
  - Importa `PrismaModule`
  - Exporta `ProductsService`
  - Registrado en `AppModule`

## 🔒 Seguridad Implementada

### Protección de Rutas
Todas las rutas están protegidas con:
```typescript
@UseGuards(JwtAuthGuard, TenantGuard)
```

### Validación de Empresa
- **TODAS** las consultas Prisma incluyen `where: { companyId }`
- El `companyId` viene del `@ActiveTenant()` (obtenido del header `x-tenant-id`)
- **NO se confía** en el `companyId` del body/DTO
- Se verifica pertenencia antes de update/delete

### Validación de Unicidad
- SKU debe ser único por empresa
- Código de barras debe ser único por empresa
- Se valida en create y update

## 📋 Endpoints Disponibles

### POST /products
Crea un nuevo producto.

**Body:**
```json
{
  "name": "Producto Ejemplo",
  "salePrice": 100.50,
  "sku": "SKU-001",
  "barcode": "1234567890123",
  "costPrice": 50.00,
  "stock": 100,
  "minStock": 10
}
```

**Headers:**
```
Authorization: Bearer <jwt_token>
x-tenant-id: <company_id>
Content-Type: multipart/form-data (si incluye imagen)
```

**Response:**
```json
{
  "id": 1,
  "companyId": 1,
  "name": "Producto Ejemplo",
  "salePrice": 100.5,
  "sku": "SKU-001",
  "barcode": "1234567890123",
  "costPrice": 50.0,
  "stock": 100,
  "imageUrl": "https://via.placeholder.com/150?text=product.jpg",
  "minStock": 10,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### GET /products
Lista todos los productos de la empresa actual.

**Headers:**
```
Authorization: Bearer <jwt_token>
x-tenant-id: <company_id>
```

### GET /products/:id
Obtiene un producto por ID.

**Headers:**
```
Authorization: Bearer <jwt_token>
x-tenant-id: <company_id>
```

### GET /products/barcode/:barcode
Busca un producto por código de barras (útil para escáneres).

**Headers:**
```
Authorization: Bearer <jwt_token>
x-tenant-id: <company_id>
```

### PATCH /products/:id
Actualiza un producto.

**Body (todos los campos opcionales):**
```json
{
  "name": "Producto Actualizado",
  "salePrice": 120.00,
  "stock": 150
}
```

**Headers:**
```
Authorization: Bearer <jwt_token>
x-tenant-id: <company_id>
```

### DELETE /products/:id
Elimina un producto.

**Headers:**
```
Authorization: Bearer <jwt_token>
x-tenant-id: <company_id>
```

## 🖼️ Manejo de Imágenes

### Estado Actual
- Se acepta un campo `image` en el POST /products
- Usa `FileInterceptor` de NestJS
- Por ahora retorna URL placeholder: `https://via.placeholder.com/150`
- Método `uploadImageToS3()` tiene comentario `TODO: Implement S3 Upload`

### Para Implementar S3
Cuando implementes la subida real a S3:
1. Instalar SDK de AWS: `pnpm add @aws-sdk/client-s3`
2. Configurar variables de entorno para S3
3. Reemplazar el método `uploadImageToS3()` en `products.service.ts`
4. Usar `PutObjectCommand` de AWS SDK

## ⚠️ Reglas de Negocio

1. **companyId nunca viene del cliente** - Siempre del contexto (Token/Guard)
2. **Todas las consultas filtran por companyId** - Aislamiento de datos
3. **SKU y barcode son únicos por empresa** - No globales
4. **Verificación de pertenencia** - En update/delete se verifica que el producto pertenezca a la empresa
5. **NotFoundExcepcion** - Si el producto no existe o no pertenece a la empresa

## 📝 Notas Técnicas

- Usa `ParseIntPipe` para validar IDs numéricos
- Usa `class-validator` para validar DTOs
- Manejo de errores con excepciones de NestJS:
  - `NotFoundException` - Producto no encontrado
  - `ConflictException` - SKU/barcode duplicado
- El servicio está completamente tipado con TypeScript
