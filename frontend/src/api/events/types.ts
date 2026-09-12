export type RsvpStatus = 'going' | 'maybe' | 'not_going';

export interface RsvpSummary {
  goingCount: number;
  myStatus: RsvpStatus | null;
}

export interface EventItem {
  id: number;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  location: string;
  visibility: 'public' | 'private';
  creatorId: number;
  creatorName: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  // Only present on a single-event fetch — absent on list items.
  rsvp?: RsvpSummary;
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
  endsAt: string;
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
  status?: 'upcoming' | 'past';
  sort?: 'starts_at' | '-starts_at' | 'popularity' | '-popularity' | 'created_at' | '-created_at';
}
