import { Router } from 'express';
import { listTags } from './tags.service';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const data = await listTags();
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
