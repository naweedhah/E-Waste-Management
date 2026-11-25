import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

// Normalises IPv6 addresses to their /56 prefix so one client cannot rotate addresses.
const ip = (req) => ipKeyGenerator(req.ip);

const isTest = () => process.env.NODE_ENV === 'test' && !process.env.ENABLE_RATE_LIMIT_IN_TESTS;

const limiter = (options) =>
  rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: isTest,
    handler: (req, res, next, opts) =>
      res.status(opts.statusCode).json({ success: false, message: opts.message }),
    ...options,
  });

/** Password guessing: 10 attempts per 15 minutes per IP + email. */
export const loginLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => `${ip(req)}:${String(req.body?.email || '').toLowerCase()}`,
  message: 'Too many login attempts. Please wait 15 minutes and try again.',
});

/**
 * 6-digit codes have only a million possibilities, so guessing must be throttled hard:
 * 5 attempts per 15 minutes per IP (and per account where we know it).
 */
export const otpLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => `${ip(req)}:${req.user?.id || String(req.body?.email || '').toLowerCase()}`,
  message: 'Too many code attempts. Please wait 15 minutes and request a new code.',
});

/** Sign-ups and "send me a code" emails: stops one client from spamming inboxes. */
export const emailSendLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: 'Too many requests. Please try again later.',
});
