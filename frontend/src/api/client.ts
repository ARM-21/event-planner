import axios from 'axios';

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
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response) {
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
