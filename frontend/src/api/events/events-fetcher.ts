import { apiClient, authHeader } from '../client';
import { ROUTES } from '../../config/routes';
import type { EventListResponse, ListEventsParams } from './types';

export async function fetchEvents(params: ListEventsParams, token: string | null): Promise<EventListResponse> {
  const response = await apiClient.get<EventListResponse>(ROUTES.API.EVENTS.LIST, { params, headers: authHeader(token) });
  return response.data;
}
