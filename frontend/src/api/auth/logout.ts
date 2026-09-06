import { apiClient } from '../client';

export async function logoutRequest(): Promise<void> {
  await apiClient.post('/auth/logout');
}
