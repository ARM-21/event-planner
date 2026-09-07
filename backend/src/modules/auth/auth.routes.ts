import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { requireAuth } from '../../middleware/auth';
import { twoFactorEnableLimiter, twoFactorVerifyLimiter } from '../../middleware/rateLimit';
import { badRequest, conflict, unauthorized } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { zodIssuesToDetails } from '../../utils/validation';
import {
  registerSchema,
  loginSchema,
  enableTwoFactorSchema,
  verifyTwoFactorSchema,
  disableTwoFactorSchema,
} from './auth.schemas';
import { createVerificationToken, consumeVerificationToken } from './email-verification';
import { sendVerificationEmail } from '../../services/mailer';
import {
  toPublicUser,
  findUserByEmail,
  findUserById,
  createUser,
  setTotpSecret,
  enableTwoFactor,
  disableTwoFactor,
} from './auth.service';
import { createRefreshToken, rotateRefreshToken, revokeRefreshToken, type SessionMeta } from './refresh-tokens.service';
import { generateTotpSecret, generateTotpQrCode, verifyTotpCode, getCurrentTotpCode } from './totp';

const router = Router();

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/auth';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

async function issueVerificationEmail(userId: number, email: string): Promise<void> {
  const rawToken = await createVerificationToken(userId);
  await sendVerificationEmail(email, `${env.frontendUrl}/verify-email?token=${rawToken}`);
}

function issueAccessToken(userId: number): string {
  return jwt.sign({ sub: userId, type: 'access' }, env.jwtSecret, { expiresIn: '15m' });
}

// Issued after password check on a 2FA account; short-lived and rejected
// by requireAuth, only accepted by POST /2fa/verify.
function issuePreAuthToken(userId: number): string {
  return jwt.sign({ sub: userId, type: 'pre_auth' }, env.jwtSecret, { expiresIn: '5m' });
}

function sessionMeta(req: Request): SessionMeta {
  const ua = req.headers['user-agent'];
  return { deviceLabel: typeof ua === 'string' ? ua.slice(0, 255) : null, ip: req.ip ?? null };
}

function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    // SameSite: 'none' requires Secure per spec; dev runs over http so both
    // are relaxed there (same-port-only difference doesn't count as cross-site).
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

// Access token + a new refresh_tokens row for this device, cookie set —
// the one path register/login/2fa-verify all share.
async function startSession(req: Request, res: Response, userId: number): Promise<string> {
  const accessToken = issueAccessToken(userId);
  const refreshToken = await createRefreshToken(userId, sessionMeta(req));
  setRefreshCookie(res, refreshToken);
  return accessToken;
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
    const existing = await findUserByEmail(email);
    if (existing) {
      next(conflict('Email already registered'));
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = await createUser({ name, email, passwordHash });
    await issueVerificationEmail(id, email);
    const accessToken = await startSession(req, res, id);
    res.status(201).json({ user: { id, name, email, emailVerified: false, twoFactorEnabled: false }, token: accessToken });
  } catch (err) {
    next(err);
  }
});

// Wrong email and wrong password return the same error, so this endpoint
// can't be used to enumerate registered emails.
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

    if (user.two_factor_enabled) {
      if (env.nodeEnv !== 'production' && user.totp_secret) {
        logger.info('[dev] 2FA code', { email: user.email, code: await getCurrentTotpCode(user.totp_secret) });
      }
      const preAuthToken = issuePreAuthToken(user.id);
      res.status(200).json({ twoFactorRequired: true, preAuthToken });
      return;
    }

    const accessToken = await startSession(req, res, user.id);
    res.status(200).json({ user: toPublicUser(user), token: accessToken });
  } catch (err) {
    next(err);
  }
});

// Generates and saves a pending TOTP secret without enabling 2FA yet —
// /2fa/enable confirms it actually reached an authenticator app first.
router.post('/2fa/setup', requireAuth, async (req, res, next) => {
  try {
    const user = req.userId ? await findUserById(req.userId) : undefined;
    if (!user) {
      next(unauthorized());
      return;
    }
    if (user.two_factor_enabled) {
      next(conflict('Two-factor authentication is already enabled'));
      return;
    }

    const secret = generateTotpSecret();
    await setTotpSecret(user.id, secret);
    const qrCodeDataUrl = await generateTotpQrCode(user.email, secret);
    if (env.nodeEnv !== 'production') {
      logger.info('[dev] 2FA code', { email: user.email, code: await getCurrentTotpCode(secret) });
    }
    res.status(200).json({ secret, qrCodeDataUrl });
  } catch (err) {
    next(err);
  }
});

router.post('/2fa/enable', twoFactorEnableLimiter, requireAuth, async (req, res, next) => {
  const parsed = enableTwoFactorSchema.safeParse(req.body);
  if (!parsed.success) {
    next(badRequest('Validation failed', zodIssuesToDetails(parsed.error)));
    return;
  }

  try {
    const user = req.userId ? await findUserById(req.userId) : undefined;
    if (!user) {
      next(unauthorized());
      return;
    }
    if (!user.totp_secret) {
      next(badRequest('Call /2fa/setup first'));
      return;
    }

    const valid = await verifyTotpCode(user.totp_secret, parsed.data.code);
    if (!valid) {
      next(unauthorized('Invalid code'));
      return;
    }

    await enableTwoFactor(user.id);
    res.status(200).json({ twoFactorEnabled: true });
  } catch (err) {
    next(err);
  }
});

// Requires the password (not just requireAuth) so a stolen access token
// alone can't strip 2FA off the account; password rather than a TOTP code
// so losing the authenticator device doesn't lock this out (no recovery
// codes in this version — see README).
router.post('/2fa/disable', requireAuth, async (req, res, next) => {
  const parsed = disableTwoFactorSchema.safeParse(req.body);
  if (!parsed.success) {
    next(badRequest('Validation failed', zodIssuesToDetails(parsed.error)));
    return;
  }

  try {
    const user = req.userId ? await findUserById(req.userId) : undefined;
    if (!user) {
      next(unauthorized());
      return;
    }

    const valid = await bcrypt.compare(parsed.data.password, user.password_hash);
    if (!valid) {
      next(unauthorized('Incorrect password'));
      return;
    }

    await disableTwoFactor(user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Second login step for 2FA accounts: trades a pre-auth token + TOTP code
// for a real token pair. Identity comes from the pre-auth token itself,
// so this isn't gated by requireAuth.
router.post('/2fa/verify', twoFactorVerifyLimiter, async (req, res, next) => {
  const parsed = verifyTwoFactorSchema.safeParse(req.body);
  if (!parsed.success) {
    next(badRequest('Validation failed', zodIssuesToDetails(parsed.error)));
    return;
  }
  const { preAuthToken, code } = parsed.data;

  try {
    const payload = jwt.verify(preAuthToken, env.jwtSecret);
    if (typeof payload === 'string' || payload.type !== 'pre_auth') {
      next(unauthorized('Invalid or expired 2FA session'));
      return;
    }
    const userId = Number(payload.sub);
    if (!payload.sub || Number.isNaN(userId)) {
      next(unauthorized('Invalid or expired 2FA session'));
      return;
    }

    const user = await findUserById(userId);
    if (!user || !user.two_factor_enabled || !user.totp_secret) {
      next(unauthorized('Invalid or expired 2FA session'));
      return;
    }

    const valid = await verifyTotpCode(user.totp_secret, code);
    if (!valid) {
      next(unauthorized('Invalid code'));
      return;
    }

    const accessToken = await startSession(req, res, user.id);
    res.status(200).json({ user: toPublicUser(user), token: accessToken });
  } catch {
    next(unauthorized('Invalid or expired 2FA session'));
  }
});

// Rotates the refresh cookie on every call, so an active session's expiry
// keeps sliding forward instead of hard-expiring 30 days after first login.
router.post('/refresh', async (req, res, next) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (typeof token !== 'string') {
    next(unauthorized('No refresh token'));
    return;
  }

  try {
    const result = await rotateRefreshToken(token, sessionMeta(req));

    if (result.status === 'reused') {
      clearRefreshCookie(res);
      next(unauthorized('Refresh token reuse detected — all sessions revoked, please log in again'));
      return;
    }
    if (result.status === 'invalid') {
      next(unauthorized('Invalid or expired refresh token'));
      return;
    }

    setRefreshCookie(res, result.rawToken);
    res.status(200).json({ token: issueAccessToken(result.userId) });
  } catch (err) {
    next(err);
  }
});

// Revokes only this device's refresh_tokens row, not every session — other
// logged-in devices stay signed in. Not requireAuth-gated: still needs to
// work with an expired access token, since forgetting a long-lived refresh
// cookie behind is exactly the case logout needs to cover.
router.post('/logout', async (req, res, next) => {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  try {
    if (typeof token === 'string') {
      await revokeRefreshToken(token);
    }
    clearRefreshCookie(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

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
