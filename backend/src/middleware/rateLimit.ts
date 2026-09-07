import rateLimit from 'express-rate-limit';
import { tooManyRequests } from '../utils/errors';

// keeps 429s in the same { error: { message } } envelope as everything else
function limitExceeded(_req: unknown, _res: unknown, next: (err: unknown) => void): void {
  next(tooManyRequests());
}

export const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitExceeded,
});

export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: limitExceeded,
});

// factory, not a shared instance — each call gets its own counter store,
// so two routes using this don't share one IP-keyed rate-limit budget
function createTwoFactorLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: limitExceeded,
  });
}

// layered on top of authLimiter, not instead of it; separate instances so
// exhausting one (enable vs. verify) doesn't block the other
export const twoFactorEnableLimiter = createTwoFactorLimiter();
export const twoFactorVerifyLimiter = createTwoFactorLimiter();
