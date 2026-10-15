import { SCHEMA_VERSION, sanitizeSave, type SaveData } from './schema';

export function migrateSave(value: unknown): SaveData {
  if (value && typeof value === 'object') {
    const version = (value as Record<string, unknown>).version;
    if (typeof version === 'number' && version > SCHEMA_VERSION) {
      throw new Error('This save was created by a newer version of Pen Fight.');
    }
  }
  return sanitizeSave(value);
}
