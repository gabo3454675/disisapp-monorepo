# Implementación del Módulo de Autenticación y Multi-Tenant

## ✅ Dependencias

**Todas las dependencias ya están instaladas** en el `package.json`:
- `@nestjs/passport` ✓
- `passport-jwt` ✓
- `passport-local` ✓
- `bcrypt` ✓
- `@nestjs/jwt` ✓
- `class-validator` ✓
- `class-transformer` ✓

## 📁 Estructura de Archivos Creados/Actualizados

### 1. DTOs (Data Transfer Objects)
- ✅ `src/modules/auth/dto/login.dto.ts` - DTO para login
- ✅ `src/modules/auth/dto/register.dto.ts` - DTO para registro

### 2. Servicio de Autenticación
- ✅ `src/modules/auth/auth.service.ts` - Implementación completa con:
  - `validateUser()` - Valida credenciales y obtiene empresas del usuario
  - `login()` - Genera JWT y devuelve usuario con lista de empresas
  - `register()` - Crea nuevo usuario con hash de contraseña

### 3. Estrategias Passport
- ✅ `src/modules/auth/strategies/jwt.strategy.ts` - Actualizado para nuevo schema
- ✅ `src/modules/auth/strategies/local.strategy.ts` - Mantenido

### 4. Controller
- ✅ `src/modules/auth/auth.controller.ts` - Endpoints `/auth/login` y `/auth/register`

### 5. Guards
- ✅ `src/common/guards/tenant.guard.ts` - **Nuevo**: Valida membresía de empresa
- ✅ `src/common/guards/jwt-auth.guard.ts` - Mantenido (guard global)

### 6. Decoradores
- ✅ `src/common/decorators/active-user.decorator.ts` - `@ActiveUser()` para obtener usuario
- ✅ `src/common/decorators/active-tenant.decorator.ts` - `@ActiveTenant()` para obtener companyId
- ✅ `src/common/decorators/active-company.decorator.ts` - `@ActiveCompany()` para obtener objeto company
- ✅ `src/common/decorators/active-membership.decorator.ts` - `@ActiveMembership()` para obtener membresía

### 7. Módulo
- ✅ `src/modules/auth/auth.module.ts` - Actualizado con PrismaModule

## 🔐 Flujo de Autenticación

### Login
1. Cliente envía `POST /auth/login` con `{ email, password }`
2. `AuthService.validateUser()` verifica credenciales con bcrypt
3. Se obtienen todas las empresas del usuario (CompanyMember con status ACTIVE)
4. Se genera JWT con `sub` (userId) y `email`
5. Respuesta incluye:
   ```json
   {
     "access_token": "jwt_token",
     "user": {
       "id": 1,
       "email": "user@example.com",
       "fullName": "Juan Pérez",
       "companies": [
         {
           "id": 1,
           "name": "Empresa A",
           "taxId": "123456789",
           "logoUrl": "...",
           "currency": "USD",
           "role": "OWNER"
         }
       ]
     }
   }
   ```

### Registro
1. Cliente envía `POST /auth/register` con `{ email, password, fullName }`
2. Se verifica que el email no exista
3. Se hashea la contraseña con bcrypt (10 salt rounds)
4. Se crea el usuario
5. Se genera JWT (el usuario no tiene empresas aún)

## 🏢 Lógica Multi-Tenant

### TenantGuard

El `TenantGuard` valida que:
1. El usuario esté autenticado (JWT válido)
2. Exista el header `x-tenant-id` (o `x-company-id`)
3. El usuario tenga una membresía ACTIVE en esa empresa (CompanyMember)
4. Si es válido, inyecta en el request:
   - `request.activeCompanyId` - ID numérico de la empresa
   - `request.activeCompany` - Objeto Company completo
   - `request.activeMembership` - Objeto CompanyMember completo

### Uso del TenantGuard

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { ActiveTenant } from '@/common/decorators/active-tenant.decorator';

@Controller('customers')
@UseGuards(JwtAuthGuard, TenantGuard) // JwtAuthGuard primero, luego TenantGuard
export class CustomersController {
  @Get()
  findAll(@ActiveTenant() companyId: number) {
    // companyId viene del TenantGuard
    // Solo accesible si el usuario pertenece a esta empresa
  }
}
```

### Decoradores Disponibles

- `@ActiveUser()` - Obtiene el objeto `user` del JWT
- `@ActiveTenant()` - Obtiene el `companyId` (número)
- `@ActiveCompany()` - Obtiene el objeto `Company` completo
- `@ActiveMembership()` - Obtiene el objeto `CompanyMember` con rol y status

## 📝 Ejemplo de Uso Completo

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TenantGuard } from '@/common/guards/tenant.guard';
import { ActiveUser } from '@/common/decorators/active-user.decorator';
import { ActiveTenant } from '@/common/decorators/active-tenant.decorator';
import { ActiveCompany } from '@/common/decorators/active-company.decorator';

@Controller('invoices')
@UseGuards(JwtAuthGuard, TenantGuard)
export class InvoicesController {
  @Get()
  findAll(
    @ActiveUser() user: any,
    @ActiveTenant() companyId: number,
    @ActiveCompany() company: any,
  ) {
    // user contiene: { id, email }
    // companyId es un número
    // company contiene: { id, name, taxId, currency, ... }
    
    return this.invoicesService.findAll(companyId);
  }
}
```

## 🔒 Headers Requeridos

Para endpoints protegidos con `TenantGuard`, el cliente debe enviar:
```
Authorization: Bearer <jwt_token>
x-tenant-id: <company_id>
```

## ⚠️ Notas Importantes

1. **Orden de Guards**: Siempre usar `JwtAuthGuard` antes de `TenantGuard`
2. **IDs Numéricos**: El nuevo schema usa `Int` (números) en lugar de `String` (CUID)
3. **Membresías**: Un usuario puede tener múltiples empresas con diferentes roles
4. **Status**: Solo se consideran membresías con `status: 'ACTIVE'`
