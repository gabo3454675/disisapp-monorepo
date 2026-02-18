# Disis Mobile (React Native / Expo)

App móvil del monorepo. Sesión persistente con **SecureStore**: no expira por inactividad.

## Requisitos

- Node 18+
- pnpm
- Expo CLI (`npx expo`)

## Configuración

1. Instalar dependencias (desde la raíz del monorepo):

   ```bash
   pnpm install
   ```

2. Crear `.env` en `apps/mobile/` (opcional):

   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.x:3001/api
   ```

   En dispositivo físico usa la IP de tu máquina, no `localhost`.

## Sesión persistente

- Al hacer **login**, el token y el usuario se guardan en **expo-secure-store** (no en AsyncStorage, por seguridad).
- Al **iniciar la app**, se lee el token de SecureStore y se valida con el backend (`GET /auth/organizations`). Si el token es válido, se mantiene la sesión; si responde 401, se borra y se muestra Login.
- **No hay expiración por inactividad**: la sesión solo se cierra si el usuario pulsa "Cerrar sesión" o si el token deja de ser válido (401).

## Ejecutar

Desde la raíz del monorepo:

```bash
cd apps/mobile && pnpm start
```

Luego escanear con Expo Go (Android/iOS) o pulsar `a` (Android) / `i` (iOS) en la terminal.

## Estructura

- `App.tsx`: raíz con `AuthProvider` y navegación. Solo muestra Login cuando no hay token o es inválido.
- `src/contexts/AuthContext.tsx`: estado de auth, lectura/escritura en SecureStore, validación al iniciar.
- `src/screens/LoginScreen.tsx`: formulario de login; al recibir respuesta guarda token y user con `setAuth`.
- `src/screens/HomeScreen.tsx`: pantalla principal; botón "Cerrar sesión" que llama a `clearAuth`.
- `src/lib/api.ts`: cliente axios con interceptor que inyecta token y tenant; en 401 borra SecureStore.
