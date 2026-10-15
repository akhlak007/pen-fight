import {
  type AppSettings,
  type AppPhase,
  type AppState,
  createInitialState,
  freezeState,
} from './app-state';

type AppListener = (state: AppState) => void;

const legalTransitions: Readonly<Record<AppPhase, readonly AppPhase[]>> = {
  booting: ['naming', 'home', 'fatalError'],
  naming: ['home', 'fatalError'],
  home: ['naming', 'selectingMode', 'match', 'fatalError'],
  selectingMode: ['home', 'match', 'fatalError'],
  match: ['paused', 'result', 'home', 'fatalError'],
  paused: ['match', 'home', 'fatalError'],
  result: ['match', 'home', 'selectingMode', 'fatalError'],
  fatalError: ['booting'],
};

export class AppStore {
  #state: AppState = createInitialState();
  readonly #listeners = new Set<AppListener>();

  get snapshot(): AppState {
    return this.#state;
  }

  subscribe(listener: AppListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  transition(phase: AppPhase): void {
    if (phase === this.#state.phase) return;
    if (!legalTransitions[this.#state.phase].includes(phase)) {
      throw new Error(`Illegal app transition: ${this.#state.phase} -> ${phase}`);
    }
    this.#publish({ ...this.#state, phase, pauseReason: undefined });
  }

  setPlayerName(value: string): void {
    const name = value.trim().slice(0, 18);
    if (!name) throw new Error('Player name cannot be empty.');
    this.#publish({ ...this.#state, player: { name } });
  }

  hydrate(playerName: string, settings: AppSettings): void {
    this.#publish({
      ...this.#state,
      player: { name: playerName.trim().slice(0, 18) },
      settings,
    });
  }

  setLoadProgress(loaded: number, total: number, label: string): void {
    this.#publish({
      ...this.#state,
      loadProgress: {
        loaded: Math.max(0, loaded),
        total: Math.max(1, total),
        label,
      },
    });
  }

  updateSettings(patch: Partial<AppSettings>): void {
    this.#publish({
      ...this.#state,
      settings: { ...this.#state.settings, ...patch },
    });
  }

  startMatch(mode: 'quick' | 'practice'): void {
    if (this.#state.phase !== 'selectingMode' && this.#state.phase !== 'result') {
      throw new Error(`Cannot start a match from ${this.#state.phase}.`);
    }
    this.#publish({
      ...this.#state,
      phase: 'match',
      match: { score: [0, 0], currentPlayer: 0, mode },
    });
  }

  recordPoint(winner: 0 | 1): void {
    const match = this.#state.match;
    if (this.#state.phase !== 'match' || !match || match.mode === 'practice') return;
    const score: [number, number] = [...match.score];
    score[winner] += 1;
    this.#publish({
      ...this.#state,
      phase: score[winner] >= 3 ? 'result' : 'match',
      match: { ...match, score, currentPlayer: 0, lastScorer: winner },
    });
  }

  setMatchTurn(player: 0 | 1): void {
    const match = this.#state.match;
    if (this.#state.phase !== 'match' || !match || match.currentPlayer === player) return;
    this.#publish({ ...this.#state, match: { ...match, currentPlayer: player } });
  }

  pauseForVisibility(): void {
    if (this.#state.phase !== 'match') return;
    this.#publish({
      ...this.#state,
      phase: 'paused',
      pauseReason: 'visibility',
    });
  }

  resumeFromVisibility(): void {
    if (
      this.#state.phase !== 'paused' ||
      this.#state.pauseReason !== 'visibility'
    ) {
      return;
    }
    this.#publish({ ...this.#state, phase: 'match', pauseReason: undefined });
  }

  pauseManually(): void {
    if (this.#state.phase !== 'match') return;
    this.#publish({
      ...this.#state,
      phase: 'paused',
      pauseReason: 'manual',
    });
  }

  #publish(next: AppState): void {
    this.#state = freezeState(next);
    for (const listener of this.#listeners) listener(this.#state);
  }
}
