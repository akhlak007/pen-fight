import type { MatchMode } from '../app/app-state';

export type TurnPhase = 'player' | 'playerMoving' | 'aiWaiting' | 'aiMoving' | 'falling';
export type TurnAction = 'aiFlick' | 'playerReady' | null;
export type ArenaAction = 'ready' | 'aiming' | 'playerMoving' | 'aiWaiting' | 'aiMoving' | 'roundReset';

const settleSpeed = 0.45;
const settleDelay = 0.28;
const settleTimeout = 5;
const aiThinkDelay = 0.5;

export class SoloTurnController {
  #phase: TurnPhase = 'player';
  #quietTime = 0;
  #moveTime = 0;
  #waitTime = 0;
  #mode: MatchMode = 'quick';
  #activePlayer = 0;
  #playerCount = 2;
  readonly #eliminated = new Set<number>();

  get phase(): TurnPhase { return this.#phase; }
  get activePlayer(): number { return this.#activePlayer; }
  get playerCount(): number { return this.#playerCount; }
  get remainingPlayerCount(): number { return Math.max(0, this.#playerCount - this.#eliminated.size); }
  get survivingPlayers(): number[] {
    const list: number[] = [];
    for (let i = 0; i < this.#playerCount; i++) {
      if (!this.#eliminated.has(i)) list.push(i);
    }
    return list;
  }

  isEliminated(player: number): boolean { return this.#eliminated.has(player); }
  eliminatePlayer(player: number): void { this.#eliminated.add(player); }

  syncState(player: number, phase: TurnPhase): void {
    this.#activePlayer = player;
    this.#phase = phase;
    this.#quietTime = 0;
    this.#moveTime = 0;
  }

  begin(mode: MatchMode, startingPlayer = 0, playerCount = 2): void {
    this.#mode = mode;
    this.#playerCount = Math.max(2, Math.min(4, playerCount));
    this.#activePlayer = startingPlayer % this.#playerCount;
    this.#eliminated.clear();
    this.#phase = mode === 'quick' && startingPlayer === 1 ? 'aiWaiting' : 'player';
    this.#quietTime = 0;
    this.#moveTime = 0;
    this.#waitTime = 0;
  }

  playerFlicked(): boolean {
    if (this.#phase !== 'player') return false;
    this.#phase = 'playerMoving';
    this.#quietTime = 0;
    this.#moveTime = 0;
    return true;
  }

  tick(delta: number, totalSpeed: number): TurnAction {
    if (this.#phase === 'playerMoving' || this.#phase === 'aiMoving') {
      this.#moveTime += delta;
      this.#quietTime = totalSpeed < settleSpeed ? this.#quietTime + delta : 0;
      if (this.#quietTime < settleDelay && this.#moveTime < settleTimeout) return null;
      this.#quietTime = 0;
      this.#moveTime = 0;
      if (this.#phase === 'playerMoving' && this.#mode === 'quick') {
        this.#phase = 'aiWaiting';
        this.#activePlayer = 1;
        this.#waitTime = 0;
        return null;
      }
      if (this.#phase === 'aiMoving') {
        this.#activePlayer = 0;
      } else if (this.#mode === 'local') {
        let next = (this.#activePlayer + 1) % this.#playerCount;
        let checked = 0;
        while (this.#eliminated.has(next) && checked < this.#playerCount) {
          next = (next + 1) % this.#playerCount;
          checked += 1;
        }
        this.#activePlayer = next;
      } else if (this.#mode === 'online') {
        this.#activePlayer = this.#activePlayer === 0 ? 1 : 0;
      } else {
        this.#activePlayer = 0;
      }
      this.#phase = 'player';
      return 'playerReady';
    }
    if (this.#phase === 'aiWaiting') {
      this.#waitTime += delta;
      if (this.#waitTime >= aiThinkDelay) {
        this.#phase = 'aiMoving';
        this.#moveTime = 0;
        return 'aiFlick';
      }
    }
    return null;
  }

  startFall(): void { this.#phase = 'falling'; }

  finishPoint(nextPlayer = 0): void {
    this.#eliminated.clear();
    this.#activePlayer = nextPlayer % this.#playerCount;
    this.#phase = this.#mode === 'quick' && nextPlayer === 1 ? 'aiWaiting' : 'player';
    this.#quietTime = 0;
    this.#moveTime = 0;
    this.#waitTime = 0;
  }
}
