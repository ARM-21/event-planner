import { apiClient } from '../client';
import { ROUTES } from '../../config/routes';
import type { AuthResponse } from './types';

export async function verifyTwoFactor(preAuthToken: string, code: string): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>(ROUTES.API.AUTH.VERIFY_2FA, { preAuthToken, code });
  return response.data;
}
