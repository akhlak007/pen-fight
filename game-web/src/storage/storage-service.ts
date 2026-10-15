import { defaultSave, sanitizeSave, STORAGE_KEY, type SaveData } from './schema';
import { migrateSave } from './migrations';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const LEGACY_NAME_KEYS = ['penFight.playerName', 'playerName', 'pen-fight-name'];

export class StorageService {
  #memory: SaveData = defaultSave;
  #persistent = true;

  constructor(private readonly storage: KeyValueStorage) {}

  get isPersistent(): boolean { return this.#persistent; }

  load(): SaveData {
    if (!this.#persistent) return this.#memory;
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return this.importLegacy();
      this.#memory = migrateSave(JSON.parse(raw));
      return this.#memory;
    } catch {
      this.#persistent = false;
      return this.#memory;
    }
  }

  save(data: SaveData): SaveData {
    const safe = sanitizeSave(data);
    this.#memory = safe;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(safe));
    } catch {
      this.#persistent = false;
    }
    return safe;
  }

  update(patch: Partial<Omit<SaveData, 'version'>>): SaveData {
    return this.save({ ...this.load(), ...patch, version: 1 });
  }

  resetProgress(): SaveData {
    const current = this.load();
    return this.save({ ...defaultSave, playerName: current.playerName, settings: current.settings });
  }

  private importLegacy(): SaveData {
    try {
      for (const key of LEGACY_NAME_KEYS) {
        const name = this.storage.getItem(key)?.trim();
        if (name) return this.save({ ...defaultSave, playerName: name.slice(0, 18) });
      }
    } catch {
      this.#persistent = false;
    }
    return defaultSave;
  }
}
