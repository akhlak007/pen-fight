import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/app/app-state';
import { AccountError, AccountStore } from './account-store';

const profile = (xp = 0, wins = 0, matches = 0) => ({
  ...createInitialState().profile,
  xp,
  wins,
  matches,
});

describe('account store', () => {
  it('creates an account, preserves imported progress, and restores a session', () => {
    const store = new AccountStore(':memory:');
    const created = store.signup('Rafi_7', 'strong-pass', profile(520, 4, 7));

    expect(created.account.username).toBe('Rafi_7');
    expect(created.account.profile).toMatchObject({ xp: 520, wins: 4, matches: 7 });
    expect(store.accountForSession(created.token)?.id).toBe(created.account.id);
    store.close();
  });

  it('enforces case-insensitive usernames and verifies passwords', () => {
    const store = new AccountStore(':memory:');
    store.signup('Nila', 'correct-horse', profile());

    expect(() => store.signup('nila', 'another-pass', profile())).toThrowError(AccountError);
    expect(store.login('NILA', 'correct-horse').account.username).toBe('Nila');
    expect(() => store.login('Nila', 'wrong-pass')).toThrowError(AccountError);
    store.close();
  });

  it('updates progression monotonically and persists profile selections', () => {
    const store = new AccountStore(':memory:');
    const created = store.signup('Mahi', 'password-123', profile(520, 2, 4));
    const updated = store.updateProfile(created.account.id, {
      ...created.account.profile,
      xp: 620,
      wins: 3,
      matches: 5,
      avatarId: 'artist',
      flagCode: 'CA',
      selectedPenId: 'red-comet',
    });

    expect(updated.profile).toMatchObject({ xp: 620, wins: 3, matches: 5, avatarId: 'artist', flagCode: 'CA', selectedPenId: 'red-comet' });
    expect(() => store.updateProfile(created.account.id, { ...updated.profile, xp: 1 })).toThrowError(AccountError);
    store.close();
  });

  it('preserves replay IDs and rejects impossible win totals', () => {
    const store = new AccountStore(':memory:');
    const created = store.signup('Keeper', 'password-123', {
      ...profile(100, 1, 2),
      awardedMatchIds: ['match-one'],
    });
    const updated = store.updateProfile(created.account.id, {
      ...created.account.profile,
      xp: 150,
      wins: 1,
      matches: 3,
      awardedMatchIds: ['match-two'],
    });

    expect(updated.profile.awardedMatchIds).toEqual(['match-one', 'match-two']);
    expect(() => store.updateProfile(created.account.id, { ...updated.profile, wins: 3, matches: 4 })).toThrowError(AccountError);
    expect(() => store.signup('Impossible', 'password-123', profile(0, 2, 1))).toThrowError(AccountError);
    store.close();
  });

  it('ranks every player by XP, wins, and account age with stable pagination', () => {
    const store = new AccountStore(':memory:');
    const first = store.signup('First', 'password-1', profile(900, 3, 5), 1000);
    store.signup('Winner', 'password-2', profile(900, 8, 10), 2000);
    store.signup('Latest', 'password-3', profile(900, 3, 6), 3000);
    store.signup('Rookie', 'password-4', profile(100, 1, 2), 4000);

    const pageOne = store.leaderboard(0, 2, first.account.id);
    const pageTwo = store.leaderboard(2, 2, first.account.id);

    expect(pageOne.entries.map((entry) => [entry.rank, entry.username])).toEqual([[1, 'Winner'], [2, 'First']]);
    expect(pageTwo.entries.map((entry) => [entry.rank, entry.username])).toEqual([[3, 'Latest'], [4, 'Rookie']]);
    expect(pageOne).toMatchObject({ total: 4, currentRank: 2 });
    store.close();
  });

  it('invalidates a session on logout', () => {
    const store = new AccountStore(':memory:');
    const created = store.signup('Logout', 'password-5', profile());
    store.logout(created.token);
    expect(store.accountForSession(created.token)).toBeNull();
    store.close();
  });

  it('rejects a partial database that claims to use the current schema', () => {
    const directory = mkdtempSync(join(tmpdir(), 'pen-fight-schema-'));
    const path = join(directory, 'partial.sqlite');
    try {
      const database = new DatabaseSync(path);
      database.exec('CREATE TABLE schema_meta (version INTEGER NOT NULL); INSERT INTO schema_meta(version) VALUES (1); CREATE TABLE players (id TEXT PRIMARY KEY); CREATE TABLE sessions (token_hash TEXT PRIMARY KEY);');
      database.close();
      expect(() => new AccountStore(path)).toThrowError(/schema is incomplete/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
