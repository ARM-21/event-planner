/**
 * Data access for tags.
 */

import { db } from '../../db/knex';
import type { TagRow } from './tags.types';

export async function listTags(): Promise<TagRow[]> {
  return db('tags').select('id', 'name').orderBy('name', 'asc');
}
