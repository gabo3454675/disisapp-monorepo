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

        // Solo agregar el header si hay una organización seleccionada
        // y no es una ruta pública (auth)
        const isPublicRoute = config.url?.includes('/auth/');
        if (selectedOrganizationId && !isPublicRoute) {
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

      // Error 403: Usuario no tiene acceso a esta organización
      if (error.response?.status === 403) {
        const message = (error.response?.data as any)?.message;
        if (message?.includes('organización') || message?.includes('membresía')) {
          // El usuario no tiene acceso a esta organización
          // Podríamos limpiar la selección y redirigir
          console.error('Acceso denegado a la organización seleccionada');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
