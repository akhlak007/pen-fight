import type { MatchMode } from '../app/app-state';

export type TurnPhase = 'player' | 'playerMoving' | 'aiWaiting' | 'aiMoving' | 'falling';
export type TurnAction = 'aiFlick' | 'playerReady' | null;
export type ArenaAction = 'ready' | 'aiming' | 'playerMoving' | 'aiWaiting' | 'aiMoving' | 'roundReset';

const settleSpeed = 0.45;
const settleDelay = 0.28;
const aiThinkDelay = 0.5;

export class SoloTurnController {
  #phase: TurnPhase = 'player';
  #quietTime = 0;
  #waitTime = 0;
  #mode: MatchMode = 'quick';
  #activePlayer: 0 | 1 = 0;

  get phase(): TurnPhase { return this.#phase; }
  get activePlayer(): 0 | 1 { return this.#activePlayer; }
  syncState(player: 0 | 1, phase: TurnPhase): void { this.#activePlayer = player; this.#phase = phase; this.#quietTime = 0; }

  begin(mode: MatchMode): void {
    this.#mode = mode;
    this.#phase = 'player';
    this.#activePlayer = 0;
    this.#quietTime = 0;
    this.#waitTime = 0;
  }

  playerFlicked(): boolean {
    if (this.#phase !== 'player') return false;
    this.#phase = 'playerMoving';
    this.#quietTime = 0;
    return true;
  }

  tick(delta: number, totalSpeed: number): TurnAction {
    if (this.#phase === 'playerMoving' || this.#phase === 'aiMoving') {
      this.#quietTime = totalSpeed < settleSpeed ? this.#quietTime + delta : 0;
      if (this.#quietTime < settleDelay) return null;
      this.#quietTime = 0;
      if (this.#phase === 'playerMoving' && this.#mode === 'quick') {
        this.#phase = 'aiWaiting';
        this.#activePlayer = 1;
        this.#waitTime = 0;
        return null;
      }
      this.#activePlayer = this.#phase === 'aiMoving'
        ? 0
        : this.#mode === 'local' || this.#mode === 'online'
          ? this.#activePlayer === 0 ? 1 : 0
          : 0;
      this.#phase = 'player';
      return 'playerReady';
    }
    if (this.#phase === 'aiWaiting') {
      this.#waitTime += delta;
      if (this.#waitTime >= aiThinkDelay) {
        this.#phase = 'aiMoving';
        return 'aiFlick';
      }
    }
    return null;
  }

  startFall(): void { this.#phase = 'falling'; }

  finishPoint(): void {
    this.#phase = 'player';
    this.#activePlayer = 0;
    this.#quietTime = 0;
    this.#waitTime = 0;
  }
}
