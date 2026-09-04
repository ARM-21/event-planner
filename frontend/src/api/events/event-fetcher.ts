import { apiClient, authHeader } from '../client';
import type { EventItem } from './types';

export async function fetchEvent(id: number, token: string | null): Promise<EventItem> {
  const response = await apiClient.get<EventItem>(`/events/${id}`, { headers: authHeader(token) });
  return response.data;
}
