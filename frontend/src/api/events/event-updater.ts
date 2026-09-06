import { apiClient, authHeader } from '../client';
import { ROUTES } from '../../config/routes';
import type { EventInput, EventItem } from './types';

export async function updateEvent(id: number, data: Partial<EventInput>, token: string): Promise<EventItem> {
  const response = await apiClient.put<EventItem>(ROUTES.API.EVENTS.UPDATE(id), data, { headers: authHeader(token) });
  return response.data;
}
