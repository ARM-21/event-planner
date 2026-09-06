import { apiClient, authHeader } from '../client';
import { ROUTES } from '../../config/routes';

export async function resendVerification(token: string): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(
    ROUTES.API.AUTH.RESEND_VERIFICATION,
    {},
    { headers: authHeader(token) },
  );
  return response.data;
}
