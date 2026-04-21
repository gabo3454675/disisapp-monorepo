import type { LoginResponse } from '@/types/shared-types';
import { apiClient } from './client';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
}

export interface CompletePasswordResetPayload {
  email: string;
  currentPassword: string;
  newPassword: string;
}

export interface RecoverPasswordPayload {
  email: string;
  fullName: string;
  newPassword: string;
}

export interface SwitchOrganizationResponse {
  access_token: string;
  organizationId: number;
}

/**
 * Servicio de autenticación. Centraliza las llamadas al API de auth.
 */
export const authService = {
  /** Iniciar sesión. Devuelve token y usuario (con organizations / companies). */
  login(payload: LoginPayload): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/login', payload).then((res) => res.data);
  },

  /** Registro de nuevo usuario. */
  register(payload: RegisterPayload): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/register', payload).then((res) => res.data);
  },

  /** Completar cambio de contraseña (usuarios con clave temporal o desde perfil). */
  completePasswordReset(payload: CompletePasswordResetPayload): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/complete-password-reset', payload).then((res) => res.data);
  },

  /** Recuperación de contraseña dentro del sistema (sin correo externo). */
  recoverPassword(payload: RecoverPasswordPayload): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/auth/recover-password', payload).then((res) => res.data);
  },

  /** Cambiar organización activa (nuevo JWT con organizationId). */
  switchOrganization(organizationId: number): Promise<SwitchOrganizationResponse> {
    return apiClient
      .post<SwitchOrganizationResponse>('/auth/switch-organization', { organizationId })
      .then((res) => res.data);
  },
};
