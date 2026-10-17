import {
  type AppSettings,
  type AppPhase,
  type AppState,
  type MatchMode,
  createInitialState,
  freezeState,
} from './app-state';

type AppListener = (state: AppState) => void;

const legalTransitions: Readonly<Record<AppPhase, readonly AppPhase[]>> = {
  booting: ['naming', 'home', 'fatalError'],
  naming: ['home', 'fatalError'],
  home: ['naming', 'settingUpLocal', 'selectingMode', 'match', 'fatalError'],
  settingUpLocal: ['home', 'match', 'fatalError'],
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

  startMatch(mode: MatchMode, rivalName?: string): void {
    if (this.#state.phase !== 'selectingMode' && this.#state.phase !== 'result') {
      throw new Error(`Cannot start a match from ${this.#state.phase}.`);
    }
    const localRival = mode === 'local' || mode === 'online'
      ? (rivalName ?? '').trim().slice(0, 18)
      : mode === 'quick'
        ? (rivalName?.trim() || 'CLASS ACE')
        : undefined;
    if ((mode === 'local' || mode === 'online') && !localRival) throw new Error('Second player name cannot be empty.');
    this.#publish({
      ...this.#state,
      phase: 'match',
      match: { score: [0, 0], currentPlayer: 0, mode, ...(localRival ? { rivalName: localRival } : {}) },
    });
  }

  startLocalMatch(value: string | readonly string[]): void {
    if (this.#state.phase !== 'settingUpLocal') {
      throw new Error(`Cannot start a local match from ${this.#state.phase}.`);
    }
    const rivals = Array.isArray(value) ? value : [value];
    const cleanedRivals = rivals.map((name) => name.trim().slice(0, 18)).filter(Boolean);
    if (cleanedRivals.length === 0) throw new Error('Second player name cannot be empty.');
    const playerNames = [this.#state.player.name, ...cleanedRivals];
    const score = playerNames.map(() => 0);
    this.#publish({
      ...this.#state,
      phase: 'match',
      match: {
        score,
        currentPlayer: 0,
        mode: 'local',
        rivalName: cleanedRivals[0],
        playerNames,
      },
    });
  }

  startOnlineMatch(rivalName: string): void {
    if (this.#state.phase !== 'settingUpLocal') throw new Error(`Cannot start an online match from ${this.#state.phase}.`);
    const rival = rivalName.trim().slice(0, 18);
    if (!rival) throw new Error('Online rival name cannot be empty.');
    this.#publish({ ...this.#state, phase: 'match', match: { score: [0, 0], currentPlayer: 0, mode: 'online', rivalName: rival } });
  }

  recordPoint(winner: number): void {
    const match = this.#state.match;
    if (this.#state.phase !== 'match' || !match || match.mode === 'practice') return;
    const score = [...match.score];
    if (winner >= 0 && winner < score.length) {
      score[winner] = (score[winner] ?? 0) + 1;
    }
    const currentScore = score[winner] ?? 0;
    this.#publish({
      ...this.#state,
      phase: currentScore >= 2 ? 'result' : 'match',
      match: { ...match, score, currentPlayer: 0, lastScorer: winner },
    });
  }

  setMatchTurn(player: number): void {
    const match = this.#state.match;
    if (this.#state.phase !== 'match' || !match || match.currentPlayer === player) return;
    this.#publish({ ...this.#state, match: { ...match, currentPlayer: player } });
  }

  syncOnlineMatch(score: readonly [number, number], currentPlayer: 0 | 1, phase: 'match' | 'result'): void {
    const match = this.#state.match;
    if (!match || match.mode !== 'online' || (this.#state.phase !== 'match' && this.#state.phase !== 'result')) return;
    this.#publish({ ...this.#state, phase, match: { ...match, score: [score[0], score[1]], currentPlayer } });
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
