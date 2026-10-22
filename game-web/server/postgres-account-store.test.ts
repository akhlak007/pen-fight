import type { Pool } from 'pg';
import { newDb } from 'pg-mem';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/app/app-state';
import { AccountError } from './account-store';
import { PostgresAccountStore } from './postgres-account-store';

function testStore() {
  const database = newDb();
  const adapter = database.adapters.createPg();
  const pool = new adapter.Pool() as unknown as Pool;
  return { database, adapter, store: new PostgresAccountStore('postgres://test', { pool, advisoryLock: false, validateCatalog: false }) };
}

describe('Postgres account store', () => {
  it('creates, authenticates, restores, updates, and logs out an account', async () => {
    const { store } = testStore();
    const profile = { ...createInitialState().profile, xp: 520, wins: 4, matches: 7, awardedMatchIds: ['first-match'] };
    const created = await store.signup('NeonPlayer', 'strong-password', profile);

    expect(created.account.profile).toMatchObject({ xp: 520, wins: 4, matches: 7 });
    expect((await store.login('neonplayer', 'strong-password')).account.username).toBe('NeonPlayer');
    expect((await store.accountForSession(created.token))?.id).toBe(created.account.id);
    const updated = await store.updateProfile(created.account.id, {
      ...created.account.profile,
      xp: 620,
      wins: 5,
      matches: 8,
      awardedMatchIds: ['second-match'],
    });
    expect(updated.profile.awardedMatchIds).toEqual(['first-match', 'second-match']);
    await store.logout(created.token);
    expect(await store.accountForSession(created.token)).toBeNull();
    await store.close();
  });

  it('enforces username uniqueness and returns stable leaderboard ranks', async () => {
    const { store } = testStore();
    const base = createInitialState().profile;
    const first = await store.signup('First', 'password-1', { ...base, xp: 900, wins: 3, matches: 5 }, 1000);
    await store.signup('Winner', 'password-2', { ...base, xp: 900, wins: 8, matches: 10 }, 2000);
    await store.signup('Rookie', 'password-3', { ...base, xp: 100, wins: 1, matches: 2 }, 3000);

    await expect(store.signup('first', 'password-4', base)).rejects.toBeInstanceOf(AccountError);
    await expect(store.login('First', 'wrong-password')).rejects.toBeInstanceOf(AccountError);
    const leaderboard = await store.leaderboard(0, 2, first.account.id);
    expect(leaderboard.entries.map((entry) => [entry.rank, entry.username])).toEqual([[1, 'Winner'], [2, 'First']]);
    expect(leaderboard).toMatchObject({ total: 3, currentRank: 2 });
    await store.close();
  });

  it('keeps data when a new pool connects to the same database', async () => {
    const { adapter, store } = testStore();
    await store.signup('Persistent', 'password-1', createInitialState().profile);
    await store.close();

    const reopened = new PostgresAccountStore('postgres://test', { pool: new adapter.Pool() as unknown as Pool, advisoryLock: false, validateCatalog: false });
    expect((await reopened.leaderboard()).entries[0]?.username).toBe('Persistent');
    await reopened.close();
  });
});
