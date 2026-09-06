import { apiClient } from '../client';
import { ROUTES } from '../../config/routes';
import type { AuthResponse } from './types';

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>(ROUTES.API.AUTH.REGISTER, { name, email, password });
  return response.data;
}
