import { apiClient, authHeader } from '../client';
import { ROUTES } from '../../config/routes';

export interface SetupTwoFactorResult {
  secret: string;
  qrCodeDataUrl: string;
}

export async function setupTwoFactor(token: string): Promise<SetupTwoFactorResult> {
  const response = await apiClient.post<SetupTwoFactorResult>(
    ROUTES.API.AUTH.SETUP_2FA,
    {},
    { headers: authHeader(token) },
  );
  return response.data;
}
