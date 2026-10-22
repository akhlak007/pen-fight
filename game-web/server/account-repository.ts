import type { AccountSnapshot, LeaderboardPage } from '../src/account/account-types';
import type { ProfileSnapshot } from '../src/app/app-state';

export interface SessionResult {
  readonly account: AccountSnapshot;
  readonly token: string;
}

export interface AccountRepository {
  initialize(): Promise<void>;
  close(): void | Promise<void>;
  healthy(): boolean | Promise<boolean>;
  signup(username: string, password: string, profile: ProfileSnapshot, now?: number): SessionResult | Promise<SessionResult>;
  login(username: string, password: string, now?: number): SessionResult | Promise<SessionResult>;
  accountForSession(token: string | undefined, now?: number): AccountSnapshot | null | Promise<AccountSnapshot | null>;
  logout(token: string | undefined): void | Promise<void>;
  updateProfile(playerId: string, profile: ProfileSnapshot, now?: number): AccountSnapshot | Promise<AccountSnapshot>;
  leaderboard(offset?: number, limit?: number, currentPlayerId?: string): LeaderboardPage | Promise<LeaderboardPage>;
}
