export type TurnPhase = 'player' | 'playerMoving' | 'aiWaiting' | 'aiMoving' | 'falling';
export type TurnAction = 'aiFlick' | 'playerReady' | null;

export class SoloTurnController {
  #phase: TurnPhase = 'player';
  #quietTime = 0;
  #waitTime = 0;
  #mode: 'quick' | 'practice' = 'quick';

  get phase(): TurnPhase { return this.#phase; }
  get activePlayer(): 0 | 1 { return this.#phase === 'aiWaiting' || this.#phase === 'aiMoving' ? 1 : 0; }

  begin(mode: 'quick' | 'practice'): void {
    this.#mode = mode;
    this.#phase = 'player';
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
      this.#quietTime = totalSpeed < 0.3 ? this.#quietTime + delta : 0;
      if (this.#quietTime < 0.42) return null;
      this.#quietTime = 0;
      if (this.#phase === 'playerMoving' && this.#mode === 'quick') {
        this.#phase = 'aiWaiting';
        this.#waitTime = 0;
        return null;
      }
      this.#phase = 'player';
      return 'playerReady';
    }
    if (this.#phase === 'aiWaiting') {
      this.#waitTime += delta;
      if (this.#waitTime >= 0.72) {
        this.#phase = 'aiMoving';
        return 'aiFlick';
      }
    }
    return null;
  }

  startFall(): void { this.#phase = 'falling'; }

  finishPoint(): void {
    this.#phase = 'player';
    this.#quietTime = 0;
    this.#waitTime = 0;
  }
}
