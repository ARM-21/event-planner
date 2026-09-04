import { apiClient } from '../client';
import type { AuthResponse } from './types';

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/register', { name, email, password });
  return response.data;
}
