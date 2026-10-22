import { describe, expect, it } from 'vitest';
import { runtimeConfig } from './runtime-config';

describe('production runtime configuration', () => {
  it('uses Render port, Neon database, and secure cookies', () => {
    const config = runtimeConfig({
      args: ['node', 'server/index.ts', '--production'],
      env: { PORT: '10000', DATABASE_URL: 'postgresql://neon.example/penfight', NODE_ENV: 'production' },
      cwd: '/opt/render/project/src/game-web',
    });

    expect(config).toMatchObject({
      port: 10000,
      host: '0.0.0.0',
      databaseUrl: 'postgresql://neon.example/penfight',
      allowCrossPortOrigin: false,
      secureCookies: true,
    });
  });

  it('fails clearly when production has no persistent database', () => {
    expect(() => runtimeConfig({
      args: ['node', 'server/index.ts', '--production'],
      env: { NODE_ENV: 'production' },
    })).toThrow(/DATABASE_URL is required/);
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
