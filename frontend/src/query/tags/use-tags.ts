import { useQuery } from '@tanstack/react-query';
import { fetchTags } from '../../api/tags/tags-fetcher';

export function useTags() {
  return useQuery({ queryKey: ['tags'], queryFn: fetchTags 
    ,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
