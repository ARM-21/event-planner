import { apiClient } from '../client';

export async function verifyEmail(token: string): Promise<{ verified: boolean }> {
  const response = await apiClient.post<{ verified: boolean }>('/auth/verify-email', { token });
  return response.data;
}
