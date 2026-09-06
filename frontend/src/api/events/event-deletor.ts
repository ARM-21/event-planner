import { apiClient, authHeader } from '../client';
import { ROUTES } from '../../config/routes';

export async function deleteEvent(id: number, token: string): Promise<void> {
  await apiClient.delete(ROUTES.API.EVENTS.DELETE(id), { headers: authHeader(token) });
}
