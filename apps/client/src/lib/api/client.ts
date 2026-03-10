import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/lib/config/api-config';

function getApiUrl(): string {
  if (typeof window !== 'undefined' && (window as unknown as { __NEXT_PUBLIC_API_URL__?: string }).__NEXT_PUBLIC_API_URL__) {
    return (window as unknown as { __NEXT_PUBLIC_API_URL__: string }).__NEXT_PUBLIC_API_URL__;
  }
  return API_BASE_URL;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor: Usa la URL del API inyectada en runtime y añade token/tenant
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.baseURL = getApiUrl();
    // Solo en el cliente (browser)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      try {
        const { useAuthStore } = require('@/store/useAuthStore');
        const store = useAuthStore.getState();
        const selectedOrganizationId = store.selectedOrganizationId || store.selectedCompanyId;
        const isPublicRoute = config.url?.includes('/auth/');
        const isOrganizationsAll = config.url?.includes('/tenants/organizations-all');
        if (selectedOrganizationId && !isPublicRoute && !isOrganizationsAll) {
          config.headers['x-tenant-id'] = selectedOrganizationId.toString();
        }
      } catch (error) {
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
          // no-op
        }
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (typeof window !== 'undefined') {
      if (error.response?.status === 401) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth-storage');
        window.location.href = '/login';
        return Promise.reject(error);
      }
      if (
        error.response?.status === 400 &&
        (error.response?.data as any)?.message?.includes('x-tenant-id')
      ) {
        console.warn('No hay organización seleccionada');
      }
      if (error.response?.status === 403) {
        const data = error.response?.data as { message?: string; email?: string } | undefined;
        const message = typeof data?.message === 'string' ? data.message : '';
        if (message === 'RESET_REQUIRED') {
          let userEmail = '';
          try {
            if (data?.email) userEmail = data.email;
            if (!userEmail && typeof error.config?.data === 'string') {
              const parsed = JSON.parse(error.config.data) as { email?: string };
              if (parsed?.email) userEmail = parsed.email;
            }
          } catch {
            // ignored
          }
          const url = userEmail
            ? `/reset-password?email=${encodeURIComponent(userEmail)}`
            : '/reset-password';
          window.location.href = url;
          return Promise.reject(error);
        }
        if (typeof message === 'string' && (message.includes('organización') || message.includes('membresía'))) {
          console.error('Acceso denegado a la organización seleccionada');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
