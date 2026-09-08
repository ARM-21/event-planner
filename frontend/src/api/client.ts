import axios, { type InternalAxiosRequestConfig } from 'axios';
import { ROUTES } from '../config/routes';

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: FieldError[],
  ) {
    super(message);
  }
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' },
  // So the browser sends/accepts the httpOnly refresh-token cookie.
  withCredentials: true,
});

type TokenRefreshListener = (token: string) => void;
let onTokenRefresh: TokenRefreshListener | null = null;

// `AuthProvider` registers itself here to catch a silently-refreshed token.
export function setTokenRefreshListener(listener: TokenRefreshListener | null): void {
  onTokenRefresh = listener;
}

type SessionExpiredListener = () => void;
let onSessionExpired: SessionExpiredListener | null = null;

// Fired when `/auth/refresh` itself fails — the session is genuinely over.
export function setSessionExpiredListener(listener: SessionExpiredListener | null): void {
  onSessionExpired = listener;
}

// Endpoints that must never trigger a refresh-and-retry themselves.
const AUTH_ENDPOINTS_WITHOUT_REFRESH = [
  ROUTES.API.AUTH.LOGIN,
  ROUTES.API.AUTH.REGISTER,
  ROUTES.API.AUTH.REFRESH,
  ROUTES.API.AUTH.VERIFY_2FA,
];

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retriedAfterRefresh?: boolean;
}

let refreshPromise: Promise<string> | null = null;

// Coalesces concurrent 401s into a single `/auth/refresh` call.
function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post<{ token: string }>(ROUTES.API.AUTH.REFRESH)
      .then((response) => response.data.token)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response) {
      const config = error.config as RetriableConfig | undefined;
      const isExemptEndpoint = AUTH_ENDPOINTS_WITHOUT_REFRESH.some((path) => config?.url?.includes(path));

      if (error.response.status === 401 && config && !isExemptEndpoint && !config._retriedAfterRefresh) {
        try {
          const token = await refreshAccessToken();
          onTokenRefresh?.(token);
          config._retriedAfterRefresh = true;
          config.headers.set('Authorization', `Bearer ${token}`);
          return apiClient(config);
        } catch {
          // Refresh failed — notify AuthProvider, then fall through to the rejection below.
          onSessionExpired?.();
        }
      }

      const body = error.response.data as { error?: { message?: string; details?: FieldError[] } } | undefined;
      return Promise.reject(
        new ApiError(error.response.status, body?.error?.message ?? 'Something went wrong', body?.error?.details),
      );
    }
    return Promise.reject(new ApiError(0, 'Network error. Please check your connection and try again.'));
  },
);

export function authHeader(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Shows the server's own message for an `ApiError`, otherwise a generic fallback.
export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
