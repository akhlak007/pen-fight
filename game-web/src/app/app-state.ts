export type AppPhase =
  | 'booting'
  | 'naming'
  | 'home'
  | 'settingUpLocal'
  | 'selectingMode'
  | 'match'
  | 'paused'
  | 'result'
  | 'fatalError';

export type GraphicsProfile = 'auto' | 'ultra' | 'high' | 'performance';
export type PauseReason = 'manual' | 'visibility';
export type MatchMode = 'quick' | 'practice' | 'local' | 'online';

export interface AppSettings {
  readonly music: boolean;
  readonly ambience: boolean;
  readonly effects: boolean;
  readonly haptics: boolean;
  readonly reducedMotion: boolean;
  readonly graphicsProfile: GraphicsProfile;
}

export interface PlayerState {
  readonly name: string;
}

export interface LoadProgress {
  readonly loaded: number;
  readonly total: number;
  readonly label: string;
}

export interface MatchSnapshot {
  readonly score: readonly number[];
  readonly currentPlayer: number;
  readonly mode: MatchMode;
  readonly rivalName?: string;
  readonly playerNames?: readonly string[];
  readonly lastScorer?: number;
}

export interface AppState {
  readonly phase: AppPhase;
  readonly player: PlayerState;
  readonly settings: AppSettings;
  readonly loadProgress: LoadProgress;
  readonly match: MatchSnapshot | null;
  readonly pauseReason?: PauseReason;
}

export const defaultSettings: AppSettings = Object.freeze({
  music: true,
  ambience: true,
  effects: true,
  haptics: true,
  reducedMotion: false,
  graphicsProfile: 'auto',
});

export function createInitialState(): AppState {
  return freezeState({
    phase: 'booting',
    player: { name: '' },
    settings: defaultSettings,
    loadProgress: { loaded: 0, total: 1, label: 'Finding your seat.' },
    match: null,
  });
}

export function freezeState(state: AppState): AppState {
  const match = state.match
    ? Object.freeze({
        ...state.match,
        score: Object.freeze([...state.match.score]) as readonly [number, number],
      })
    : null;

  return Object.freeze({
    ...state,
    player: Object.freeze({ ...state.player }),
    settings: Object.freeze({ ...state.settings }),
    loadProgress: Object.freeze({ ...state.loadProgress }),
    match,
  });
}
