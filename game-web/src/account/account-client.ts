import type { AccountSnapshot, LeaderboardPage } from './account-types';
import type { ProfileSnapshot } from '../app/app-state';

export type AccountStatus = 'checking' | 'guest' | 'authenticated' | 'offline';
export interface AccountState {
  readonly status: AccountStatus;
  readonly account?: AccountSnapshot;
  readonly syncing?: boolean;
  readonly error?: string;
}

type Fetcher = typeof fetch;
type Listener = (state: AccountState) => void;

export class AccountClient {
  #state: AccountState = { status: 'checking' };
  #restoreVersion = 0;
  readonly #listeners = new Set<Listener>();

  constructor(private readonly fetcher: Fetcher = globalThis.fetch.bind(globalThis)) {}

  get state(): AccountState { return this.#state; }

  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  async restore(): Promise<AccountSnapshot | null> {
    const version = this.#restoreVersion;
    try {
      const data = await this.#request<{ account: AccountSnapshot | null }>('/api/auth/me');
      if (version !== this.#restoreVersion) return null;
      this.#set(data.account ? { status: 'authenticated', account: data.account } : { status: 'guest' });
      return data.account;
    } catch (error) {
      if (version !== this.#restoreVersion) return null;
      this.#set({ status: 'offline', error: this.#message(error) });
      return null;
    }
  }

  async signup(username: string, password: string, profile: ProfileSnapshot): Promise<AccountSnapshot> {
    const data = await this.#request<{ account: AccountSnapshot }>('/api/auth/signup', { method: 'POST', body: JSON.stringify({ username, password, profile }) });
    this.#restoreVersion += 1;
    this.#set({ status: 'authenticated', account: data.account });
    return data.account;
  }

  async login(username: string, password: string): Promise<AccountSnapshot> {
    const data = await this.#request<{ account: AccountSnapshot }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    this.#restoreVersion += 1;
    this.#set({ status: 'authenticated', account: data.account });
    return data.account;
  }

  async logout(): Promise<void> {
    await this.#request<undefined>('/api/auth/logout', { method: 'POST' }, true);
    this.#restoreVersion += 1;
    this.#set({ status: 'guest' });
  }

  async syncProfile(profile: ProfileSnapshot): Promise<AccountSnapshot | null> {
    if (this.#state.status !== 'authenticated' || !this.#state.account) return null;
    this.#set({ ...this.#state, syncing: true, error: undefined });
    try {
      const data = await this.#request<{ account: AccountSnapshot }>('/api/profile', { method: 'PATCH', body: JSON.stringify({ profile }) });
      this.#set({ status: 'authenticated', account: data.account, syncing: false });
      return data.account;
    } catch (error) {
      this.#set({ ...this.#state, syncing: false, error: this.#message(error) });
      return null;
    }
  }

  leaderboard(offset = 0, limit = 50): Promise<LeaderboardPage> {
    return this.#request<LeaderboardPage>(`/api/leaderboard?offset=${Math.max(0, offset)}&limit=${Math.max(1, Math.min(50, limit))}`);
  }

  async #request<T>(url: string, init: RequestInit = {}, empty = false): Promise<T> {
    const response = await this.fetcher(url, {
      credentials: 'include',
      ...init,
      headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
    });
    if (empty && response.ok) return undefined as T;
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } } & T;
    if (!response.ok) throw new Error(body.error?.message ?? 'Account request failed.');
    return body;
  }

  #message(error: unknown): string { return error instanceof Error ? error.message : 'Account server is unavailable.'; }
  #set(state: AccountState): void { this.#state = state; for (const listener of this.#listeners) listener(state); }
}
