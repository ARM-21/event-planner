import { apiClient, authHeader } from '../client';
import { ROUTES } from '../../config/routes';
import type { RsvpStatus, RsvpSummary } from './types';

export async function setEventRsvp(id: number, status: RsvpStatus, token: string): Promise<RsvpSummary> {
  const response = await apiClient.put<RsvpSummary>(ROUTES.API.EVENTS.RSVP(id), { status }, { headers: authHeader(token) });
  return response.data;
}
