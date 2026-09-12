export interface EventRow {
  id: number;
  creator_id: number;
  // joined from users.name — the only creator detail the API exposes
  creator_name: string;
  title: string;
  description: string | null;
  starts_at: Date | string;
  ends_at: Date | string;
  location: string;
  visibility: 'public' | 'private';
  created_at: Date | string;
  updated_at: Date | string;
}

// has_ended is computed in SQL (ends_at compared against the DB's own clock via
// fn.now()) rather than against the Node process clock, the same way listEvents
// filters upcoming/past.
export interface EventRowWithEndState extends EventRow {
  has_ended: number;
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
