/**
 * Data access for tags.
 */

import { db } from '../../db/knex';

export interface TagRow {
  id: number;
  name: string;
}

export async function listTags(): Promise<TagRow[]> {
  return db('tags').select('id', 'name').orderBy('name', 'asc');
}
