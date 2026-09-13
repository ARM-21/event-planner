import { useQuery } from '@tanstack/react-query';
import { fetchEvent } from '../../api/events/event-fetcher';

export function useEvent(id: number | undefined, token: string | null) {
  return useQuery({
    // token in the key: the response depends on who is asking (private events, myStatus)
    queryKey: ['events', id, token],
    queryFn: () => fetchEvent(id as number, token),
    enabled: id !== undefined,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
