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

  it('alternates human players without scheduling AI in local mode', () => {
    const turns = new SoloTurnController();
    turns.begin('local');
    expect(turns.activePlayer).toBe(0);

    expect(turns.playerFlicked()).toBe(true);
    expect(turns.tick(0.29, 0)).toBe('playerReady');
    expect(turns.phase).toBe('player');
    expect(turns.activePlayer).toBe(1);
    expect(turns.tick(1, 0)).toBeNull();

    expect(turns.playerFlicked()).toBe(true);
    expect(turns.tick(0.29, 0)).toBe('playerReady');
    expect(turns.activePlayer).toBe(0);
  });

  it('hands over a stopped shot promptly and keeps the AI pause brief', () => {
    const turns = new SoloTurnController();
    turns.begin('quick');
    turns.playerFlicked();
    expect(turns.tick(0.29, 0)).toBeNull();
    expect(turns.phase).toBe('aiWaiting');
    expect(turns.tick(0.51, 0)).toBe('aiFlick');
  });

  it('ends a shot after the safety timeout even if motion never becomes quiet', () => {
    const turns = new SoloTurnController();
    turns.begin('local');
    turns.playerFlicked();

    expect(turns.tick(4.9, 10)).toBeNull();
    expect(turns.phase).toBe('playerMoving');
    expect(turns.tick(0.11, 10)).toBe('playerReady');
    expect(turns.activePlayer).toBe(1);
  });

  it('locks input while a pen is falling and resets after the point', () => {
    const turns = new SoloTurnController();
    turns.begin('quick');
    turns.startFall();
    expect(turns.playerFlicked()).toBe(false);
    turns.finishPoint();
    expect(turns.playerFlicked()).toBe(true);
    expect(turns.activePlayer).toBe(0);
  });

  it('returns local control to player 1 after a point', () => {
    const turns = new SoloTurnController();
    turns.begin('local');
    expect(turns.playerFlicked()).toBe(true);
    expect(turns.tick(0.29, 0)).toBe('playerReady');
    expect(turns.activePlayer).toBe(1);
    turns.startFall();
    turns.finishPoint();
    expect(turns.phase).toBe('player');
    expect(turns.activePlayer).toBe(0);
  });

  it('rejects extra player flicks throughout motion and the AI turn', () => {
    const turns = new SoloTurnController();
    turns.begin('quick');
    expect(turns.playerFlicked()).toBe(true);
    expect(turns.playerFlicked()).toBe(false);
    turns.tick(0.43, 0);
    expect(turns.phase).toBe('aiWaiting');
    expect(turns.playerFlicked()).toBe(false);
    turns.tick(0.73, 0);
    expect(turns.phase).toBe('aiMoving');
    expect(turns.playerFlicked()).toBe(false);
  });

  it('rotates through 4 players in local mode', () => {
    const turns = new SoloTurnController();
    turns.begin('local', 0, 4);
    expect(turns.activePlayer).toBe(0);

    turns.playerFlicked();
    expect(turns.tick(0.29, 0)).toBe('playerReady');
    expect(turns.activePlayer).toBe(1);

    turns.playerFlicked();
    expect(turns.tick(0.29, 0)).toBe('playerReady');
    expect(turns.activePlayer).toBe(2);

    turns.playerFlicked();
    expect(turns.tick(0.29, 0)).toBe('playerReady');
    expect(turns.activePlayer).toBe(3);

    turns.playerFlicked();
    expect(turns.tick(0.29, 0)).toBe('playerReady');
    expect(turns.activePlayer).toBe(0);
  });

  it('skips eliminated players in 4-player local mode', () => {
    const turns = new SoloTurnController();
    turns.begin('local', 0, 4);
    expect(turns.activePlayer).toBe(0);

    // Player 1 gets eliminated
    turns.eliminatePlayer(1);
    expect(turns.isEliminated(1)).toBe(true);
    expect(turns.remainingPlayerCount).toBe(3);

    // Player 0 flicks
    turns.playerFlicked();
    expect(turns.tick(0.29, 0)).toBe('playerReady');
    // Player 1 is skipped, goes directly to player 2
    expect(turns.activePlayer).toBe(2);

    // Player 3 gets eliminated
    turns.eliminatePlayer(3);
    expect(turns.remainingPlayerCount).toBe(2);

    // Player 2 flicks
    turns.playerFlicked();
    expect(turns.tick(0.29, 0)).toBe('playerReady');
    // Player 3 is skipped, goes back to player 0
    expect(turns.activePlayer).toBe(0);
  });
});
