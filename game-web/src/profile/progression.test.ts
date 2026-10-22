import { describe, expect, it } from 'vitest';
import { levelForXp, progressForXp, rewardForMatch, titleForLevel, xpForLevel } from './progression';

describe('profile progression', () => {
  it('uses the approved level curve through level 99', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(5)).toBe(520);
    expect(xpForLevel(10)).toBe(1_620);
    expect(xpForLevel(20)).toBe(5_320);
    expect(xpForLevel(50)).toBe(28_420);
    expect(xpForLevel(99)).toBe(104_860);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(999_999)).toBe(99);
  });

  it('reports progress within a level and a stable max-level state', () => {
    expect(progressForXp(150)).toMatchObject({ level: 2, earnedInLevel: 50, requiredInLevel: 120, remainingXp: 70 });
    expect(progressForXp(150).ratio).toBeCloseTo(50 / 120, 6);
    expect(progressForXp(104_860)).toMatchObject({ level: 99, nextLevelXp: null, ratio: 1, maxLevel: true });
  });

  it('awards only completed quick and online matches', () => {
    expect(rewardForMatch('quick', false)).toMatchObject({ eligible: true, xp: 60, matchIncrement: 1, winIncrement: 0 });
    expect(rewardForMatch('quick', true).xp).toBe(100);
    expect(rewardForMatch('online', false).xp).toBe(80);
    expect(rewardForMatch('online', true).xp).toBe(140);
    expect(rewardForMatch('practice', true)).toMatchObject({ eligible: false, xp: 0, reason: 'practice' });
    expect(rewardForMatch('local', true)).toMatchObject({ eligible: false, xp: 0, reason: 'local' });
    expect(rewardForMatch('quick', true, false)).toMatchObject({ eligible: false, xp: 0, reason: 'incomplete' });
  });

  it('assigns stable titles at milestone levels', () => {
    expect(titleForLevel(1)).toBe('Desk Rookie');
    expect(titleForLevel(20)).toBe('Desk Contender');
    expect(titleForLevel(99)).toBe('Desk Legend');
  });
});
