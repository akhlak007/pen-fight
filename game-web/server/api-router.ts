import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ProfileSnapshot } from '../src/app/app-state';
import { AccountError } from './account-store';
import type { AccountRepository } from './account-repository';

const COOKIE = 'penfight_session';
const BODY_LIMIT = 32 * 1024;

function json(response: ServerResponse, status: number, value: unknown, extraHeaders: Record<string, string> = {}): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extraHeaders });
  response.end(JSON.stringify(value));
}

function tokenFromCookie(request: IncomingMessage): string | undefined {
  const cookies = request.headers.cookie?.split(';') ?? [];
  for (const cookie of cookies) {
    const [name, ...parts] = cookie.trim().split('=');
    if (name === COOKIE) return decodeURIComponent(parts.join('='));
  }
  return undefined;
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > BODY_LIMIT) throw new AccountError('body_too_large', 'Request is too large.', 413);
    chunks.push(buffer);
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object required');
    return parsed as Record<string, unknown>;
  } catch {
    throw new AccountError('invalid_json', 'Request body must be valid JSON.');
  }
}

function requireProfile(value: unknown): ProfileSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AccountError('invalid_profile', 'Profile is required.');
  return value as ProfileSnapshot;
}

export interface ApiRouterOptions { secureCookies?: boolean; allowCrossPortOrigin?: boolean }

export class ApiRouter {
  readonly #attempts = new Map<string, { count: number; started: number }>();

  constructor(readonly accounts: AccountRepository, private readonly options: ApiRouterOptions = {}) {}

  async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      if (!url.pathname.startsWith('/api/')) throw new AccountError('not_found', 'Not found.', 404);
      if (request.method !== 'GET') this.#requireSameOrigin(request);
      const token = tokenFromCookie(request);
      const account = await this.accounts.accountForSession(token);

      if (url.pathname === '/api/auth/signup' && request.method === 'POST') {
        const body = await readJson(request);
        this.#rateLimit(request, 'signup', String(body.username ?? ''));
        const result = await this.accounts.signup(String(body.username ?? ''), String(body.password ?? ''), requireProfile(body.profile));
        json(response, 201, { account: result.account }, { 'set-cookie': this.#sessionCookie(result.token) });
        return;
      }
      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        const body = await readJson(request);
        this.#rateLimit(request, 'login', String(body.username ?? ''));
        const result = await this.accounts.login(String(body.username ?? ''), String(body.password ?? ''));
        json(response, 200, { account: result.account }, { 'set-cookie': this.#sessionCookie(result.token) });
        return;
      }
      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        await this.accounts.logout(token);
        response.writeHead(204, { 'cache-control': 'no-store', 'set-cookie': this.#clearCookie() });
        response.end();
        return;
      }
      if (url.pathname === '/api/auth/me' && request.method === 'GET') {
        json(response, 200, { account });
        return;
      }
      if (url.pathname === '/api/profile' && request.method === 'PATCH') {
        if (!account) throw new AccountError('authentication_required', 'Sign in to synchronize progress.', 401);
        const body = await readJson(request);
        json(response, 200, { account: await this.accounts.updateProfile(account.id, requireProfile(body.profile)) });
        return;
      }
      if (url.pathname === '/api/leaderboard' && request.method === 'GET') {
        const offset = Number(url.searchParams.get('offset') ?? 0);
        const limit = Number(url.searchParams.get('limit') ?? 50);
        json(response, 200, await this.accounts.leaderboard(Number.isFinite(offset) ? offset : 0, Number.isFinite(limit) ? limit : 50, account?.id));
        return;
      }
      if (['/api/auth/signup', '/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/profile', '/api/leaderboard'].includes(url.pathname)) {
        throw new AccountError('method_not_allowed', 'That request method is not allowed.', 405);
      }
      throw new AccountError('not_found', 'API route not found.', 404);
    } catch (error) {
      const failure = error instanceof AccountError
        ? error
        : new AccountError('server_error', 'The classroom server had a problem.', 500);
      json(response, failure.status, { error: { code: failure.code, message: failure.message } });
    }
  }

  #requireSameOrigin(request: IncomingMessage): void {
    const origin = request.headers.origin;
    if (!origin) return;
    try {
      const parsed = new URL(origin);
      const requestHost = request.headers.host ?? '';
      const allowed = this.options.allowCrossPortOrigin
        ? parsed.hostname === requestHost.split(':')[0]
        : parsed.host === requestHost;
      if (!allowed || !['http:', 'https:'].includes(parsed.protocol)) throw new Error('cross origin');
    } catch {
      throw new AccountError('forbidden_origin', 'This request did not come from the game.', 403);
    }
  }

  #rateLimit(request: IncomingMessage, action: string, username: string): void {
    const now = Date.now();
    const keys = [
      `ip:${request.socket.remoteAddress ?? 'unknown'}:${action}`,
      `username:${username.trim().toLocaleLowerCase('en-US')}:${action}`,
    ];
    for (const key of keys) {
      const entry = this.#attempts.get(key);
      if (!entry || now - entry.started >= 60_000) {
        this.#attempts.set(key, { count: 1, started: now });
        continue;
      }
      entry.count += 1;
      if (entry.count > 10) throw new AccountError('rate_limited', 'Too many attempts. Try again in a minute.', 429);
    }
  }

  #sessionCookie(token: string): string {
    return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${this.options.secureCookies ? '; Secure' : ''}`;
  }

  #clearCookie(): string {
    return `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${this.options.secureCookies ? '; Secure' : ''}`;
  }
}
