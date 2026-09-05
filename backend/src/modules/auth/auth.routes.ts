/**
 * Auth routes: sign up, log in, and email verification.
 *
 * These are the endpoints that let someone create an account, prove who
 * they are, and confirm their email address. A successful register or
 * login hands back a JWT, which the frontend then sends back on every
 * later request (as an `Authorization: Bearer <token>` header) to say
 * "this is who I am".
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../db/knex';
import { env } from '../../config/env';
import { requireAuth } from '../../middleware/auth';
import { badRequest, conflict, unauthorized } from '../../utils/errors';
import { registerSchema, loginSchema } from './auth.schemas';
import { createVerificationToken, hashToken } from './email-verification';
import { sendVerificationEmail } from './mailer';

const router = Router();

interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | string | null;
}

function toPublicUser(row: Pick<UserRow, 'id' | 'name' | 'email' | 'email_verified_at'>) {
  return { id: row.id, name: row.name, email: row.email, emailVerified: row.email_verified_at !== null };
}

async function issueVerificationEmail(userId: number, email: string): Promise<void> {
  const rawToken = await createVerificationToken(userId);
  sendVerificationEmail(email, `${env.frontendUrl}/verify-email?token=${rawToken}`);
}

function issueToken(userId: number): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '7d' });
}

/**
 * POST /api/auth/register
 *
 * Creates a new account: checks the email isn't already taken, hashes the
 * password (never stores it as plain text), saves the user, and kicks off
 * an email-verification link in the background. The account can be used
 * (logged into) right away — it doesn't have to be verified first.
 *
 * Responds with the new user's public details plus a login token.
 */
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
    await issueVerificationEmail(id, email);
    res.status(201).json({ user: { id, name, email, emailVerified: false }, token: issueToken(id) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 *
 * Checks the email/password against what's stored and, if they match,
 * hands back a fresh login token. On purpose, a wrong email and a wrong
 * password give back the exact same error message — that way nobody can
 * use this endpoint to guess which emails have an account.
 */
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

/**
 * POST /api/auth/verify-email
 *
 * Confirms an email address using the one-time token from the link sent
 * during registration (or a resend). If the token matches a record that
 * hasn't expired, the account is marked verified and the token is deleted
 * so it can't be reused.
 *
 * Not auth-gated: the token itself (delivered only via the emailed link) is
 * the proof of identity here, same as a password-reset link.
 */
router.post('/verify-email', async (req, res, next) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (!token) {
    next(badRequest('Validation failed', [{ field: 'token', message: 'token is required' }]));
    return;
  }

  try {
    const record = await db<{ id: number; user_id: number; token_hash: string; expires_at: Date | string }>(
      'email_verifications',
    )
      .where({ token_hash: hashToken(token) })
      .first();

    if (!record || new Date(record.expires_at).getTime() < Date.now()) {
      next(badRequest('Verification link is invalid or has expired'));
      return;
    }

    await db.transaction(async (trx) => {
      await trx('users').where({ id: record.user_id }).update({ email_verified_at: trx.fn.now() });
      await trx('email_verifications').where({ id: record.id }).delete();
    });

    res.status(200).json({ verified: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/resend-verification (login required)
 *
 * Sends a brand new verification link to the logged-in user's own email
 * address, replacing any earlier link that hasn't been used yet. Does
 * nothing (and returns an error) if the account is already verified.
 */
router.post('/resend-verification', requireAuth, async (req, res, next) => {
  try {
    const user = await db<UserRow>('users').where({ id: req.userId }).first();
    if (!user) {
      next(unauthorized());
      return;
    }
    if (user.email_verified_at) {
      next(conflict('Email is already verified'));
      return;
    }
    await issueVerificationEmail(user.id, user.email);
    res.status(200).json({ message: 'Verification email sent' });
  } catch (err) {
    next(err);
  }
});

export default router;
