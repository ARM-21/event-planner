import { apiClient, authHeader } from '../client';

export async function deleteEvent(id: number, token: string): Promise<void> {
  await apiClient.delete(`/events/${id}`, { headers: authHeader(token) });
}
