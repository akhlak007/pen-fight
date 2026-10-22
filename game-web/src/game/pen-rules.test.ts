import { describe, expect, it } from 'vitest';
import {
  AI_CORNER,
  assistedDirection,
  axialShotEfficiency,
  capsuleContact,
  computeFlickAim,
  edgeChargePixels,
  fullPullPixels,
  grabSpinShare,
  isOutsideTable,
  isPhonePortrait,
  knockoutWinner,
  penHasFallen,
  PLAYER_CORNER,
  pointerAtScreenEdge,
  resolveEqualMassCollision,
  shapedFlickPower,
  spinFromGrab,
} from './pen-rules';

describe('pen fight table rules', () => {
  it('places opponents at diagonally opposite corners inside the table', () => {
    expect(Math.sign(PLAYER_CORNER.x)).toBe(-Math.sign(AI_CORNER.x));
    expect(Math.sign(PLAYER_CORNER.z)).toBe(-Math.sign(AI_CORNER.z));
    expect(isOutsideTable(PLAYER_CORNER.x, PLAYER_CORNER.z)).toBe(false);
    expect(isOutsideTable(AI_CORNER.x, AI_CORNER.z)).toBe(false);
  });

  it('transfers head-on momentum between equal pens', () => {
    const [player, ai] = resolveEqualMassCollision(
      { x: -0.3, y: 0 }, { x: 0.3, y: 0 },
      { x: 8, y: 0 }, { x: 0, y: 0 },
    );
    expect(player.x).toBeCloseTo(0.64, 2);
    expect(ai.x).toBeCloseTo(7.36, 2);
  });

  it('awards the point to the pen that remains on the table', () => {
    expect(knockoutWinner(false, true)).toBe(0);
    expect(knockoutWinner(true, false)).toBe(1);
    expect(knockoutWinner(false, false)).toBeNull();
    expect(knockoutWinner(true, true)).toBe('draw');
  });

  it('keeps a pen in play while most of its body is still supported', () => {
    expect(isOutsideTable(3.9, 0.4)).toBe(false);
    expect(penHasFallen(3.9, 0.4, 0)).toBe(false);
    expect(penHasFallen(6.8, 0.4, 0)).toBe(true);
  });

  it('maps a pull-back gesture to a freely aimed opposite shot', () => {
    const straight = computeFlickAim(0, 120);
    const diagonal = computeFlickAim(90, 90);

    expect(straight.direction.x).toBeCloseTo(0, 4);
    expect(straight.direction.y).toBeCloseTo(-1, 4);
    expect(straight.power).toBeGreaterThan(0.5);
    expect(diagonal.direction.x).toBeLessThan(-0.6);
    expect(diagonal.direction.y).toBeLessThan(-0.6);
  });

  it('normalizes power using tabletop distance instead of screen pixels', () => {
    expect(computeFlickAim(0, 1.2, 2.4).power).toBeCloseTo(0.5, 4);
    expect(computeFlickAim(0, 3.5, 2.4).power).toBe(1);
  });

  it('gently assists shots already aimed toward the rival without redirecting misses', () => {
    const assisted = assistedDirection({ x: 0.6, y: -0.8 }, { x: 1, y: -0.2 });
    const away = assistedDirection({ x: -1, y: 0 }, { x: 1, y: 0 });

    expect(assisted.x).toBeGreaterThan(0.6);
    expect(assisted.y).toBeLessThan(-0.6);
    expect(away).toEqual({ x: -1, y: 0 });
  });

  it('shapes phone pull power and keeps a center grab straight', () => {
    expect(isPhonePortrait(390, 844)).toBe(true);
    expect(isPhonePortrait(1280, 720)).toBe(false);
    expect(fullPullPixels(400)).toBeCloseTo(120, 4);
    expect(fullPullPixels(200)).toBe(96);
    expect(fullPullPixels(1000)).toBe(180);
    expect(fullPullPixels(390, true)).toBeCloseTo(93.6, 4);
    expect(shapedFlickPower(11, 120)).toBe(0);
    expect(shapedFlickPower(12, 120)).toBe(0);
    expect(shapedFlickPower(13, 120)).toBeGreaterThan(0);
    expect(shapedFlickPower(60, 120)).toBeCloseTo(((60 - 12) / (120 - 12)) ** 1.5, 4);
    expect(shapedFlickPower(90, fullPullPixels(390, true), true)).toBe(1);
    expect(shapedFlickPower(165, 180)).toBeCloseTo(((165 - 12) / (180 - 12)) ** 1.5, 4);
    expect(grabSpinShare(0, 3.2)).toBe(0);
    expect(grabSpinShare(3.2 * 0.2, 3.2)).toBeCloseTo(0, 6);
    expect(grabSpinShare(3.2, 3.2)).toBeCloseTo(1, 4);
    expect(axialShotEfficiency(1, 0, 1, 0)).toBeCloseTo(0.82, 4);
    expect(axialShotEfficiency(0, 1, 1, 0)).toBeCloseTo(1, 4);
    expect(spinFromGrab(0, 1)).toBe(0);
    expect(spinFromGrab(1, 1)).toBeCloseTo(7.5, 4);
  });

  it('keeps charging when a thumb is pulled into the screen edge', () => {
    expect(pointerAtScreenEdge(10, 400, 390, 844, -40, 0)).toBe(true);
    expect(pointerAtScreenEdge(180, 400, 390, 844, -40, 0)).toBe(false);
    expect(edgeChargePixels(true, 0.1, 0, 100)).toBeCloseTo(24, 4);
    expect(edgeChargePixels(false, 0.1, 4, 100)).toBe(4);
  });

  it('detects contact between the ends of long pens', () => {
    const contact = capsuleContact(
      { x: 0, y: 0 }, 0,
      { x: 3.8, y: 0 }, 0,
    );
    expect(contact).not.toBeNull();
  });

  it('uses the capsule contact normal for offset side impacts', () => {
    const contact = capsuleContact(
      { x: 0, y: 0 }, 0,
      { x: 2, y: 0.3 }, 0,
    );
    expect(contact).not.toBeNull();
    const [, ai] = resolveEqualMassCollision(
      { x: 0, y: 0 }, { x: 2, y: 0.3 },
      { x: 0, y: 5 }, { x: 0, y: 0 },
      0.92, contact?.normal,
    );
    expect(Math.abs(ai.x)).toBeLessThan(0.01);
    expect(ai.y).toBeCloseTo(4.6, 1);
  });
});
