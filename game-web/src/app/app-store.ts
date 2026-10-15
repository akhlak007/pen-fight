import {
  type AppPhase,
  type AppState,
  createInitialState,
  freezeState,
} from './app-state';

type AppListener = (state: AppState) => void;

const legalTransitions: Readonly<Record<AppPhase, readonly AppPhase[]>> = {
  booting: ['naming', 'home', 'fatalError'],
  naming: ['home', 'fatalError'],
  home: ['selectingMode', 'match', 'fatalError'],
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
