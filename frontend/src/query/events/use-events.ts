import { useQuery } from '@tanstack/react-query';
import { fetchEvents } from '../../api/events/events-fetcher';
import type { ListEventsParams } from '../../api/events/types';

export function useEvents(params: ListEventsParams, token: string | null) {
  return useQuery({
    queryKey: ['events', params, token],
    queryFn: () => fetchEvents(params, token),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
