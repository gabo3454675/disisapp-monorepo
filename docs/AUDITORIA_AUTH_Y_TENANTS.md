# Auditoría: Auth y Multi-Tenant

**Fecha:** 2025-02-11  
**Alcance:** Flujo de autenticación, cambio de contraseña, roles (Super Admin) y consistencia front/back.

---

## 1. Resumen ejecutivo

- **Auth (login, reset, JWT):** Correcto. Backend devuelve `RESET_REQUIRED` con `email` para prellenar; frontend valida email y redirige correctamente.
- **Super Admin:** Backend devuelve todas las organizaciones en login/validateUser; frontend las guarda en `superAdminOrganizations` en `setAuth` y en el layout al hacer fetch de `organizations-all`. OrganizationGuard permite acceso a cualquier org sin Member.
- **Inconsistencias corregidas:** Interceptor 403 tipado, Super Admin con 0 orgs (evitar loading infinito), actualización de `superAdminOrganizations` cuando el fetch devuelve lista vacía.

---

## 2. Backend

### 2.1 Auth Service

| Punto | Estado | Notas |
|------|--------|--------|
| `validateUser` | OK | Devuelve todas las orgs para Super Admin; solo Member para el resto. |
| `requiresPasswordChange` | OK | Lanza `ForbiddenException({ message: 'RESET_REQUIRED', email })`. |
| `completePasswordReset` | OK | Actualiza `requiresPasswordChange: false`, llama a `validateUser` con la nueva clave y devuelve `access_token` + `user` (misma forma que login). |
| `login` | OK | Misma forma de respuesta; Super Admin recibe `user.organizations` con todas las orgs. |
| Auditoría PASSWORD_CHANGE | OK | Se registra en la primera org del usuario si tiene Member; Super Admin sin Member no escribe auditoría (aceptable). |

### 2.2 Guards

| Guard | Estado | Notas |
|-------|--------|--------|
| JwtStrategy | OK | Incluye `isSuperAdmin` desde BD en `request.user`. |
| OrganizationGuard | OK | Si no hay Member, comprueba `User.isSuperAdmin` y crea membresía virtual; Super Admin puede acceder a cualquier org. |

### 2.3 Tenants

| Endpoint | Estado | Notas |
|----------|--------|--------|
| `GET /tenants/organizations-all` | OK | Solo Super Admin; devuelve todas las organizaciones. |
| `GET /tenants/organization` | OK | Requiere OrganizationGuard y `x-tenant-id`. |

---

## 3. Frontend

### 3.1 Store (useAuthStore)

| Punto | Estado | Notas |
|-------|--------|--------|
| `setAuth` | OK | Si `user.requiresPasswordChange` redirige a reset-password. Si Super Admin y `user.organizations.length > 0`, asigna `superAdminOrganizations` para que el switcher tenga lista de inmediato. |
| `selectOrganization` | OK | Acepta cualquier id si `isSuperAdmin`; persiste en localStorage para el interceptor. |
| `getOrganizations()` | OK | Prioridad: Super Admin → `superAdminOrganizations`; si no, `user.organizations`; fallback `companies` mapeados. |
| `getCurrentOrganization()` | OK | Prioridad: Super Admin + `superAdminOrganizations`; luego `user.organizations` / `companies`. |
| `hasOrganizations()` | OK | Super Admin siempre `true`; resto según orgs/companies. |
| `setOrganizationConfig` | OK | Actualiza `user.organizations` y `superAdminOrganizations` (tasa, moneda). |
| Persist (partialize) | OK | No persiste `superAdminOrganizations`; tras refresh se usa `user.organizations` como fallback. |

### 3.2 API (lib/api.ts)

| Punto | Estado | Notas |
|-------|--------|--------|
| Request interceptor | OK | Añade `Authorization` y `x-tenant-id` (salvo rutas `/auth/` y `organizations-all`). Fallback a `auth-storage` si el store falla. |
| 401 | OK | Limpia token y auth-storage; redirige a `/login`. |
| 403 RESET_REQUIRED | OK | Lee `message` y `email` del body de forma tipada; redirige a `/reset-password?email=...`. |
| 403 organización/membresía | OK | Solo log; no redirige. |

### 3.3 Rutas y flujos

| Ruta / flujo | Estado | Notas |
|--------------|--------|--------|
| `/login` | OK | Suspense + formulario; enlace a `/reset-password`. |
| `/reset-password` | OK | Suspense + `ResetPasswordFormContent`; email desde `?email=` o props; validación de email; éxito → `setAuth` + `router.push('/')` o clearAuth + login. |
| Dashboard layout | OK | No autenticado → login. `requiresPasswordChange` → reset-password. Sin org: usuario normal se asigna primera org; Super Admin hace fetch a `organizations-all`, asigna primera o deja lista vacía. **Super Admin con 0 orgs:** ya no muestra loading infinito; muestra mensaje y botón "Ir a Configuración". |

### 3.4 Sidebar

| Punto | Estado | Notas |
|-------|--------|--------|
| Switcher Super Admin | OK | `hasMultipleOrganizations` true para Super Admin; lista desde `getOrganizations()`. |
| Efecto organizations-all | OK | Si Super Admin, carga todas las orgs y actualiza `superAdminOrganizations`; si no hay id seleccionado, selecciona la primera. |

---

## 4. Correcciones aplicadas en esta auditoría

1. **Interceptor 403:** Lectura de `message` y `email` tipada; comprobación de `message` string para organización/membresía.
2. **Super Admin con 0 organizaciones:**  
   - Layout: al hacer fetch de `organizations-all` se llama siempre a `setSuperAdminOrganizations` (con datos o `[]`).  
   - Si Super Admin y `getOrganizations().length === 0`, se muestra mensaje "No hay organizaciones en el sistema..." y botón a Configuración, en lugar de "Seleccionando organización..." indefinido.
3. **Fetch organizations-all en layout:** En caso de lista vacía o error, se actualiza `superAdminOrganizations` para que el layout pueda decidir correctamente el estado vacío.

---

## 5. Comportamiento esperado

- **Usuario con clave temporal:** Login → 403 RESET_REQUIRED → redirección a `/reset-password?email=...` → formulario con email rellenado → cambio de clave → login automático y entrada al dashboard.
- **Super Admin:** Login (o tras reset) → `user.organizations` con todas las orgs → `superAdminOrganizations` poblado en setAuth o por fetch → selector en sidebar muestra todas las empresas → puede cambiar de org y el backend acepta cualquier `x-tenant-id` vía OrganizationGuard.
- **Super Admin sin organizaciones en BD:** Tras cargar `organizations-all` se muestra mensaje claro y CTA a Configuración; no loading infinito.

---

## 6. Build

- **Server:** `npm run build` OK.
- **Client:** `npm run build` OK (solo warnings de ESLint, sin errores).
