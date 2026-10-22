import type { ProfileSnapshot } from '../app/app-state';

export interface AccountSnapshot {
  readonly id: string;
  readonly username: string;
  readonly profile: ProfileSnapshot;
}

export interface LeaderboardEntry {
  readonly rank: number;
  readonly playerId: string;
  readonly username: string;
  readonly avatarId: string;
  readonly flagCode: string;
  readonly xp: number;
  readonly level: number;
  readonly wins: number;
  readonly matches: number;
  readonly winRate: number;
}

export interface LeaderboardPage {
  readonly entries: readonly LeaderboardEntry[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
  readonly currentRank?: number;
}

export interface AccountApiError {
  readonly error: { readonly code: string; readonly message: string };
}
