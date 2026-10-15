import { describe, expect, it } from 'vitest';
import { SoloTurnController } from './solo-turn-controller';

describe('SoloTurnController', () => {
  it('hands a settled quick-match shot to the AI and back to the player', () => {
    const turns = new SoloTurnController();
    turns.begin('quick');
    expect(turns.playerFlicked()).toBe(true);
    expect(turns.tick(0.43, 0)).toBeNull();
    expect(turns.phase).toBe('aiWaiting');
    expect(turns.tick(0.73, 0)).toBe('aiFlick');
    expect(turns.activePlayer).toBe(1);
    expect(turns.tick(0.43, 0)).toBe('playerReady');
    expect(turns.phase).toBe('player');
  });

  it('never schedules an AI turn in practice mode', () => {
    const turns = new SoloTurnController();
    turns.begin('practice');
    turns.playerFlicked();
    expect(turns.tick(0.43, 0)).toBe('playerReady');
    expect(turns.phase).toBe('player');
  });

  it('locks input while a pen is falling and resets after the point', () => {
    const turns = new SoloTurnController();
    turns.begin('quick');
    turns.startFall();
    expect(turns.playerFlicked()).toBe(false);
    turns.finishPoint();
    expect(turns.playerFlicked()).toBe(true);
  });
});
