import { apiClient, authHeader } from '../client';
import type { RsvpStatus, RsvpSummary } from './types';

export async function setEventRsvp(id: number, status: RsvpStatus, token: string): Promise<RsvpSummary> {
  const response = await apiClient.put<RsvpSummary>(`/events/${id}/rsvp`, { status }, { headers: authHeader(token) });
  return response.data;
}
