export interface AvatarOption {
  readonly id: string;
  readonly label: string;
  readonly glyph: string;
  readonly color: string;
}

export interface PenCosmetic {
  readonly id: string;
  readonly label: string;
  readonly unlockLevel: number;
  readonly primary: string;
  readonly accent: string;
  readonly metalness: number;
  readonly roughness: number;
}

export interface DeskCosmetic {
  readonly id: string;
  readonly label: string;
  readonly unlockLevel: number;
  readonly surface: string;
  readonly trim: string;
  readonly room: string;
}

export const AVATARS: readonly AvatarOption[] = Object.freeze([
  { id: 'cool', label: 'Cool Kid', glyph: '😎', color: '#9ed7f5' },
  { id: 'scholar', label: 'Scholar', glyph: '🤓', color: '#f2c66d' },
  { id: 'captain', label: 'Captain', glyph: '🧢', color: '#ef9270' },
  { id: 'artist', label: 'Artist', glyph: '🎨', color: '#c8a6e8' },
  { id: 'inventor', label: 'Inventor', glyph: '🥽', color: '#8ed1b2' },
  { id: 'gamer', label: 'Gamer', glyph: '🎮', color: '#86aef0' },
  { id: 'ninja', label: 'Ninja', glyph: '🥷', color: '#9ba8b8' },
  { id: 'rocket', label: 'Rocket', glyph: '🚀', color: '#efa075' },
  { id: 'tiger', label: 'Tiger', glyph: '🐯', color: '#f0b64e' },
  { id: 'fox', label: 'Fox', glyph: '🦊', color: '#ef8b51' },
  { id: 'owl', label: 'Owl', glyph: '🦉', color: '#bda277' },
  { id: 'star', label: 'All Star', glyph: '⭐', color: '#f5d95f' },
]);

export const PENS: readonly PenCosmetic[] = Object.freeze([
  { id: 'classic-blue', label: 'Classic Blue', unlockLevel: 1, primary: '#137cd1', accent: '#9edcff', metalness: 0.15, roughness: 0.32 },
  { id: 'red-comet', label: 'Red Comet', unlockLevel: 5, primary: '#d93b32', accent: '#ffb05f', metalness: 0.2, roughness: 0.28 },
  { id: 'mint-strike', label: 'Mint Strike', unlockLevel: 10, primary: '#22a979', accent: '#baf7db', metalness: 0.12, roughness: 0.34 },
  { id: 'violet-note', label: 'Violet Note', unlockLevel: 15, primary: '#7651c9', accent: '#e3c5ff', metalness: 0.2, roughness: 0.3 },
  { id: 'sunset-orange', label: 'Sunset Orange', unlockLevel: 25, primary: '#ec6b2f', accent: '#ffe08a', metalness: 0.18, roughness: 0.27 },
  { id: 'chalk-white', label: 'Chalk White', unlockLevel: 35, primary: '#f1efe3', accent: '#5a6a7e', metalness: 0.3, roughness: 0.22 },
  { id: 'midnight-ink', label: 'Midnight Ink', unlockLevel: 50, primary: '#17233d', accent: '#63b8ff', metalness: 0.5, roughness: 0.2 },
  { id: 'neon-lime', label: 'Neon Lime', unlockLevel: 70, primary: '#91d629', accent: '#efff82', metalness: 0.28, roughness: 0.2 },
  { id: 'gold-nib', label: 'Gold Nib', unlockLevel: 90, primary: '#d8a41f', accent: '#fff0a4', metalness: 0.72, roughness: 0.16 },
]);

export const DESKS: readonly DeskCosmetic[] = Object.freeze([
  { id: 'classroom-oak', label: 'Classroom Oak', unlockLevel: 1, surface: '#8a531f', trim: '#5d3515', room: '#4c523c' },
  { id: 'science-lab', label: 'Science Lab', unlockLevel: 20, surface: '#58717b', trim: '#293f48', room: '#334a4f' },
  { id: 'champion-desk', label: 'Champion Desk', unlockLevel: 50, surface: '#55366f', trim: '#d3a52d', room: '#372c49' },
]);

const COUNTRY_CODE_LIST = 'AD AE AF AG AI AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PR PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW';
export const FLAG_CODES: readonly string[] = Object.freeze(COUNTRY_CODE_LIST.split(' '));

export const DEFAULT_AVATAR_ID = 'cool';
export const DEFAULT_FLAG_CODE = 'BD';
export const DEFAULT_PEN_ID = 'classic-blue';
export const DEFAULT_DESK_ID = 'classroom-oak';

export const avatarById = (id: string) => AVATARS.find((avatar) => avatar.id === id) ?? AVATARS[0]!;
export const penById = (id: string) => PENS.find((pen) => pen.id === id) ?? PENS[0]!;
export const deskById = (id: string) => DESKS.find((desk) => desk.id === id) ?? DESKS[0]!;
export const validFlagCode = (code: string) => FLAG_CODES.includes(code.toUpperCase());
export const flagEmoji = (code: string): string => Array.from(code.toUpperCase()).map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('');
export const itemUnlocked = (unlockLevel: number, level: number): boolean => level >= unlockLevel;

export function newlyUnlocked(beforeLevel: number, afterLevel: number): readonly (PenCosmetic | DeskCosmetic)[] {
  return [...PENS, ...DESKS].filter((item) => item.unlockLevel > beforeLevel && item.unlockLevel <= afterLevel);
}
