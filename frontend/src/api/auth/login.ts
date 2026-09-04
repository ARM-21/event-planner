import { apiClient } from '../client';
import type { AuthResponse } from './types';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  return response.data;
}
