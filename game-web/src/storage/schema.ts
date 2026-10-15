import { defaultSettings, type AppSettings, type GraphicsProfile } from '../app/app-state';

export const STORAGE_KEY = 'pen-fight:save';
export const SCHEMA_VERSION = 1;

export interface ProgressionData {
  readonly wins: number;
  readonly matches: number;
  readonly xp: number;
}

export interface SaveData {
  readonly version: 1;
  readonly playerName: string;
  readonly settings: AppSettings;
  readonly progression: ProgressionData;
  readonly unlockedPens: readonly string[];
  readonly lastMode: 'quick' | 'practice';
}

export const defaultSave: SaveData = Object.freeze({
  version: SCHEMA_VERSION,
  playerName: '',
  settings: defaultSettings,
  progression: Object.freeze({ wins: 0, matches: 0, xp: 0 }),
  unlockedPens: Object.freeze(['classic-blue']),
  lastMode: 'quick',
});

const graphicsProfiles: readonly GraphicsProfile[] = ['auto', 'ultra', 'high', 'performance'];

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function natural(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

export function sanitizeSave(value: unknown): SaveData {
  const root = object(value);
  const settings = object(root.settings);
  const progression = object(root.progression);
  const profile = graphicsProfiles.includes(settings.graphicsProfile as GraphicsProfile)
    ? settings.graphicsProfile as GraphicsProfile
    : defaultSettings.graphicsProfile;
  const pens = Array.isArray(root.unlockedPens)
    ? root.unlockedPens.filter((pen): pen is string => typeof pen === 'string' && pen.length > 0)
    : [];

  return Object.freeze({
    version: SCHEMA_VERSION,
    playerName: typeof root.playerName === 'string' ? root.playerName.trim().slice(0, 18) : '',
    settings: Object.freeze({
      music: bool(settings.music, defaultSettings.music),
      ambience: bool(settings.ambience, defaultSettings.ambience),
      effects: bool(settings.effects, defaultSettings.effects),
      haptics: bool(settings.haptics, defaultSettings.haptics),
      reducedMotion: bool(settings.reducedMotion, defaultSettings.reducedMotion),
      graphicsProfile: profile,
    }),
    progression: Object.freeze({
      wins: natural(progression.wins),
      matches: natural(progression.matches),
      xp: natural(progression.xp),
    }),
    unlockedPens: Object.freeze(pens.length ? [...new Set(pens)] : ['classic-blue']),
    lastMode: root.lastMode === 'practice' ? 'practice' : 'quick',
  });
}
