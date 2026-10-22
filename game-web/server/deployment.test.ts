import type { Pool } from 'pg';
import { newDb } from 'pg-mem';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/app/app-state';
import { PostgresAccountStore } from './postgres-account-store';
import { createRoomServer } from './room-server';
import { runtimeConfig } from './runtime-config';

describe('production deployment', () => {
  it('persists registered players in Postgres across a server restart', async () => {
    const database = newDb();
    const adapter = database.adapters.createPg();
    const options = runtimeConfig({
      args: ['node', 'server/index.ts', '--production'],
      env: { PORT: '0', DATABASE_URL: 'postgres://neon.test/penfight', NODE_ENV: 'production' },
    });
    const first = createRoomServer({
      ...options,
      accountRepository: new PostgresAccountStore('postgres://neon.test/penfight', {
        pool: new adapter.Pool() as unknown as Pool,
        advisoryLock: false,
        validateCatalog: false,
      }),
    });
    const firstPort = await first.listen();
    const firstBase = `http://127.0.0.1:${firstPort}`;
    const signup = await fetch(`${firstBase}/api/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: firstBase },
      body: JSON.stringify({ username: 'RenderPlayer', password: 'render-password', profile: createInitialState().profile }),
    });
    expect(signup.status).toBe(201);
    const cookie = signup.headers.get('set-cookie')?.split(';')[0] ?? '';
    await first.close();

    const second = createRoomServer({
      ...options,
      accountRepository: new PostgresAccountStore('postgres://neon.test/penfight', {
        pool: new adapter.Pool() as unknown as Pool,
        advisoryLock: false,
        validateCatalog: false,
      }),
    });
    try {
      const secondPort = await second.listen();
      const health = await fetch(`http://127.0.0.1:${secondPort}/health`);
      const leaderboard = await fetch(`http://127.0.0.1:${secondPort}/api/leaderboard`, { headers: { cookie } });
      expect(await health.json()).toEqual({ ok: true });
      expect(await leaderboard.json()).toMatchObject({ total: 1, entries: [{ username: 'RenderPlayer' }] });
    } finally {
      await second.close();
    }
  });
});
