import { apiClient, authHeader } from '../client';
import type { EventInput, EventItem } from './types';

export async function updateEvent(id: number, data: Partial<EventInput>, token: string): Promise<EventItem> {
  const response = await apiClient.put<EventItem>(`/events/${id}`, data, { headers: authHeader(token) });
  return response.data;
}
