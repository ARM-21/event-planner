import { apiClient, authHeader } from '../client';

export async function resendVerification(token: string): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(
    '/auth/resend-verification',
    {},
    { headers: authHeader(token) },
  );
  return response.data;
}
