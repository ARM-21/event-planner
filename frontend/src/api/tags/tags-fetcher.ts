import { apiClient } from '../client';
import { ROUTES } from '../../config/routes';
import type { TagListResponse } from './types';

export async function fetchTags(): Promise<TagListResponse> {
  const response = await apiClient.get<TagListResponse>(ROUTES.API.TAGS.LIST);
  return response.data;
}
