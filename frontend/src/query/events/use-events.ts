import { useQuery } from '@tanstack/react-query';
import { fetchEvents } from '../../api/events/events-fetcher';
import type { ListEventsParams } from '../../api/events/types';

export function useEvents(params: ListEventsParams, token: string | null) {
  return useQuery({
    queryKey: ['events', params, token],
    queryFn: () => fetchEvents(params, token),
  });
}
