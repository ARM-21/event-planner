/**
 * Rate limiting — caps how many requests a single IP address can make in
 * a given time window, to stop one client (or a script) from hammering
 * the API or brute-forcing logins. Two limiters are exported: a loose one
 * for the API in general, and a much tighter one specifically for the
 * auth endpoints, where guessing passwords is the real risk.
 */

import rateLimit from 'express-rate-limit';
import { tooManyRequests } from '../utils/errors';

// express-rate-limit calls this instead of sending its own default body,
// keeping 429s in the same { error: { message } } envelope as everything else.
function limitExceeded(_req: unknown, _res: unknown, next: (err: unknown) => void): void {
  next(tooManyRequests());
}

// Applied to all /api routes: generous enough not to bother real usage, just
// a backstop against runaway clients/scripts.
export const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitExceeded,
});

// Applied only to credential-guessing surfaces (login/register/verification)
// where brute-forcing is the actual threat, so the limit needs to bite much
// sooner than the general API limiter.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: limitExceeded,
});
