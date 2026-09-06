import { apiClient, authHeader } from '../client';
import { ROUTES } from '../../config/routes';
import type { EventInput, EventItem } from './types';

export async function createEvent(data: EventInput, token: string): Promise<EventItem> {
  const response = await apiClient.post<EventItem>(ROUTES.API.EVENTS.CREATE, data, { headers: authHeader(token) });
  return response.data;
}
