import { apiClient, authHeader } from '../client';
import type { EventListResponse, ListEventsParams } from './types';

export async function fetchEvents(params: ListEventsParams, token: string | null): Promise<EventListResponse> {
  const response = await apiClient.get<EventListResponse>('/events', { params, headers: authHeader(token) });
  return response.data;
}
