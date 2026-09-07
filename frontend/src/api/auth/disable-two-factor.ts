import { apiClient, authHeader } from '../client';
import { ROUTES } from '../../config/routes';

export async function disableTwoFactor(password: string, token: string): Promise<void> {
  await apiClient.post(ROUTES.API.AUTH.DISABLE_2FA, { password }, { headers: authHeader(token) });
}
