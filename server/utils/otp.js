import crypto from 'crypto';

/** 6-digit one-time code from a cryptographically secure source (not Math.random). */
export const generateOTP = () => crypto.randomInt(100000, 1000000).toString();

/**
 * One-time codes are stored hashed, like passwords, so a database leak does not hand out
 * working verification or password-reset codes. A keyed HMAC (with the JWT secret as pepper)
 * stops anyone holding only the database from brute-forcing the 10^6 possible codes offline.
 */
export const hashOTP = (code) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET || 'dev-only-secret').update(String(code)).digest('hex');

/** Constant-time comparison of a submitted code with a stored hash. */
export const otpMatches = (code, storedHash) => {
  if (!code || !storedHash) return false;
  const a = Buffer.from(hashOTP(code), 'hex');
  const b = Buffer.from(String(storedHash), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
