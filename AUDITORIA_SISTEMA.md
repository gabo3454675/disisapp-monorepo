# Auditoría general del sistema de facturación (FACTURACION2 / disisapp-monorepo)

**Fecha:** Marzo 2025  
**Objetivo:** Auditoría profunda del sistema, propuesta de refactors y evaluación de estructura, priorizando el **funcionamiento completo**.

---

## 1. Resumen ejecutivo

El sistema es un **monorepo** (pnpm) con backend **NestJS**, frontend **Next.js 14** (App Router) y app **Expo**. La base de datos es **PostgreSQL** con **Prisma**; el modelo es **multi-tenant por organización** con soporte legacy a **Company**. La auditoría identifica puntos que pueden afectar el funcionamiento completo, consistencia de datos y mantenibilidad. **No se recomienda un cambio estructural radical**; sí refactors puntuales y mejoras incrementales priorizadas.

---

## 2. Arquitectura actual

| Capa        | Tecnología |
|-------------|------------|
| Monorepo    | pnpm workspaces (`apps/*`, `packages/*`) |
| Backend     | NestJS 10, Prisma 5.10, PostgreSQL |
| Auth        | JWT (Passport), bcrypt, OrganizationGuard (tenant desde JWT) |
| API         | REST, prefijo `/api`, ValidationPipe global |
| Frontend    | Next.js 14, React 18, Tailwind, Zustand, axios |
| Shared      | `packages/shared` (tipos TS; solo usado por client) |

**Flujos críticos:** login → selección de organización → dashboard; facturación (POS, PDF, pagos); inventario y movimientos; cierre de caja (apertura/cierre, resumen por token); créditos, gastos, invitaciones; rutas públicas (ver/pagar factura por token, invitación, resumen cierre).

---

## 3. Hallazgos por prioridad

### Prioridad ALTA (afectan funcionamiento o consistencia)

#### 3.1 Duplicación de la URL base del API (client)

**Dónde:**  
- `apps/client/src/lib/api.ts`: `DEFAULT_API_URL` y `getApiUrl()`  
- `apps/client/src/app/layout.tsx`: misma lógica para `window.__NEXT_PUBLIC_API_URL__`  
- `apps/client/src/app/pay/[token]/page.tsx`: 3 veces `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'`

**Riesgo:** Si se cambia la URL en un solo sitio, las páginas públicas (pay por token) pueden seguir apuntando al fallback y fallar en producción.

**Refactor propuesto:**  
- Crear `apps/client/src/lib/apiBaseUrl.ts` que exporte una única función (o constante) para la URL base.  
- Usarla en `api.ts`, en `layout.tsx` (para el script de inyección) y en `pay/[token]/page.tsx` (y cualquier otra página que llame al API sin usar `apiClient`).

---

#### 3.2 Modelo dual Company vs Organization (legacy)

**Dónde:**  
- Prisma: entidades con `companyId` (obligatorio) y `organizationId` (opcional): Invoice, Product, Customer, etc.  
- `getCompanyIdFromOrganization()` en `common/helpers/organization.helper.ts`: busca una Company por **nombre** igual a la organización; si no existe, **crea** una Company con `taxId` aleatorio (`J-${random}-${random}`).

**Riesgos:**  
- Dos organizaciones con el mismo nombre compartirían la misma Company (datos mezclados).  
- Creación implícita de Company dificulta auditoría y puede generar empresas “fantasma”.  
- Doble fuente de verdad (companyId y organizationId) en facturas e ítems.

**Refactor propuesto (gradual):**  
1. **Corto plazo:** Documentar que el nombre de organización debe ser único a efectos de Company legacy, o añadir en el helper una verificación por `organizationId` si en el futuro se guarda en Company (ej. columna `organizationId` en Company).  
2. **Mediano plazo:** Hacer que todas las lecturas/escrituras críticas (facturas, productos, clientes) usen **solo** `organizationId` en la lógica de negocio y en la extensión de Prisma. Hacer `companyId` opcional en Invoice (y donde aplique) y rellenarlo solo para reportes legacy si hace falta.  
3. **Largo plazo:** Deprecar Company y migrar datos a Organization únicamente.

---

#### 3.3 Tipos compartidos (packages/shared) desalineados con el backend

**Dónde:**  
- `packages/shared`: `id: string`, `tenantId: string` en User, Invoice, Customer, Product, etc.  
- Backend: Prisma y DTOs usan `id: number`, `organizationId: number`.  
- El server **no** usa `@billing-system/shared`; el client sí (transpilePackages).

**Riesgos:**  
- Errores de tipo o comparaciones incorrectas (string vs number).  
- Contrato API (respuestas reales) no coincide con los tipos del client, lo que puede ocultar bugs.

**Refactor propuesto:**  
1. **Opción A (recomendada):** Definir el contrato del API como fuente de verdad. Que el server exporte (o genere) DTOs/tipos de respuesta (ids numéricos, `organizationId`, etc.) y que el client los consuma (desde un paquete o desde tipos generados). Usar `shared` solo para tipos que no vienen del API (ej. UI, constantes).  
2. **Opción B:** Alinear `packages/shared` con el backend (ids number, `organizationId`, mismos enums) y que tanto server como client los usen para respuestas del API.

---

### Prioridad MEDIA (mantenibilidad y robustez)

#### 3.4 Sin tests automatizados

**Dónde:**  
- `apps/server`: Jest configurado en `package.json` con `testRegex: ".*\\.spec\\.ts$"`, pero no hay archivos `*.spec.ts` en el proyecto.

**Riesgo:** Regresiones en refactors y en flujos críticos (login, facturación, cierre de caja, créditos).

**Refactor propuesto:**  
- Añadir tests unitarios para servicios críticos: `AuthService`, `InvoicesService`, `CierreCajaService`, `CreditsService`.  
- Añadir al menos un e2e por flujo: login + selección de org, crear factura, abrir/cerrar cierre de caja.  
- Mantener los tests en cada PR para no romper funcionamiento completo.

---

#### 3.5 Llamadas al API en el client sin capa de servicios

**Dónde:**  
- Páginas y componentes llaman directamente a `apiClient.get/post/patch/delete` con rutas string (ej. `/invoices/${id}/pdf`, `/products`).

**Riesgo:** URLs y manejo de errores duplicados; más difícil tipar respuestas y reutilizar lógica.

**Refactor propuesto (opcional):**  
- Introducir módulos por dominio, por ejemplo `lib/api/invoices.ts`, `lib/api/products.ts`, que encapsulen las llamadas y devuelvan datos tipados.  
- No es obligatorio para “funcionamiento completo”, pero mejora mantenibilidad y reduce errores al cambiar rutas.

---

#### 3.6 Variables de entorno no documentadas en un solo lugar

**Dónde:**  
- Server: `.env.txt` con ejemplos (DATABASE_URL, JWT_SECRET, PORT, S3, Firebase, etc.).  
- Client: `NEXT_PUBLIC_API_URL` usado en código pero sin `.env.example` en raíz del monorepo o del app.

**Refactor propuesto:**  
- Mantener o crear `.env.example` (o documentar en README) en `apps/server` y `apps/client` con todas las variables necesarias y opcionales, para que cualquier desarrollador pueda levantar el proyecto sin adivinar.

---

### Prioridad BAJA (mejoras de calidad)

#### 3.7 Hidratación del store (Zustand) y rutas protegidas

**Dónde:**  
- `useAuthStore` con `persist` y `_hasHydrated`.  
- `partialize` no persiste `_hasHydrated` ni `superAdminOrganizations` (correcto para no persistir estado volátil).

**Riesgo:** En el primer render (SSR o antes de hidratación), el store puede estar vacío; si una página protegida renderiza condicionales según `isAuthenticated` o `user`, podría mostrar contenido incorrecto un instante o depender del redirect en el interceptor de axios (401 → login).

**Refactor propuesto:**  
- Asegurar que las rutas bajo `(dashboard)` comprueben autenticación después de hidratación (ej. layout que redirige a login si no hay token una vez hidratado), o confiar explícitamente en el redirect 401 del `apiClient`.  
- Documentar el flujo de “proteger rutas” en el client para futuros cambios.

#### 3.8 JWT_SECRET por defecto en desarrollo

**Dónde:**  
- `jwt.strategy.ts`: `secretOrKey: configService.get<string>('JWT_SECRET') || 'esta_es_una_clave_super_secreta_para_disis_2026'`.

**Riesgo:** Si en producción no se define `JWT_SECRET`, se usaría ese valor por defecto (seguridad débil).

**Refactor propuesto:**  
- En producción, exigir `JWT_SECRET` (arranque fallido si no está definido).  
- Mantener el default solo en `NODE_ENV=development`.

---

## 4. Lo que está bien y conviene mantener

- **Seguridad tenant:** El `OrganizationGuard` usa **solo** el JWT (`organizationId` / `tenantId`); no confía en `x-tenant-id` para autorización. El header se usa solo para caché (tenant en la clave del `HttpCacheTenantInterceptor`).
- **Extensión Prisma:** La inyección automática de tenant/organization en consultas y escrituras garantiza aislamiento por organización.
- **Rutas públicas:** Auth, factura por token y resumen de cierre por token están correctamente marcadas con `@Public()` y no exigen `OrganizationGuard`.
- **CORS:** Configuración explícita por entorno y dominios; en producción solo orígenes permitidos.
- **ValidationPipe global:** `whitelist` y `forbidNonWhitelisted` reducen datos inesperados en el API.
- **Orden de guards:** Uso consistente de `JwtAuthGuard` antes de `OrganizationGuard` en controladores que requieren organización.
- **Estructura del monorepo:** Separación clara entre apps y packages; no se recomienda reestructurar por completo.

---

## 5. ¿Cambiar la estructura del proyecto?

**Recomendación: no hacer un cambio estructural grande.** La estructura actual (apps/server, apps/client, apps/mobile, packages/shared) es adecuada. Cambios sugeridos son **incrementales**:

- Añadir un módulo pequeño en el client para la **URL base del API** (y usarlo en layout, api y pay).
- Opcional: agrupar por dominio en el client (ej. `features/invoices`, `features/cierre-caja`) dentro de `app/` y `components/` si el equipo crece y se necesita más claridad; no es requisito para el funcionamiento.
- Mantener un solo punto de verdad para **tipos del API** (server o shared alineado con server) para evitar desajustes entre backend y frontend.

---

## 6. Plan de refactors priorizado (funcionamiento completo)

| Orden | Acción | Prioridad | Esfuerzo |
|-------|--------|-----------|----------|
| 1 | Centralizar URL base del API en el client y usarla en layout, api.ts y pay/[token] | Alta | Bajo |
| 2 | Definir estrategia de tipos (API como fuente de verdad o alinear shared con backend) e implementarla en al menos facturas y auth | Alta | Medio |
| 3 | Documentar o restringir el uso de Company legacy (nombres únicos o migración a solo organizationId) | Alta | Bajo/Medio |
| 4 | Añadir tests unitarios a AuthService, InvoicesService, CierreCajaService y al menos un e2e de flujo crítico | Media | Alto |
| 5 | Crear `.env.example` (o sección README) para server y client con todas las variables | Media | Bajo |
| 6 | (Opcional) Capa de servicios por dominio en el client para llamadas al API | Media | Medio |
| 7 | Exigir JWT_SECRET en producción; default solo en development | Baja | Bajo |
| 8 | Revisar flujo de rutas protegidas e hidratación en el client y documentarlo | Baja | Bajo |

---

## 7. Conclusión

El sistema es coherente en multi-tenant, seguridad y separación de responsabilidades. Para **priorizar el funcionamiento completo**:

1. **Hacer ya:** Centralizar la URL del API en el client y unificar tipos (API como contrato o shared alineado) para evitar fallos en producción y bugs de tipos.  
2. **Planificar:** Reducir la dependencia del modelo Company legacy (documentación, restricciones o migración a organizationId) y añadir tests en servicios y un flujo e2e.  
3. **No cambiar** la estructura global del monorepo; aplicar refactors puntuales y mantener una sola fuente de verdad para configuración (URL, env) y tipos del API.

Si quieres, el siguiente paso puede ser implementar el refactor de la URL base del API y/o la estrategia de tipos en un subconjunto de módulos (por ejemplo solo facturas y auth).
