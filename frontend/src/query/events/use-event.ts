import { useQuery } from '@tanstack/react-query';
import { fetchEvent } from '../../api/events/event-fetcher';

export function useEvent(id: number | undefined, token: string | null) {
  return useQuery({
    queryKey: ['events', id],
    queryFn: () => fetchEvent(id as number, token),
    enabled: id !== undefined,
    staleTime: 1000 * 60 * 5, // 2 minutes
    gcTime: 1000 * 60 * 10, // 5 minutes
  });
}
 