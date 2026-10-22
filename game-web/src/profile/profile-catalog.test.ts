import { describe, expect, it } from 'vitest';
import { AVATARS, DESKS, FLAG_CODES, PENS, avatarById, deskById, flagEmoji, itemUnlocked, newlyUnlocked, penById, validFlagCode } from './profile-catalog';

describe('profile catalog', () => {
  it('provides the approved catalog sizes and milestones', () => {
    expect(AVATARS).toHaveLength(12);
    expect(PENS.map((pen) => pen.unlockLevel)).toEqual([1, 5, 10, 15, 25, 35, 50, 70, 90]);
    expect(DESKS.map((desk) => desk.unlockLevel)).toEqual([1, 20, 50]);
    expect(FLAG_CODES).toContain('BD');
    expect(FLAG_CODES).toContain('US');
  });

  it('falls back safely and detects unlocks', () => {
    expect(avatarById('missing').id).toBe('cool');
    expect(penById('missing').id).toBe('classic-blue');
    expect(deskById('missing').id).toBe('classroom-oak');
    expect(itemUnlocked(20, 19)).toBe(false);
    expect(itemUnlocked(20, 20)).toBe(true);
    expect(newlyUnlocked(19, 20).map((item) => item.id)).toContain('science-lab');
  });

  it('formats and validates country flags', () => {
    expect(validFlagCode('bd')).toBe(true);
    expect(validFlagCode('XX')).toBe(false);
    expect(flagEmoji('BD')).toBe('🇧🇩');
  });

  it('keeps pen entries cosmetic-only', () => {
    for (const pen of PENS) {
      expect(Object.keys(pen)).not.toContain('mass');
      expect(Object.keys(pen)).not.toContain('power');
      expect(Object.keys(pen)).not.toContain('collider');
    }
  });
});
