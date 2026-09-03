import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../db/knex';
import { env } from '../../config/env';
import { badRequest, conflict, unauthorized } from '../../utils/errors';
import { registerSchema, loginSchema } from './auth.schemas';

const router = Router();

interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
}

function toPublicUser(row: Pick<UserRow, 'id' | 'name' | 'email'>) {
  return { id: row.id, name: row.name, email: row.email };
}

function issueToken(userId: number): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '7d' });
}

router.post('/register', async (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    next(
      badRequest(
        'Validation failed',
        parsed.error.issues.map((issue) => ({ field: String(issue.path[0]), message: issue.message })),
      ),
    );
    return;
  }
  const { name, email, password } = parsed.data;

  try {
    const existing = await db<UserRow>('users').where({ email }).first();
    if (existing) {
      next(conflict('Email already registered'));
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [id] = await db('users').insert({ name, email, password_hash: passwordHash });
    res.status(201).json({ user: { id, name, email }, token: issueToken(id) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    next(
      badRequest(
        'Validation failed',
        parsed.error.issues.map((issue) => ({ field: String(issue.path[0]), message: issue.message })),
      ),
    );
    return;
  }
  const { email, password } = parsed.data;

  try {
    const user = await db<UserRow>('users').where({ email }).first();
    if (!user) {
      next(unauthorized());
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      next(unauthorized());
      return;
    }

    res.status(200).json({ user: toPublicUser(user), token: issueToken(user.id) });
  } catch (err) {
    next(err);
  }
});

export default router;
