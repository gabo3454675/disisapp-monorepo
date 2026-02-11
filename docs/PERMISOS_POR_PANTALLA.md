# Permisos por pantalla

Cómo se controla qué ve cada rol en cada pantalla del dashboard (frontend) y qué validaciones hace el backend.

---

## 1. Cómo funciona

- **Hook `usePermission()`** (`apps/client/src/hooks/usePermission.ts`):  
  Calcula el rol del usuario en la **organización actual** (la del switcher). Para Super Admin usa `superAdminOrganizations`; para el resto, `user.organizations` o `user.companies`. Devuelve un objeto con `role` y flags como `canManageTeam`, `canManageCustomers`, etc.

- **Menú (sidebar y bottom-nav):**  
  Cada ítem tiene un `permission`. Solo se muestran los enlaces cuyo permiso es `true`. Así, un usuario sin permiso no ve la opción en el menú, pero **si escribe la URL a mano** puede llegar a la pantalla.

- **Protección por pantalla:**  
  Para que el acceso por URL también esté controlado, las pantallas sensibles deben comprobar el permiso y, si no lo tiene, mostrar *"No tienes permisos para acceder a esta sección"* (y no cargar datos ni acciones). El backend siempre valida con Guards y servicios.

---

## 2. Matriz: pantalla ↔ permiso

| Ruta | Permiso usado en menú | ¿Bloquea pantalla si no tiene permiso? |
|------|------------------------|----------------------------------------|
| `/` (Dashboard) | `canViewDashboard` (todos) | No (todos pueden ver). Gráficos financieros solo si `canViewFinancialCharts`. |
| `/pos` | `canManageCustomers` | **Sí** – muestra "No tienes permisos..." |
| `/products` (Inventario) | `canManageProducts` | **Sí** – muestra "No tienes permisos..." |
| `/customers` | `canManageCustomers` | **Sí** – muestra "No tienes permisos..." |
| `/invoices` | `canManageCustomers` | **Sí** – muestra "No tienes permisos..." |
| `/credits` | `canManageCustomers` | **Sí** – muestra "No tienes permisos..." |
| `/expenses` | `canManageExpenses` | **Sí** – muestra "No tienes permisos..." |
| `/settings` | `canManageTeam` | **Sí** (en team) – muestra "No tienes permisos..." |
| `/settings/team` | `canManageTeam` | **Sí** – muestra "No tienes permisos..." |

---

## 3. Quién tiene cada permiso (resumen)

| Permiso | SUPER_ADMIN | ADMIN | MANAGER | SELLER | WAREHOUSE |
|---------|-------------|-------|---------|--------|-----------|
| canViewDashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| canViewFinancialCharts | ✓ | ✓ | ✓ | ✗ | ✗ |
| canManageTeam (Configuración, equipo) | ✓ | ✓ | ✗ | ✗ | ✗ |
| canManageCustomers (POS, Clientes, Facturas, Créditos) | ✓ | ✓ | ✓ | ✓ | ✗ |
| canManageProducts (Inventario) | ✓ | ✓ | ✓ | ✗ | ✓ |
| canManageExpenses (Gastos) | ✓ | ✓ | ✓ | ✗ | ✗ |

Referencia completa: `apps/server/docs/PERMISOS_Y_ROLES.md` y `apps/server/src/common/constants/roles.constants.ts`.

---

## 4. Dónde se usa en el código

- **Definición del menú:**  
  `apps/client/src/components/sidebar.tsx` → `navigationItems` (cada ítem tiene `permission`).  
  `apps/client/src/components/bottom-nav.tsx` → misma idea.

- **Cálculo de permisos:**  
  `apps/client/src/hooks/usePermission.ts` → devuelve el objeto con `role`, `canManageTeam`, `canManageCustomers`, etc., según el rol en la org actual.

- **Pantallas que ya bloquean:**  
  - `apps/client/src/app/(dashboard)/settings/team/page.tsx` → `if (!canManageTeam)` → mensaje.  
  - `apps/client/src/app/(dashboard)/expenses/page.tsx` → `if (!canManageExpenses)` → mensaje.

- **Pantallas que bloquean por permiso:**  
  POS, Inventario, Clientes, Facturas, Créditos, Gastos, Configuración/team : si no tiene el permiso, muestran el mensaje de acceso denegado. Mismo patrón `if (!permiso) return <Card>No tienes permisos...</Card>` para alinear “permisos por pantalla” con el menú.

---

## 5. Regla de oro

- **Frontend:** Los permisos por pantalla sirven para UX (ocultar menú y bloquear la vista).  
- **Backend:** Siempre debe validar con Guards y servicios; no confiar solo en que el usuario no vea el enlace.

Todas las pantallas del dashboard que dependen de un permiso concreto bloquean el acceso (mensaje "No tienes permisos...") cuando el usuario entra por URL sin tener ese permiso.
