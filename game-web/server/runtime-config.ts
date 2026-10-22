import { join, resolve } from 'node:path';
import type { RoomServerOptions } from './room-server';

export interface RuntimeConfigInput {
  readonly args?: readonly string[];
  readonly env?: NodeJS.ProcessEnv;
  readonly cwd?: string;
}

export function runtimeConfig(input: RuntimeConfigInput = {}): RoomServerOptions {
  const args = input.args ?? process.argv;
  const env = input.env ?? process.env;
  const cwd = input.cwd ?? process.cwd();
  const production = args.includes('--production') || env.NODE_ENV === 'production';
  const requestedPort = Number(env.PORT ?? (production ? 4173 : 4174));
  const port = Number.isInteger(requestedPort) && requestedPort >= 0 && requestedPort <= 65_535 ? requestedPort : (production ? 4173 : 4174);
  const dataDirectory = resolve(cwd, env.DATA_DIR?.trim() || 'data');

  return {
    port,
    host: '0.0.0.0',
    accountDatabase: join(dataDirectory, 'pen-fight.sqlite'),
    allowCrossPortOrigin: !production,
    secureCookies: production && env.ALLOW_INSECURE_COOKIES !== 'true',
  };
}
