import { describe, expect, it } from 'vitest';
import { defaultSave, STORAGE_KEY } from './schema';
import { StorageService, type KeyValueStorage } from './storage-service';

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

class BlockedStorage implements KeyValueStorage {
  getItem(): string | null { throw new Error('blocked'); }
  setItem(): void { throw new Error('blocked'); }
  removeItem(): void { throw new Error('blocked'); }
}

class WriteBlockedStorage extends MemoryStorage {
  override setItem(): void { throw new Error('quota'); }
}

describe('StorageService', () => {
  it('returns safe defaults for empty or corrupt saves', () => {
    const memory = new MemoryStorage();
    const service = new StorageService(memory);
    expect(service.load()).toEqual(defaultSave);
    memory.setItem(STORAGE_KEY, '{broken');
    expect(service.load()).toEqual(defaultSave);
  });

  it('validates fields independently', () => {
    const memory = new MemoryStorage();
    memory.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      playerName: '  Rafi  ',
      settings: { music: false, effects: 'no', graphicsProfile: 'cinema' },
      progression: { wins: 3.7, matches: -2, xp: 90 },
      unlockedPens: ['classic-blue', 12, 'classic-blue'],
      lastMode: 'practice',
    }));
    const save = new StorageService(memory).load();
    expect(save.version).toBe(2);
    expect(save.playerName).toBe('Rafi');
    expect(save.settings.music).toBe(false);
    expect(save.settings.effects).toBe(true);
    expect(save.progression).toEqual({ wins: 3, matches: 0, xp: 90, awardedMatchIds: [] });
    expect(save.unlockedPens).toEqual(['classic-blue']);
    expect(save.lastMode).toBe('practice');
    expect(save.profile).toEqual(defaultSave.profile);
  });

  it('sanitizes version-2 profile fields independently and rejects locked selections', () => {
    const memory = new MemoryStorage();
    memory.setItem(STORAGE_KEY, JSON.stringify({
      ...defaultSave,
      progression: { wins: 1, matches: 2, xp: 520 },
      profile: { avatarId: 'scholar', flagCode: 'us', selectedPenId: 'red-comet', selectedDeskId: 'science-lab' },
      unlockedCosmetics: ['special-event', '<bad>'],
    }));

    const save = new StorageService(memory).load();
    expect(save.profile).toEqual({ avatarId: 'scholar', flagCode: 'US', selectedPenId: 'red-comet', selectedDeskId: 'classroom-oak' });
    expect(save.unlockedCosmetics).toEqual(['special-event']);
    expect(save.progression).toEqual({ wins: 1, matches: 2, xp: 520, awardedMatchIds: [] });
  });

  it('clamps progression numbers and keeps safe reward identifiers', () => {
    const memory = new MemoryStorage();
    memory.setItem(STORAGE_KEY, JSON.stringify({
      ...defaultSave,
      progression: { wins: 1e308, matches: Infinity, xp: 1e308, awardedMatchIds: ['abc234-8', '<bad>'] },
    }));
    const save = new StorageService(memory).load();
    expect(save.progression.wins).toBe(Number.MAX_SAFE_INTEGER);
    expect(save.progression.matches).toBe(0);
    expect(save.progression.xp).toBe(Number.MAX_SAFE_INTEGER);
    expect(save.progression.awardedMatchIds).toEqual(['abc234-8']);
  });

  it('imports a compatible legacy name', () => {
    const memory = new MemoryStorage();
    memory.setItem('playerName', ' Priya ');
    const save = new StorageService(memory).load();
    expect(save.playerName).toBe('Priya');
    expect(memory.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('rejects future versions safely', () => {
    const memory = new MemoryStorage();
    memory.setItem(STORAGE_KEY, JSON.stringify({ version: 99, playerName: 'Future' }));
    expect(new StorageService(memory).load()).toEqual(defaultSave);
  });

  it('resets progress while preserving identity and preferences', () => {
    const memory = new MemoryStorage();
    const service = new StorageService(memory);
    service.save({
      ...defaultSave,
      playerName: 'Nila',
      settings: { ...defaultSave.settings, reducedMotion: true, music: false },
      progression: { wins: 8, matches: 10, xp: 900, awardedMatchIds: [] },
      unlockedPens: ['classic-blue', 'red-comet'],
    });
    const reset = service.resetProgress();
    expect(reset.playerName).toBe('Nila');
    expect(reset.settings.reducedMotion).toBe(true);
    expect(reset.settings.music).toBe(false);
    expect(reset.progression).toEqual(defaultSave.progression);
    expect(reset.unlockedPens).toEqual(['classic-blue']);
    expect(reset.profile).toEqual(defaultSave.profile);
  });

  it('keeps an in-memory save when browser storage is blocked', () => {
    const service = new StorageService(new BlockedStorage());
    expect(service.load()).toEqual(defaultSave);
    const save = service.save({ ...defaultSave, playerName: 'Offline' });
    expect(save.playerName).toBe('Offline');
    expect(service.load().playerName).toBe('Offline');
    expect(service.isPersistent).toBe(false);
  });

  it('does not overwrite memory with stale storage after a quota failure', () => {
    const service = new StorageService(new WriteBlockedStorage());
    service.save({ ...defaultSave, playerName: 'Memory' });
    expect(service.update({ lastMode: 'practice' }).playerName).toBe('Memory');
  });
});
