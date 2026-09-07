import { apiClient } from '../client';
import { ROUTES } from '../../config/routes';
import type { LoginResult } from './types';

export async function login(email: string, password: string): Promise<LoginResult> {
  const response = await apiClient.post<LoginResult>(ROUTES.API.AUTH.LOGIN, { email, password });
  return response.data;
}
