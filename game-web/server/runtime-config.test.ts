import { describe, expect, it } from 'vitest';
import { join, resolve } from 'node:path';
import { runtimeConfig } from './runtime-config';

describe('production runtime configuration', () => {
  it('uses Render port, persistent data directory, and secure cookies', () => {
    const config = runtimeConfig({
      args: ['node', 'server/index.ts', '--production'],
      env: { PORT: '10000', DATA_DIR: '/var/data', NODE_ENV: 'production' },
      cwd: '/opt/render/project/src/game-web',
    });

    expect(config).toMatchObject({
      port: 10000,
      host: '0.0.0.0',
      accountDatabase: join(resolve('/opt/render/project/src/game-web', '/var/data'), 'pen-fight.sqlite'),
      allowCrossPortOrigin: false,
      secureCookies: true,
    });
  });

  it('keeps local development data local and allows its split ports', () => {
    const config = runtimeConfig({ args: ['node', 'server/index.ts'], env: {}, cwd: 'C:/pen-fight/game-web' });

    expect(config).toMatchObject({
      port: 4174,
      allowCrossPortOrigin: true,
      secureCookies: false,
    });
    expect(config.accountDatabase).toContain('data');
  });
});
