import { Router } from 'express';
import { db } from '../../db/knex';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const data = await db('tags').select('id', 'name').orderBy('name', 'asc');
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
