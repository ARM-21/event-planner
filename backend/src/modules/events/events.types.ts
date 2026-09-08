export interface EventRow {
  id: number;
  creator_id: number;
  title: string;
  description: string | null;
  starts_at: Date | string;
  ends_at: Date | string;
  location: string;
  visibility: 'public' | 'private';
  created_at: Date | string;
  updated_at: Date | string;
}

export type RsvpStatus = 'going' | 'maybe' | 'not_going';

export interface EventRsvpRow {
  event_id: number;
  user_id: number;
  status: RsvpStatus;
}

export interface RsvpSummary {
  goingCount: number;
  myStatus: RsvpStatus | null;
}

export interface ListEventsParams {
  page: number;
  limit: number;
  search?: string;
  tag?: string;
  visibility?: 'public' | 'private';
  from?: string;
  status?: 'upcoming' | 'past';
  sort: string;
}

export interface ListEventsResult {
  rows: EventRow[];
  total: number;
}

export interface CreateEventInput {
  creatorId: number;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
  location: string;
  visibility: 'public' | 'private';
  tags: string[];
}

export interface UpdateEventInput {
  updates: Record<string, unknown>;
  tags?: string[];
}
