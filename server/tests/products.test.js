import { describe, expect, it } from 'vitest';
import { api, makeProduct, makeUser } from './helpers.js';

describe('REST product catalogue', () => {
  it('shows shoppers listed products only, even if they ask for others', async () => {
    await makeProduct({ name: 'Listed Tablet', category: 'tablets' });
    await makeProduct({ name: 'Draft Tablet', category: 'tablets', status: 'unlisted' });

    const res = await (await api()).get('/api/products').query({ status: 'all', category: 'tablets' });

    expect(res.status).toBe(200);
    expect(res.body.products.map((p) => p.name)).toEqual(['Listed Tablet']);
  });

  it('lets staff inventory screens see every status', async () => {
    const { auth } = await makeUser({ role: 'admin' });
    await makeProduct({ name: 'Listed Tablet', category: 'tablets' });
    await makeProduct({ name: 'Draft Tablet', category: 'tablets', status: 'unlisted' });

    const res = await (await api()).get('/api/products').set(auth).query({ status: 'all', category: 'tablets' });

    expect(res.body.products).toHaveLength(2);
  });

  it.each([
    [{ limit: 1000 }, 'limit'],
    [{ page: 0 }, 'page'],
    [{ category: 'toasters' }, 'category'],
    [{ sort: '$where' }, 'sort'],
    [{ minPrice: 500, maxPrice: 100 }, 'minPrice'],
  ])('rejects the query %o', async (query, field) => {
    const res = await (await api()).get('/api/products').query(query);

    expect(res.status).toBe(400);
    expect(res.body.fields).toHaveProperty([field]);
  });

  it('answers a malformed id with 400 and an unknown one with 404', async () => {
    const http = await api();
    expect((await http.get('/api/products/<script>')).status).toBe(400);
    expect((await http.get('/api/products/64b7f0c2a1b2c3d4e5f60718')).status).toBe(404);
  });
});
