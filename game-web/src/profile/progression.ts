export type ProgressionMode = 'quick' | 'practice' | 'local' | 'online';

export interface MatchReward {
  readonly eligible: boolean;
  readonly xp: number;
  readonly matchIncrement: 0 | 1;
  readonly winIncrement: 0 | 1;
  readonly reason?: 'practice' | 'local' | 'incomplete';
}

export interface LevelProgress {
  readonly level: number;
  readonly currentXp: number;
  readonly levelStartXp: number;
  readonly nextLevelXp: number | null;
  readonly earnedInLevel: number;
  readonly requiredInLevel: number;
  readonly remainingXp: number;
  readonly ratio: number;
  readonly maxLevel: boolean;
}

export const MAX_LEVEL = 99;

export function xpForLevel(level: number): number {
  const safe = Math.max(1, Math.min(MAX_LEVEL, Math.floor(Number.isFinite(level) ? level : 1)));
  return (safe - 1) * (100 + 10 * (safe - 2));
}

export function levelForXp(xp: number): number {
  const safeXp = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  let low = 1;
  let high = MAX_LEVEL;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (xpForLevel(middle) <= safeXp) low = middle;
    else high = middle - 1;
  }
  return low;
}

export function progressForXp(xp: number): LevelProgress {
  const currentXp = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  const level = levelForXp(currentXp);
  const levelStartXp = xpForLevel(level);
  const maxLevel = level === MAX_LEVEL;
  const nextLevelXp = maxLevel ? null : xpForLevel(level + 1);
  const requiredInLevel = nextLevelXp === null ? 0 : nextLevelXp - levelStartXp;
  const earnedInLevel = maxLevel ? 0 : Math.min(requiredInLevel, currentXp - levelStartXp);
  return {
    level,
    currentXp,
    levelStartXp,
    nextLevelXp,
    earnedInLevel,
    requiredInLevel,
    remainingXp: maxLevel ? 0 : Math.max(0, requiredInLevel - earnedInLevel),
    ratio: maxLevel ? 1 : requiredInLevel > 0 ? earnedInLevel / requiredInLevel : 0,
    maxLevel,
  };
}

export function rewardForMatch(mode: ProgressionMode, won: boolean, completed = true): MatchReward {
  if (!completed) return { eligible: false, xp: 0, matchIncrement: 0, winIncrement: 0, reason: 'incomplete' };
  if (mode === 'practice') return { eligible: false, xp: 0, matchIncrement: 0, winIncrement: 0, reason: 'practice' };
  if (mode === 'local') return { eligible: false, xp: 0, matchIncrement: 0, winIncrement: 0, reason: 'local' };
  const completion = mode === 'online' ? 80 : 60;
  const winBonus = mode === 'online' ? 60 : 40;
  return {
    eligible: true,
    xp: completion + (won ? winBonus : 0),
    matchIncrement: 1,
    winIncrement: won ? 1 : 0,
  };
}

export function titleForLevel(level: number): string {
  if (level >= 99) return 'Desk Legend';
  if (level >= 70) return 'Hall Champion';
  if (level >= 50) return 'Ink Master';
  if (level >= 35) return 'Pen Captain';
  if (level >= 20) return 'Desk Contender';
  if (level >= 10) return 'Classroom Challenger';
  if (level >= 5) return 'Flick Apprentice';
  return 'Desk Rookie';
}
