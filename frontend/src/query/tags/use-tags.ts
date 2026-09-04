import { useQuery } from '@tanstack/react-query';
import { fetchTags } from '../../api/tags/tags-fetcher';

export function useTags() {
  return useQuery({ queryKey: ['tags'], queryFn: fetchTags });
}
