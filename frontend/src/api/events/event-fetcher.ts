import { apiClient, authHeader } from '../client';
import { ROUTES } from '../../config/routes';
import type { EventItem } from './types';

export async function fetchEvent(id: number, token: string | null): Promise<EventItem> {
  const response = await apiClient.get<EventItem>(ROUTES.API.EVENTS.DETAIL(id), { headers: authHeader(token) });
  return response.data;
}
