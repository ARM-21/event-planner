import { apiClient, authHeader } from '../client';
import { ROUTES } from '../../config/routes';

export async function enableTwoFactor(code: string, token: string): Promise<void> {
  await apiClient.post(ROUTES.API.AUTH.ENABLE_2FA, { code }, { headers: authHeader(token) });
}
