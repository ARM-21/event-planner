export interface EventItem {
  id: number;
  title: string;
  description: string | null;
  startsAt: string;
  location: string;
  visibility: 'public' | 'private';
  creatorId: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface EventListResponse {
  data: EventItem[];
  pagination: Pagination;
}

export interface EventInput {
  title: string;
  description?: string;
  startsAt: string;
  location: string;
  visibility: 'public' | 'private';
  tags: string[];
}

export interface ListEventsParams {
  page?: number;
  limit?: number;
  search?: string;
  tag?: string;
  visibility?: 'public' | 'private';
  from?: string;
  sort?: 'starts_at' | '-starts_at';
}
