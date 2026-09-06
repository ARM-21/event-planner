import { apiClient, authHeader } from '../client';
import { ROUTES } from '../../config/routes';

export async function clearEventRsvp(id: number, token: string): Promise<void> {
  await apiClient.delete(ROUTES.API.EVENTS.RSVP(id), { headers: authHeader(token) });
}
