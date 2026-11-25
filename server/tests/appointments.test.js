import { describe, expect, it } from 'vitest';
import Appointment from '../models/Appointment.js';
import { api, dayFromNow, makeUser } from './helpers.js';

const booking = (overrides = {}) => ({
  date: dayFromNow(3),
  timeSlot: '9:00 AM - 11:00 AM',
  branch: 'Kandy City',
  items: [{ itemName: 'Old laptop', quantity: 1 }],
  ...overrides,
});

describe('drop-off appointments', () => {
  it('gives a slot to exactly one customer when two book it at the same moment', async () => {
    const [a, b, c] = await Promise.all([makeUser(), makeUser(), makeUser()]);
    const http = await api();

    const results = await Promise.all(
      [a, b, c].map(({ auth }) => http.post('/api/appointments').set(auth).send(booking())),
    );

    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await Appointment.countDocuments()).toBe(1);
  });

  it('frees the slot again once the booking is cancelled', async () => {
    const first = await makeUser();
    const second = await makeUser();
    const http = await api();

    const created = await http.post('/api/appointments').set(first.auth).send(booking());
    expect(created.status).toBe(201);
    await Appointment.updateOne({ _id: created.body.appointment._id }, { status: 'Cancelled' });

    expect((await http.post('/api/appointments').set(second.auth).send(booking())).status).toBe(201);
  });

  it.each([
    ['a date in the past', { date: dayFromNow(-1) }, 'date'],
    ['a date too far ahead', { date: dayFromNow(90) }, 'date'],
    ['an impossible date', { date: `${dayFromNow(10).slice(0, 7)}-32` }, 'date'],
    ['an unknown branch', { branch: 'Jaffna Secret Branch' }, 'branch'],
    ['an invented time slot', { timeSlot: '3:00 AM - 4:00 AM' }, 'timeSlot'],
    ['no items', { items: [] }, 'items'],
    ['a zero quantity', { items: [{ itemName: 'Phone', quantity: 0 }] }, 'items.0.quantity'],
  ])('rejects %s', async (_label, override, field) => {
    const { auth } = await makeUser();

    const res = await (await api()).post('/api/appointments').set(auth).send(booking(override));

    expect(res.status).toBe(400);
    expect(res.body.fields).toHaveProperty([field]);
  });
});
