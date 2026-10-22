import { defaultSettings, type AppSettings, type GraphicsProfile } from '../app/app-state';
import {
  AVATARS,
  DEFAULT_AVATAR_ID,
  DEFAULT_DESK_ID,
  DEFAULT_FLAG_CODE,
  DEFAULT_PEN_ID,
  DESKS,
  PENS,
  validFlagCode,
} from '../profile/profile-catalog';
import { levelForXp } from '../profile/progression';

export const STORAGE_KEY = 'pen-fight:save';
export const SCHEMA_VERSION = 2;

export interface ProgressionData {
  readonly wins: number;
  readonly matches: number;
  readonly xp: number;
  readonly awardedMatchIds: readonly string[];
}

export interface ProfileData {
  readonly avatarId: string;
  readonly flagCode: string;
  readonly selectedPenId: string;
  readonly selectedDeskId: string;
}

export interface SaveData {
  readonly version: 2;
  readonly playerName: string;
  readonly settings: AppSettings;
  readonly progression: ProgressionData;
  readonly unlockedPens: readonly string[];
  readonly unlockedCosmetics: readonly string[];
  readonly profile: ProfileData;
  readonly lastMode: 'quick' | 'practice';
}

export const defaultProfile: ProfileData = Object.freeze({
  avatarId: DEFAULT_AVATAR_ID,
  flagCode: DEFAULT_FLAG_CODE,
  selectedPenId: DEFAULT_PEN_ID,
  selectedDeskId: DEFAULT_DESK_ID,
});

export const defaultSave: SaveData = Object.freeze({
  version: SCHEMA_VERSION,
  playerName: '',
  settings: defaultSettings,
  progression: Object.freeze({ wins: 0, matches: 0, xp: 0, awardedMatchIds: Object.freeze([]) }),
  unlockedPens: Object.freeze(['classic-blue']),
  unlockedCosmetics: Object.freeze([]),
  profile: defaultProfile,
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
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value))
    : 0;
}

function safeIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => (
    typeof item === 'string' && /^[a-z0-9-]{1,40}$/.test(item)
  )))];
}

export function sanitizeSave(value: unknown): SaveData {
  const root = object(value);
  const settings = object(root.settings);
  const progression = object(root.progression);
  const savedProfile = object(root.profile);
  const profile = graphicsProfiles.includes(settings.graphicsProfile as GraphicsProfile)
    ? settings.graphicsProfile as GraphicsProfile
    : defaultSettings.graphicsProfile;
  const pens = safeIds(root.unlockedPens);
  const unlockedCosmetics = safeIds(root.unlockedCosmetics);
  const xp = natural(progression.xp);
  const level = levelForXp(xp);
  const requestedAvatar = typeof savedProfile.avatarId === 'string' ? savedProfile.avatarId : '';
  const requestedFlag = typeof savedProfile.flagCode === 'string' ? savedProfile.flagCode.toUpperCase() : '';
  const requestedPen = typeof savedProfile.selectedPenId === 'string' ? savedProfile.selectedPenId : '';
  const requestedDesk = typeof savedProfile.selectedDeskId === 'string' ? savedProfile.selectedDeskId : '';
  const selectedPen = PENS.find((pen) => pen.id === requestedPen && (pen.unlockLevel <= level || pens.includes(pen.id) || unlockedCosmetics.includes(pen.id)));
  const selectedDesk = DESKS.find((desk) => desk.id === requestedDesk && (desk.unlockLevel <= level || unlockedCosmetics.includes(desk.id)));

  return Object.freeze({
    version: 2,
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
      xp,
      awardedMatchIds: Object.freeze(safeIds(progression.awardedMatchIds).slice(-100)),
    }),
    unlockedPens: Object.freeze(pens.length ? [...new Set(pens)] : ['classic-blue']),
    unlockedCosmetics: Object.freeze(unlockedCosmetics),
    profile: Object.freeze({
      avatarId: AVATARS.some((avatar) => avatar.id === requestedAvatar) ? requestedAvatar : DEFAULT_AVATAR_ID,
      flagCode: validFlagCode(requestedFlag) ? requestedFlag : DEFAULT_FLAG_CODE,
      selectedPenId: selectedPen?.id ?? DEFAULT_PEN_ID,
      selectedDeskId: selectedDesk?.id ?? DEFAULT_DESK_ID,
    }),
    lastMode: root.lastMode === 'practice' ? 'practice' : 'quick',
  });
}
