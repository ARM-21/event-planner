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
import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { requireAuth } from '../../middleware/auth';
import { badRequest, conflict, unauthorized } from '../../utils/errors';
import { registerSchema, loginSchema } from './auth.schemas';
import { createVerificationToken, consumeVerificationToken } from './email-verification';
import { sendVerificationEmail } from './mailer';
import { toPublicUser, findUserByEmail, findUserById, createUser, incrementTokenVersion } from './auth.service';

const router = Router();

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/auth';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function issueVerificationEmail(userId: number, email: string): Promise<void> {
  const rawToken = await createVerificationToken(userId);
  sendVerificationEmail(email, `${env.frontendUrl}/verify-email?token=${rawToken}`);
}

// Access tokens are short-lived and sent in the response body (kept in
// memory/localStorage by the frontend); refresh tokens are longer-lived
// and only ever travel as an httpOnly cookie, never readable by JS. Both
// carry `ver` (the user's current `token_version`) so bumping that column
// invalidates every outstanding refresh token immediately — see `logout`
// below — and both carry `type` so one can't be used in place of the
// other (checked in `middleware/auth.ts` and the `/refresh` route).
function issueTokens(userId: number, tokenVersion: number): { accessToken: string; refreshToken: string } {
  const accessToken = jwt.sign({ sub: userId, ver: tokenVersion, type: 'access' }, env.jwtSecret, {
    expiresIn: '15m',
  });
  const refreshToken = jwt.sign({ sub: userId, ver: tokenVersion, type: 'refresh' }, env.jwtSecret, {
    expiresIn: '30d',
  });
  return { accessToken, refreshToken };
}

function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    // Only `Secure` in production (dev runs over plain http, where a
    // Secure cookie would just never be sent). `SameSite: 'none'` needs
    // `Secure` per spec, so the two are tied to the same condition; `lax`
    // is fine for dev since frontend/backend differ only by port, which
    // doesn't count as cross-site.
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
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
    const existing = await findUserByEmail(email);
    if (existing) {
      next(conflict('Email already registered'));
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = await createUser({ name, email, passwordHash });
    await issueVerificationEmail(id, email);
    const { accessToken, refreshToken } = issueTokens(id, 0);
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ user: { id, name, email, emailVerified: false }, token: accessToken });
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
    const user = await findUserByEmail(email);
    if (!user) {
      next(unauthorized());
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      next(unauthorized());
      return;
    }

    const { accessToken, refreshToken } = issueTokens(user.id, user.token_version);
    setRefreshCookie(res, refreshToken);
    res.status(200).json({ user: toPublicUser(user), token: accessToken });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/refresh
 *
 * Trades a still-valid refresh cookie for a fresh access token, so the
 * frontend never has to bounce someone to the login page just because
 * their 15-minute access token expired while they were still using the
 * app. Not gated by `requireAuth` — identity comes entirely from the
 * cookie itself, which is the point of a refresh endpoint.
 *
 * Also rotates the refresh cookie itself (sliding expiry): an active
 * user's session keeps extending 30 days from their last refresh instead
 * of hard-expiring 30 days after they first logged in.
 */
router.post('/refresh', async (req, res, next) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (typeof token !== 'string') {
    next(unauthorized('No refresh token'));
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (typeof payload === 'string' || payload.type !== 'refresh') {
      next(unauthorized('Invalid or expired refresh token'));
      return;
    }

    const userId = Number(payload.sub);
    if (!payload.sub || Number.isNaN(userId)) {
      next(unauthorized('Invalid or expired refresh token'));
      return;
    }

    const user = await findUserById(userId);
    // A version mismatch means this token was revoked by a `logout` (or
    // any future action that bumps `token_version`) after it was issued.
    if (!user || payload.ver !== user.token_version) {
      next(unauthorized('Invalid or expired refresh token'));
      return;
    }

    const { accessToken, refreshToken } = issueTokens(user.id, user.token_version);
    setRefreshCookie(res, refreshToken);
    res.status(200).json({ token: accessToken });
  } catch {
    next(unauthorized('Invalid or expired refresh token'));
  }
});

/**
 * POST /api/auth/logout
 *
 * Bumps the caller's `token_version`, which immediately invalidates every
 * refresh token issued to them (including the one this request is using)
 * — real server-side revocation, not just "the frontend forgot the
 * token". Not gated by `requireAuth`: this should still work even if the
 * caller's access token already expired, since forgetting a long-lived
 * refresh token behind is exactly the case logout needs to cover.
 *
 * Identity is read from the refresh cookie with `ignoreExpiration` so an
 * expired-but-correctly-signed cookie can still be attributed to a user
 * and revoked; a missing or invalid cookie just means there's nothing to
 * revoke (same no-op-if-nothing-to-do shape as `DELETE /events/:id/rsvp`).
 */
router.post('/logout', async (req, res, next) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  try {
    if (typeof token === 'string') {
      try {
        const payload = jwt.verify(token, env.jwtSecret, { ignoreExpiration: true });
        const userId = typeof payload !== 'string' ? Number(payload.sub) : NaN;
        if (!Number.isNaN(userId)) {
          await incrementTokenVersion(userId);
        }
      } catch {
        // Malformed/unsigned cookie — nothing we can attribute or revoke.
      }
    }
    clearRefreshCookie(res);
    res.status(204).send();
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
    const consumed = await consumeVerificationToken(token);
    if (!consumed) {
      next(badRequest('Verification link is invalid or has expired'));
      return;
    }

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
    const user = req.userId ? await findUserById(req.userId) : undefined;
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
