import { useQuery } from '@tanstack/react-query';
import { fetchEvent } from '../../api/events/event-fetcher';

export function useEvent(id: number | undefined, token: string | null) {
  return useQuery({
    queryKey: ['events', id],
    queryFn: () => fetchEvent(id as number, token),
    enabled: id !== undefined,
  });
}
 