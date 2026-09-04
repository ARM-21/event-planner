import type { Knex } from 'knex';
import { db } from '../../db/knex';

export interface EventRow {
  id: number;
  creator_id: number;
  title: string;
  description: string | null;
  starts_at: Date | string;
  location: string;
  visibility: 'public' | 'private';
  created_at: Date | string;
  updated_at: Date | string;
}

export function toPublicEvent(row: EventRow, tags: string[]) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: new Date(row.starts_at).toISOString(),
    location: row.location,
    visibility: row.visibility,
    creatorId: row.creator_id,
    tags,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function fetchTagsByEventIds(eventIds: number[]): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (eventIds.length === 0) return map;

  const rows = await db('event_tags')
    .join('tags', 'tags.id', 'event_tags.tag_id')
    .whereIn('event_tags.event_id', eventIds)
    .select('event_tags.event_id as eventId', 'tags.name as name')
    .orderBy('tags.name', 'asc');

  for (const row of rows as { eventId: number; name: string }[]) {
    const list = map.get(row.eventId) ?? [];
    list.push(row.name);
    map.set(row.eventId, list);
  }
  return map;
}

// Resolves tag names to ids, creating any that don't exist yet. Runs inside
// the caller's transaction so a partial insert can't leave orphan tags.
export async function upsertTagIds(trx: Knex.Transaction, names: string[]): Promise<number[]> {
  const unique = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
  const ids: number[] = [];

  for (const name of unique) {
    const existing = await trx('tags').where({ name }).first();
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    try {
      const [id] = await trx('tags').insert({ name });
      ids.push(id);
    } catch {
      // Concurrent request inserted the same (case-insensitive) name first.
      const row = await trx('tags').where({ name }).first();
      if (!row) throw new Error(`Failed to resolve tag "${name}"`);
      ids.push(row.id);
    }
  }
  return ids;
}
