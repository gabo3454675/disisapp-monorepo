import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY, AUTH_TENANT_ID_KEY } from '@/constants/storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  plan: string;
  role: string;
}

export interface User {
  id: number;
  email: string;
  fullName?: string | null;
  isSuperAdmin?: boolean;
  organizations?: Organization[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** true cuando ya se verificó el token al iniciar (SecureStore leído). No redirigir a Login hasta que sea true. */
  isReady: boolean;
  selectedOrganizationId: number | null;
}

interface AuthContextValue extends AuthState {
  setAuth: (user: User, token: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  selectOrganization: (organizationId: number) => void;
  setApiAuth: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    isReady: false,
    selectedOrganizationId: null,
  });

  const setApiAuth = useCallback((token: string | null) => {
    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common.Authorization;
    }
  }, []);

  /** Persiste token y user en SecureStore y actualiza estado. No hay expiración por inactividad. */
  const setAuth = useCallback(
    async (user: User, token: string) => {
      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
      await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(user));
      const tenantId = user.organizations?.[0]?.id ?? null;
      if (tenantId != null) {
        await SecureStore.setItemAsync(AUTH_TENANT_ID_KEY, String(tenantId));
      }
      setApiAuth(token);
      setState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        isReady: true,
        selectedOrganizationId: tenantId,
      });
    },
    [setApiAuth]
  );

  /** Cerrar sesión: borra SecureStore y estado. Única forma de ir a Login además de token inválido. */
  const clearAuth = useCallback(async () => {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(AUTH_USER_KEY);
    await SecureStore.deleteItemAsync(AUTH_TENANT_ID_KEY);
    setApiAuth(null);
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isReady: true,
      selectedOrganizationId: null,
    });
  }, [setApiAuth]);

  const selectOrganization = useCallback((organizationId: number) => {
    setState((prev) => ({ ...prev, selectedOrganizationId: organizationId }));
    SecureStore.setItemAsync(AUTH_TENANT_ID_KEY, String(organizationId)).catch(() => {});
  }, []);

  /** Al iniciar la app: leer token y user de SecureStore. Solo redirigir a Login si no hay token o el token es inválido (401). */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        const userJson = await SecureStore.getItemAsync(AUTH_USER_KEY);
        const tenantIdStr = await SecureStore.getItemAsync(AUTH_TENANT_ID_KEY);

        if (cancelled) return;

        if (!token || !userJson) {
          setState((prev) => ({ ...prev, isReady: true, isAuthenticated: false }));
          return;
        }

        const user = JSON.parse(userJson) as User;
        const tenantId = tenantIdStr ? parseInt(tenantIdStr, 10) : user.organizations?.[0]?.id ?? null;

        setApiAuth(token);
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          isReady: true,
          selectedOrganizationId: tenantId,
        });

        // Opcional: validar token con el backend (si devuelve 401, limpiar sesión)
        const api = axios.create({ baseURL: API_URL, timeout: 5000 });
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        if (tenantId != null) {
          api.defaults.headers.common['x-tenant-id'] = String(tenantId);
        }
        await api.get('/auth/organizations').catch((err) => {
          if (err.response?.status === 401 && !cancelled) {
            clearAuth();
          }
        });
      } catch {
        if (!cancelled) {
          setState((prev) => ({ ...prev, isReady: true }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value: AuthContextValue = {
    ...state,
    setAuth,
    clearAuth,
    selectOrganization,
    setApiAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
