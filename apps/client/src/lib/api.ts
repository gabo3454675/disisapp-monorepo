import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor: Inyecta token JWT y x-tenant-id automáticamente
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Solo en el cliente (browser)
    if (typeof window !== 'undefined') {
      // Obtener token del localStorage
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Obtener selectedOrganizationId directamente del store de Zustand
      // Esto es más confiable que parsear localStorage manualmente
      try {
        // Importación dinámica para evitar problemas de SSR
        const { useAuthStore } = require('@/store/useAuthStore');
        const store = useAuthStore.getState();
        // Priorizar selectedOrganizationId sobre selectedCompanyId
        const selectedOrganizationId = store.selectedOrganizationId || store.selectedCompanyId;

        // No enviar tenant en rutas públicas ni en el listado de todas las orgs (Super Admin)
        const isPublicRoute = config.url?.includes('/auth/');
        const isOrganizationsAll = config.url?.includes('/tenants/organizations-all');
        if (selectedOrganizationId && !isPublicRoute && !isOrganizationsAll) {
          config.headers['x-tenant-id'] = selectedOrganizationId.toString();
        }
      } catch (error) {
        // Si hay error accediendo al store, intentar leer de localStorage como fallback
        try {
          const authStorage = localStorage.getItem('auth-storage');
          if (authStorage) {
            const authData = JSON.parse(authStorage);
            const selectedCompanyId = authData?.state?.selectedCompanyId;
            if (selectedCompanyId) {
              const isPublicRoute = config.url?.includes('/auth/');
              if (!isPublicRoute) {
                config.headers['x-tenant-id'] = selectedCompanyId.toString();
              }
            }
          }
        } catch (fallbackError) {
          // Error silencioso - no afecta la funcionalidad
        }
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Maneja errores de autenticación y validación de tenant
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (typeof window !== 'undefined') {
      // Error 401: Token expirado o inválido
      if (error.response?.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth-storage');
        // Redirigir a login
        window.location.href = '/login';
        return Promise.reject(error);
      }

      // Error 400 con mensaje de x-tenant-id: No hay organización seleccionada
      if (
        error.response?.status === 400 &&
        (error.response?.data as any)?.message?.includes('x-tenant-id')
      ) {
        // No redirigir automáticamente, dejar que el componente maneje el error
        console.warn('No hay organización seleccionada');
      }

      // Error 403 RESET_REQUIRED: Usuario con clave temporal debe cambiarla
      if (error.response?.status === 403) {
        const message = (error.response?.data as any)?.message;
        if (message === 'RESET_REQUIRED') {
          let userEmail = '';
          try {
            // Prioridad 1: email del body de la request (login)
            const reqData = error.config?.data;
            if (typeof reqData === 'string') {
              const parsed = JSON.parse(reqData);
              if (parsed?.email) userEmail = parsed.email;
            }
            // Prioridad 2: email en la respuesta del backend (si lo incluye)
            if (!userEmail && (error.response?.data as any)?.email) {
              userEmail = (error.response?.data as any).email;
            }
          } catch {
            // ignored
          }
          const url = userEmail
            ? `/auth/reset-password?email=${encodeURIComponent(userEmail)}`
            : '/auth/reset-password';
          window.location.href = url;
          return Promise.reject(error);
        }
        if (message?.includes('organización') || message?.includes('membresía')) {
          console.error('Acceso denegado a la organización seleccionada');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
