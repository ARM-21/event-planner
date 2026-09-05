/**
 * Tag routes: read-only access to the list of tags.
 *
 * Tags aren't created here directly — they're created automatically
 * whenever an event uses a new tag name (see events.service.ts). This
 * file just exposes the full list, mainly to power tag-filter/autocomplete
 * UI on the frontend.
 */

import { Router } from 'express';
import { db } from '../../db/knex';

const router = Router();

/**
 * GET /api/tags
 *
 * Returns every tag that exists, sorted alphabetically. No pagination —
 * the tag list is expected to stay small.
 */
router.get('/', async (_req, res, next) => {
  try {
    const data = await db('tags').select('id', 'name').orderBy('name', 'asc');
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
