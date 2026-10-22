import { describe, expect, it } from 'vitest';
import {
  STANDARD_ARENA,
  aiImpulseForDistance,
  challengeForLevel,
  safeAiShotAngle,
  validateChallenge,
} from './arena-challenges';

describe('level arena challenges', () => {
  it('produces a deterministic valid challenge for every level', () => {
    for (let level = 1; level <= 99; level += 1) {
      const first = challengeForLevel(level);
      const second = challengeForLevel(level);
      expect(first).toEqual(second);
      expect(first.level).toBe(level);
      expect(first.tier).toBe(level <= 9 ? 1 : Math.min(10, Math.floor(level / 10) + 1));
      expect(first.hazard).not.toBe('standard');
      expect(first.difficulty).toBe(level);
      expect(validateChallenge(first)).toEqual({ valid: true });
    }
  });

  it('clamps invalid levels and preserves the standard arena separately', () => {
    expect(challengeForLevel(Number.NaN)).toEqual(challengeForLevel(1));
    expect(challengeForLevel(-20)).toEqual(challengeForLevel(1));
    expect(challengeForLevel(1000)).toEqual(challengeForLevel(99));
    expect(STANDARD_ARENA).toMatchObject({
      level: 1,
      tier: 0,
      halfWidth: 5.75,
      halfDepth: 7.45,
      centerZ: 0.4,
      obstacles: [],
      frictionZones: [],
      tremor: null,
    });
  });

  it('introduces the approved mechanics at tier boundaries', () => {
    expect(challengeForLevel(1)).toMatchObject({ tier: 1, hazard: 'training' });
    expect(challengeForLevel(10)).toMatchObject({ tier: 2, hazard: 'narrow' });
    expect(challengeForLevel(20)).toMatchObject({ tier: 3, hazard: 'bumper' });
    expect(challengeForLevel(30)).toMatchObject({ tier: 4, hazard: 'rulers' });
    expect(challengeForLevel(40)).toMatchObject({ tier: 5, hazard: 'slick' });
    expect(challengeForLevel(50)).toMatchObject({ tier: 6, hazard: 'tremor' });
    expect(challengeForLevel(60)).toMatchObject({ tier: 7, hazard: 'moving-chalk' });
    expect(challengeForLevel(70)).toMatchObject({ tier: 8, hazard: 'short' });
    expect(challengeForLevel(80)).toMatchObject({ tier: 9, hazard: 'mixed' });
    expect(challengeForLevel(90)).toMatchObject({ tier: 10, hazard: 'champion' });
  });

  it('gives every training level a clear visible gameplay change', () => {
    const expectedHazards = ['training', 'narrow', 'bumper', 'rulers', 'slick', 'tremor', 'moving-chalk', 'short', 'mixed'];
    const expectedNames = [
      'Training Desk',
      'Tight Lines',
      'First Bumper',
      'Chalk Gate',
      'Slick Lesson',
      'Wobbly Desk',
      'Moving Chalk',
      'Short Practice',
      'Graduation Trial',
    ];

    for (let level = 1; level <= 9; level += 1) {
      const challenge = challengeForLevel(level);
      expect(challenge.hazard).toBe(expectedHazards[level - 1]);
      expect(challenge.name).toBe(expectedNames[level - 1]);
      if (level === 1) continue;
      const hasVisibleMechanic = challenge.halfWidth !== STANDARD_ARENA.halfWidth
        || challenge.halfDepth !== STANDARD_ARENA.halfDepth
        || challenge.obstacles.length > 0
        || challenge.frictionZones.length > 0
        || challenge.tremor !== null;
      expect(hasVisibleMechanic, `level ${level} should not look like level 1`).toBe(true);
    }
    const levelFourChalk = challengeForLevel(4).obstacles;
    expect(levelFourChalk).toHaveLength(2);
    expect(levelFourChalk.every((obstacle) => obstacle.kind === 'chalk' && obstacle.movement)).toBe(true);
  });

  it('makes effective AI hit power rise at every level', () => {
    let previous = 0;
    for (let level = 1; level <= 99; level += 1) {
      const impulse = aiImpulseForDistance(challengeForLevel(level), 9);
      expect(impulse, `level ${level} AI impulse`).toBeGreaterThan(previous);
      previous = impulse;
    }
    expect(aiImpulseForDistance(challengeForLevel(1), 9)).toBeGreaterThanOrEqual(12);
    expect(aiImpulseForDistance(challengeForLevel(99), 9)).toBeGreaterThanOrEqual(18.5);
    expect(aiImpulseForDistance(challengeForLevel(99), 9)).toBeLessThan(21);
  });

  it('keeps difficulty monotonic and makes every level distinct', () => {
    const challenges = Array.from({ length: 99 }, (_, index) => challengeForLevel(index + 1));
    const fingerprints = challenges.map((challenge) => JSON.stringify(
      challenge,
      (key, value: unknown) => (['level', 'tier', 'difficulty'].includes(key) ? undefined : value),
    ));
    expect(new Set(fingerprints).size).toBe(99);
    for (let index = 1; index < challenges.length; index += 1) {
      expect(challenges[index]!.difficulty).toBeGreaterThan(challenges[index - 1]!.difficulty);
    }
  });

  it('assigns a unique permanent visual identity to all 99 levels', () => {
    const keys = new Set<string>();
    const colors = new Set<string>();
    for (let level = 1; level <= 99; level += 1) {
      const visual = challengeForLevel(level).visual;
      expect(visual.key).toBe(`level-${level.toString().padStart(2, '0')}`);
      expect(keys.has(visual.key), `duplicate visual key at level ${level}`).toBe(false);
      expect(colors.has(visual.accent), `duplicate accent at level ${level}`).toBe(false);
      keys.add(visual.key);
      colors.add(visual.accent);
    }
    expect(keys.size).toBe(99);
    expect(colors.size).toBe(99);
    expect(STANDARD_ARENA.visual.key).toBe('classic');
  });

  it('keeps spawns and obstacles safely inside every tabletop', () => {
    for (let level = 1; level <= 99; level += 1) {
      const challenge = challengeForLevel(level);
      for (const spawn of challenge.spawns) {
        expect(Math.abs(spawn.x)).toBeLessThan(challenge.halfWidth - 1.6);
        expect(Math.abs(spawn.z - challenge.centerZ)).toBeLessThan(challenge.halfDepth - 1.6);
        for (const obstacle of challenge.obstacles) {
          const clearanceX = obstacle.halfWidth + 1.55;
          const clearanceZ = obstacle.halfDepth + 1.55;
          expect(Math.abs(spawn.x - obstacle.x) > clearanceX || Math.abs(spawn.z - obstacle.z) > clearanceZ).toBe(true);
        }
      }
      for (const obstacle of challenge.obstacles) {
        expect(Math.abs(obstacle.x) + obstacle.halfWidth).toBeLessThan(challenge.halfWidth - 0.2);
        expect(Math.abs(obstacle.z - challenge.centerZ) + obstacle.halfDepth).toBeLessThan(challenge.halfDepth - 0.2);
      }
    }
  });

  it('rejects overlapping blockers and layouts that seal the route', () => {
    const blocker = { id: 'block-a', kind: 'ruler' as const, x: 0, z: 0.4, halfWidth: 0.8, halfDepth: 0.2, height: 0.2, rotation: 0 };
    expect(validateChallenge({
      ...STANDARD_ARENA,
      obstacles: [blocker, { ...blocker, id: 'block-b', x: 0.5 }],
    })).toEqual({ valid: false, reason: 'overlapping obstacles' });

    expect(validateChallenge({
      ...STANDARD_ARENA,
      obstacles: [{ ...blocker, id: 'sealed-route', halfWidth: 5 }],
    })).toEqual({ valid: false, reason: 'no open route' });
  });

  it('keeps AI trajectories inside the table and steers around blockers', () => {
    const trajectoryIsClear = (
      challenge: ReturnType<typeof challengeForLevel>,
      origin: { x: number; z: number },
      target: { x: number; z: number },
      angle: number,
    ) => {
      const distance = Math.hypot(target.x - origin.x, target.z - origin.z);
      return Array.from({ length: 30 }, (_, index) => {
        const travel = distance * ((index + 1) / 30);
        const x = origin.x + Math.cos(angle) * travel;
        const z = origin.z - Math.sin(angle) * travel;
        const inside = Math.abs(x) <= challenge.halfWidth - 0.5
          && Math.abs(z - challenge.centerZ) <= challenge.halfDepth - 0.5;
        const misses = challenge.obstacles.every((obstacle) => {
          const cosine = Math.abs(Math.cos(obstacle.rotation));
          const sine = Math.abs(Math.sin(obstacle.rotation));
          const halfWidth = cosine * obstacle.halfWidth + sine * obstacle.halfDepth
            + (obstacle.movement?.axis === 'x' ? obstacle.movement.amplitude : 0);
          const halfDepth = sine * obstacle.halfWidth + cosine * obstacle.halfDepth
            + (obstacle.movement?.axis === 'z' ? obstacle.movement.amplitude : 0);
          return Math.abs(x - obstacle.x) > halfWidth + 0.28 || Math.abs(z - obstacle.z) > halfDepth + 0.28;
        });
        return inside && misses;
      }).every(Boolean);
    };
    const narrow = challengeForLevel(19);
    const origin = { x: -3.2, z: -4 };
    const target = { x: 3.2, z: 4.5 };
    const angle = safeAiShotAngle(narrow, origin, target, 0.18);
    expect(angle).not.toBeNull();
    if (angle === null) throw new Error('Expected a safe narrow-table trajectory.');
    const distance = Math.hypot(target.x - origin.x, target.z - origin.z);
    const endpoint = { x: origin.x + Math.cos(angle) * distance, z: origin.z - Math.sin(angle) * distance };
    expect(Math.abs(endpoint.x)).toBeLessThan(narrow.halfWidth - 0.49);
    expect(Math.abs(endpoint.z - narrow.centerZ)).toBeLessThan(narrow.halfDepth - 0.49);

    const bumper = challengeForLevel(24);
    const direct = Math.atan2(-(bumper.spawns[0].z - bumper.spawns[1].z), bumper.spawns[0].x - bumper.spawns[1].x);
    const avoided = safeAiShotAngle(bumper, bumper.spawns[1], bumper.spawns[0], 0);
    expect(avoided).not.toBeNull();
    if (avoided === null) throw new Error('Expected a safe bumper trajectory.');
    expect(trajectoryIsClear(bumper, bumper.spawns[1], bumper.spawns[0], avoided)).toBe(true);
    expect(Math.abs(avoided - direct)).toBeLessThanOrEqual(0.48);

    const trappedOrigin = { x: -4, z: 5 };
    const trappedTarget = { x: 4, z: -5 };
    const fallback = safeAiShotAngle(bumper, trappedOrigin, trappedTarget, 0);
    expect(fallback).toBeNull();
    expect(aiImpulseForDistance(bumper, Math.hypot(8, 10))).toBeGreaterThan(12);
  });
});
