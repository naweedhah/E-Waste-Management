import { describe, expect, it, vi } from 'vitest';
import User from '../models/User.js';
import { api, makeUser } from './helpers.js';

// Capture the codes that would be emailed instead of sending anything.
const sent = vi.hoisted(() => ({ otp: null, reset: null }));
vi.mock('../utils/emailService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  sendOTPEmail: vi.fn(async (_to, otp) => { sent.otp = otp; }),
  sendWelcomeEmail: vi.fn(async () => {}),
  sendForgotPasswordEmail: vi.fn(async (_to, otp) => { sent.reset = otp; }),
}));

describe('registration and email verification', () => {
  it('stores the verification code hashed, and accepts only the right code', async () => {
    const http = await api();
    const reg = await http
      .post('/api/auth/register')
      .send({ name: 'Nimal Perera', email: 'Nimal@Example.com ', password: 'Recycle2026', phone: '0712345678' });

    expect(reg.status).toBe(201);
    const stored = await User.findOne({ email: 'nimal@example.com' }).select('+verificationOTP');
    expect(stored.verificationOTP).toMatch(/^[a-f0-9]{64}$/);
    expect(stored.verificationOTP).not.toBe(sent.otp);

    const auth = { Authorization: `Bearer ${reg.body.token}` };
    const wrong = sent.otp === '123456' ? '654321' : '123456';
    expect((await http.post('/api/auth/verify-otp').set(auth).send({ otp: wrong })).status).toBe(400);
    expect((await http.post('/api/auth/verify-otp').set(auth).send({ otp: sent.otp })).status).toBe(200);
    expect((await User.findOne({ email: 'nimal@example.com' })).isVerified).toBe(true);
  });

  it('rejects weak passwords and bad emails with per-field messages', async () => {
    const res = await (await api()).post('/api/auth/register').send({ name: 'N', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.fields).toHaveProperty('name');
    expect(res.body.fields).toHaveProperty('email');
    expect(res.body.fields.password.join(' ')).toMatch(/at least 8/);
  });

  it('does not reveal whether an email is registered when asking for a reset code', async () => {
    await makeUser({ email: 'known@example.com' });
    const http = await api();

    const known = await http.post('/api/auth/forgot-password').send({ email: 'known@example.com' });
    const unknown = await http.post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(unknown.body.message).toBe(known.body.message);
  });

  it('resets the password with the emailed code, and the code is single-use', async () => {
    await makeUser({ email: 'reset@example.com' });
    const http = await api();
    await http.post('/api/auth/forgot-password').send({ email: 'reset@example.com' });

    const body = { email: 'reset@example.com', otp: sent.reset, newPassword: 'NewPassword9' };
    expect((await http.post('/api/auth/reset-password').send(body)).status).toBe(200);
    expect((await http.post('/api/auth/reset-password').send(body)).status).toBe(400);
    expect((await http.post('/api/auth/login').send({ email: 'reset@example.com', password: 'NewPassword9' })).status).toBe(200);
  });

  it('keeps controller status codes instead of turning every error into a 500', async () => {
    await makeUser({ email: 'login@example.com' });

    const res = await (await api()).post('/api/auth/login').send({ email: 'login@example.com', password: 'WrongPassword1' });

    expect(res.status).toBe(401);
  });
});
