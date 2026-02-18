import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { AUTH_TOKEN_KEY, AUTH_TENANT_ID_KEY, AUTH_USER_KEY } from '@/constants/storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    const tenantId = await SecureStore.getItemAsync(AUTH_TENANT_ID_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (tenantId) config.headers['x-tenant-id'] = tenantId;
    return config;
  },
  (err) => Promise.reject(err)
);

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      SecureStore.deleteItemAsync(AUTH_TOKEN_KEY).catch(() => {});
      SecureStore.deleteItemAsync(AUTH_USER_KEY).catch(() => {});
      SecureStore.deleteItemAsync(AUTH_TENANT_ID_KEY).catch(() => {});
    }
    return Promise.reject(err);
  }
);

