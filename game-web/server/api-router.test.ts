import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../src/app/app-state';
import { createRoomServer } from './room-server';

describe('account API', () => {
  const servers: ReturnType<typeof createRoomServer>[] = [];
  afterEach(async () => Promise.all(servers.splice(0).map((server) => server.close())));

  it('signs up, restores, updates, ranks, and signs out a player', async () => {
    const server = createRoomServer({ port: 0, accountDatabase: ':memory:' });
    servers.push(server);
    const port = await server.listen();
    const base = `http://127.0.0.1:${port}`;
    const profile = { ...createInitialState().profile, xp: 200, wins: 2, matches: 3 };
    const signup = await fetch(`${base}/api/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ username: 'Rafi', password: 'password-1', profile }),
    });
    const cookie = signup.headers.get('set-cookie')?.split(';')[0] ?? '';

    expect(signup.status).toBe(201);
    expect(cookie).toMatch(/^penfight_session=/);
    expect(await signup.json()).toMatchObject({ account: { username: 'Rafi', profile: { xp: 200 } } });

    const me = await fetch(`${base}/api/auth/me`, { headers: { cookie } });
    expect(await me.json()).toMatchObject({ account: { username: 'Rafi' } });

    const updatedProfile = { ...profile, xp: 300, wins: 3, matches: 4 };
    const updated = await fetch(`${base}/api/profile`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie, origin: base },
      body: JSON.stringify({ profile: updatedProfile }),
    });
    expect(await updated.json()).toMatchObject({ account: { profile: { xp: 300, wins: 3 } } });

    const leaderboard = await fetch(`${base}/api/leaderboard?offset=0&limit=50`, { headers: { cookie } });
    expect(await leaderboard.json()).toMatchObject({ total: 1, currentRank: 1, entries: [{ rank: 1, username: 'Rafi', xp: 300 }] });

    const logout = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { cookie, origin: base } });
    expect(logout.status).toBe(204);
    const signedOut = await fetch(`${base}/api/auth/me`, { headers: { cookie } });
    expect(await signedOut.json()).toEqual({ account: null });
  });

  it('rejects a cross-origin account mutation', async () => {
    const server = createRoomServer({ port: 0, accountDatabase: ':memory:' });
    servers.push(server);
    const port = await server.listen();
    const response = await fetch(`http://127.0.0.1:${port}/api/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://attacker.invalid' },
      body: JSON.stringify({ username: 'Bad', password: 'password-1', profile: createInitialState().profile }),
    });

    expect(response.status).toBe(403);
  });

  it('allows the local development proxy origin only when cross-port origins are enabled', async () => {
    const server = createRoomServer({ port: 0, accountDatabase: ':memory:', allowCrossPortOrigin: true });
    servers.push(server);
    const port = await server.listen();
    const response = await fetch(`http://127.0.0.1:${port}/api/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:4173' },
      body: JSON.stringify({ username: 'DevPlayer', password: 'password-1', profile: createInitialState().profile }),
    });

    expect(response.status).toBe(201);
  });

  it('rate limits repeated authentication attempts and reports unsupported methods', async () => {
    const server = createRoomServer({ port: 0, accountDatabase: ':memory:' });
    servers.push(server);
    const port = await server.listen();
    const base = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base },
        body: JSON.stringify({ username: 'Target', password: 'wrong-password' }),
      });
      expect(response.status).toBe(401);
    }
    const limited = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ username: 'Target', password: 'wrong-password' }),
    });
    expect(limited.status).toBe(429);

    const method = await fetch(`${base}/api/leaderboard`, { method: 'POST', headers: { origin: base } });
    expect(method.status).toBe(405);
  });
});
