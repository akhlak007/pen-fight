import { describe, expect, it } from 'vitest';
import { AI_CORNER, capsuleContact, isOutsideTable, knockoutWinner, PLAYER_CORNER, resolveEqualMassCollision } from './pen-rules';

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

  it('detects contact between the ends of long pens', () => {
    const contact = capsuleContact(
      { x: 0, y: 0 }, 0,
      { x: 3.8, y: 0 }, 0,
    );
    expect(contact).not.toBeNull();
  });
});
