import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { storage } from '../stores/storage.js';
import type { LoginResponse } from '@ruralbus/shared-types';

export const API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.API_URL) || 'http://localhost:4000';

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

// 1. Request Interceptor: Attach Bearer Access Token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await storage.getItem('ruralbus_access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 2. Response Interceptor: Transparent Refresh Token Rotation Queue
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Ignore 401s on login/register endpoints or if already retried
    const isAuthRoute =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await storage.getItem('ruralbus_refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const res = await axios.post<{ success: boolean; data: LoginResponse }>(
          `${API_BASE_URL}/api/v1/auth/refresh`,
          { refreshToken }
        );

        const newAccessToken = res.data.data.tokens.accessToken;
        const newRefreshToken = res.data.data.tokens.refreshToken;

        await storage.setItem('ruralbus_access_token', newAccessToken);
        await storage.setItem('ruralbus_refresh_token', newRefreshToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        processQueue(null, newAccessToken);
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr as Error, null);
        await storage.removeItem('ruralbus_access_token');
        await storage.removeItem('ruralbus_refresh_token');
        await storage.removeItem('ruralbus_user');
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
