import { apiClient } from '../client';
import { ROUTES } from '../../config/routes';
import type { AuthResponse } from './types';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>(ROUTES.API.AUTH.LOGIN, { email, password });
  return response.data;
}
