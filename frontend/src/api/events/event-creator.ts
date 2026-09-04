import { apiClient, authHeader } from '../client';
import type { EventInput, EventItem } from './types';

export async function createEvent(data: EventInput, token: string): Promise<EventItem> {
  const response = await apiClient.post<EventItem>('/events', data, { headers: authHeader(token) });
  return response.data;
}
