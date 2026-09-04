import { apiClient } from '../client';
import type { TagListResponse } from './types';

export async function fetchTags(): Promise<TagListResponse> {
  const response = await apiClient.get<TagListResponse>('/tags');
  return response.data;
}
