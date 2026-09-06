import { apiClient } from '../client';
import { ROUTES } from '../../config/routes';

export async function verifyEmail(token: string): Promise<{ verified: boolean }> {
  const response = await apiClient.post<{ verified: boolean }>(ROUTES.API.AUTH.VERIFY_EMAIL, { token });
  return response.data;
}
