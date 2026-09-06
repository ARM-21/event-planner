import axios, { type InternalAxiosRequestConfig } from 'axios';

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
  // Required so the browser sends/accepts the httpOnly refresh-token
  // cookie on every request, not just ones that happen to need it.
  withCredentials: true,
});

type TokenRefreshListener = (token: string) => void;
let onTokenRefresh: TokenRefreshListener | null = null;

// `AuthProvider` registers itself here so a silent refresh triggered below
// (from whichever request happens to 401 first) updates the token it hands
// out everywhere else too, instead of only fixing the one request that
// triggered it.
export function setTokenRefreshListener(listener: TokenRefreshListener | null): void {
  onTokenRefresh = listener;
}

type SessionExpiredListener = () => void;
let onSessionExpired: SessionExpiredListener | null = null;

// Fired when `/auth/refresh` itself fails (missing/expired/revoked refresh
// cookie) — the definitive "this session is actually over" signal, as
// opposed to the routine 401-then-silent-refresh case above. `AuthProvider`
// uses this to clear stale local state, notify the user, and redirect to
// `/login`, instead of silently leaving a dead session in `localStorage`.
export function setSessionExpiredListener(listener: SessionExpiredListener | null): void {
  onSessionExpired = listener;
}

// Endpoints that must never trigger a refresh-and-retry themselves — either
// because a 401 there is a real "bad credentials"/"no session" answer
// (login/register), or because retrying it would recurse into itself
// (refresh).
const AUTH_ENDPOINTS_WITHOUT_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh'];

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retriedAfterRefresh?: boolean;
}

let refreshPromise: Promise<string> | null = null;

// Coalesces concurrent 401s into a single `/auth/refresh` call rather than
// firing one per failed request.
function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post<{ token: string }>('/auth/refresh')
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
          // Refresh itself failed (no/expired/revoked refresh cookie) — the
          // session is genuinely over, not just this one request. Notify
          // `AuthProvider` so it clears stale local state and redirects,
          // then fall through to the normal error rejection below.
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

// Repeated at every mutation error handler that wants to show the server's
// own message when there is one — an `ApiError` — and a generic fallback
// otherwise (a network error, or something that never reached the server).
export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
