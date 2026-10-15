import { describe, expect, it } from 'vitest';
import { defaultSave, STORAGE_KEY } from './schema';
import { StorageService, type KeyValueStorage } from './storage-service';

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
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
    expect(save.playerName).toBe('Rafi');
    expect(save.settings.music).toBe(false);
    expect(save.settings.effects).toBe(true);
    expect(save.progression).toEqual({ wins: 3, matches: 0, xp: 90 });
    expect(save.unlockedPens).toEqual(['classic-blue']);
    expect(save.lastMode).toBe('practice');
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
      progression: { wins: 8, matches: 10, xp: 900 },
      unlockedPens: ['classic-blue', 'red-comet'],
    });
    const reset = service.resetProgress();
    expect(reset.playerName).toBe('Nila');
    expect(reset.settings.reducedMotion).toBe(true);
    expect(reset.settings.music).toBe(false);
    expect(reset.progression).toEqual(defaultSave.progression);
    expect(reset.unlockedPens).toEqual(['classic-blue']);
  });
});
