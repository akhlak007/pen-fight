export type AppPhase =
  | 'booting'
  | 'naming'
  | 'home'
  | 'profile'
  | 'account'
  | 'leaderboard'
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

export interface ProfileSnapshot {
  readonly avatarId: string;
  readonly flagCode: string;
  readonly selectedPenId: string;
  readonly selectedDeskId: string;
  readonly wins: number;
  readonly matches: number;
  readonly xp: number;
  readonly unlockedCosmeticIds: readonly string[];
  readonly awardedMatchIds: readonly string[];
}

export interface MatchRewardSnapshot {
  readonly eligible: boolean;
  readonly xp: number;
  readonly previousXp: number;
  readonly newXp: number;
  readonly previousLevel: number;
  readonly newLevel: number;
  readonly unlockedIds: readonly string[];
  readonly reason?: 'practice' | 'local' | 'incomplete' | 'duplicate';
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
  readonly localPlayer: number;
  readonly rewardId: number;
  readonly rewardRecorded: boolean;
  readonly reward?: MatchRewardSnapshot;
}

export interface AppState {
  readonly phase: AppPhase;
  readonly player: PlayerState;
  readonly profile: ProfileSnapshot;
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
    profile: {
      avatarId: 'cool',
      flagCode: 'BD',
      selectedPenId: 'classic-blue',
      selectedDeskId: 'classroom-oak',
      wins: 0,
      matches: 0,
      xp: 0,
      unlockedCosmeticIds: ['classic-blue'],
      awardedMatchIds: [],
    },
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
        ...(state.match.reward ? {
          reward: Object.freeze({
            ...state.match.reward,
            unlockedIds: Object.freeze([...state.match.reward.unlockedIds]),
          }),
        } : {}),
      })
    : null;

  return Object.freeze({
    ...state,
    player: Object.freeze({ ...state.player }),
    profile: Object.freeze({
      ...state.profile,
      unlockedCosmeticIds: Object.freeze([...state.profile.unlockedCosmeticIds]),
      awardedMatchIds: Object.freeze([...state.profile.awardedMatchIds]),
    }),
    settings: Object.freeze({ ...state.settings }),
    loadProgress: Object.freeze({ ...state.loadProgress }),
    match,
  });
}
