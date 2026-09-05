import { apiClient, authHeader } from '../client';

export async function clearEventRsvp(id: number, token: string): Promise<void> {
  await apiClient.delete(`/events/${id}/rsvp`, { headers: authHeader(token) });
}
