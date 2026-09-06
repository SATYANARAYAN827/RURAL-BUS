import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { LoginResponse } from '@ruralbus/shared-types';

export const API_BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) ||
  'http://localhost:4000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// 1. Request Interceptor: Attach Bearer Access Token if legitimate token exists in localStorage
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const token = localStorage.getItem('ruralbus_access_token');
        if (token && token.trim()) {
          if (!config.headers) {
            config.headers = new axios.AxiosHeaders();
          }
          if (typeof (config.headers as any).set === 'function') {
            (config.headers as any).set('Authorization', `Bearer ${token.trim()}`);
          } else {
            config.headers.Authorization = `Bearer ${token.trim()}`;
          }
        }
      }
    } catch {
      // Ignore storage read errors
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 2. Response Interceptor: Transparent 401 Refresh Token Rotation Queue
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    const isAuthRoute =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh') ||
      originalRequest.url?.includes('/auth/logout');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers && token) {
              if (typeof (originalRequest.headers as any).set === 'function') {
                (originalRequest.headers as any).set('Authorization', `Bearer ${token}`);
              } else {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken =
          typeof window !== 'undefined' && window.localStorage
            ? localStorage.getItem('ruralbus_refresh_token')
            : null;

        if (!refreshToken) {
          throw error;
        }

        const res = await axios.post<{ success: boolean; data: LoginResponse }>(
          `${API_BASE_URL}/api/v1/auth/refresh`,
          { refreshToken }
        );

        const newAccessToken = res.data?.data?.tokens?.accessToken;
        const newRefreshToken = res.data?.data?.tokens?.refreshToken;

        if (!newAccessToken || !newRefreshToken) {
          throw new Error('Invalid refresh response from server');
        }

        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('ruralbus_access_token', newAccessToken);
          localStorage.setItem('ruralbus_refresh_token', newRefreshToken);
        }

        if (originalRequest.headers) {
          if (typeof (originalRequest.headers as any).set === 'function') {
            (originalRequest.headers as any).set('Authorization', `Bearer ${newAccessToken}`);
          } else {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
        }

        processQueue(null, newAccessToken);
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr as Error, null);
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem('ruralbus_access_token');
          localStorage.removeItem('ruralbus_refresh_token');
          localStorage.removeItem('ruralbus_user');
          try {
            window.dispatchEvent(new CustomEvent('ruralbus:session-expired'));
          } catch {
            // Ignore event dispatch errors in non-browser environments
          }
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
