import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../src/app/app-state';
import { createRoomServer } from './room-server';
import { runtimeConfig } from './runtime-config';

describe('production deployment', () => {
  const directories: string[] = [];
  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  it('persists registered players in DATA_DIR across a server restart', async () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), 'pen-fight-render-'));
    directories.push(dataDirectory);
    const options = runtimeConfig({
      args: ['node', 'server/index.ts', '--production'],
      env: { PORT: '0', DATA_DIR: dataDirectory, NODE_ENV: 'production' },
    });
    const first = createRoomServer(options);
    const firstPort = await first.listen();
    const firstBase = `http://127.0.0.1:${firstPort}`;
    const signup = await fetch(`${firstBase}/api/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: firstBase },
      body: JSON.stringify({ username: 'RenderPlayer', password: 'render-password', profile: createInitialState().profile }),
    });
    expect(signup.status).toBe(201);
    await first.close();

    expect(existsSync(join(dataDirectory, 'pen-fight.sqlite'))).toBe(true);
    const second = createRoomServer(options);
    try {
      const secondPort = await second.listen();
      const health = await fetch(`http://127.0.0.1:${secondPort}/health`);
      const leaderboard = await fetch(`http://127.0.0.1:${secondPort}/api/leaderboard`);
      expect(await health.json()).toEqual({ ok: true });
      expect(await leaderboard.json()).toMatchObject({ total: 1, entries: [{ username: 'RenderPlayer' }] });
    } finally {
      await second.close();
    }
  });
});
