import {
  type AppSettings,
  type AppPhase,
  type AppState,
  type MatchMode,
  type ProfileSnapshot,
  type MatchRewardSnapshot,
  createInitialState,
  freezeState,
} from './app-state';
import { AVATARS, DESKS, PENS, newlyUnlocked, validFlagCode } from '../profile/profile-catalog';
import { levelForXp, rewardForMatch } from '../profile/progression';

type AppListener = (state: AppState) => void;

const legalTransitions: Readonly<Record<AppPhase, readonly AppPhase[]>> = {
  booting: ['naming', 'home', 'fatalError'],
  naming: ['home', 'fatalError'],
  home: ['naming', 'profile', 'account', 'leaderboard', 'settingUpLocal', 'selectingMode', 'match', 'fatalError'],
  profile: ['home', 'naming', 'fatalError'],
  account: ['home', 'leaderboard', 'fatalError'],
  leaderboard: ['home', 'account', 'fatalError'],
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
  #matchSequence = 0;

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

  hydrate(playerName: string, settings: AppSettings, profile?: ProfileSnapshot): void {
    this.#publish({
      ...this.#state,
      player: { name: playerName.trim().slice(0, 18) },
      settings,
      ...(profile ? { profile } : {}),
    });
  }

  updateProfile(patch: Partial<Pick<ProfileSnapshot, 'avatarId' | 'flagCode' | 'selectedPenId' | 'selectedDeskId'>>): void {
    const level = levelForXp(this.#state.profile.xp);
    if (patch.avatarId !== undefined && !AVATARS.some((item) => item.id === patch.avatarId)) throw new Error('Unknown avatar.');
    if (patch.flagCode !== undefined && !validFlagCode(patch.flagCode)) throw new Error('Unknown flag.');
    if (patch.selectedPenId !== undefined) {
      const pen = PENS.find((item) => item.id === patch.selectedPenId);
      if (!pen || (pen.unlockLevel > level && !this.#state.profile.unlockedCosmeticIds.includes(pen.id))) throw new Error('Pen is locked.');
    }
    if (patch.selectedDeskId !== undefined) {
      const desk = DESKS.find((item) => item.id === patch.selectedDeskId);
      if (!desk || (desk.unlockLevel > level && !this.#state.profile.unlockedCosmeticIds.includes(desk.id))) throw new Error('Desk is locked.');
    }
    const normalizedPatch = patch.flagCode === undefined ? patch : { ...patch, flagCode: patch.flagCode.toUpperCase() };
    this.#publish({ ...this.#state, profile: { ...this.#state.profile, ...normalizedPatch } });
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

  startMatch(mode: MatchMode, rivalName?: string, localPlayer?: number): void {
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
      match: {
        score: [0, 0],
        currentPlayer: 0,
        mode,
        localPlayer: localPlayer ?? (this.#state.match?.mode === mode ? this.#state.match.localPlayer : 0),
        rewardId: ++this.#matchSequence,
        rewardRecorded: false,
        ...(localRival ? { rivalName: localRival } : {}),
      },
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
        localPlayer: 0,
        rewardId: ++this.#matchSequence,
        rewardRecorded: false,
      },
    });
  }

  startOnlineMatch(rivalName: string, playerNames?: readonly string[], localPlayer = 0): void {
    if (this.#state.phase !== 'settingUpLocal') throw new Error(`Cannot start an online match from ${this.#state.phase}.`);
    const rival = rivalName.trim().slice(0, 18);
    if (!rival) throw new Error('Online rival name cannot be empty.');
    this.#publish({
      ...this.#state,
      phase: 'match',
      match: {
        score: [0, 0],
        currentPlayer: 0,
        mode: 'online',
        rivalName: rival,
        localPlayer,
        rewardId: ++this.#matchSequence,
        rewardRecorded: false,
        ...(playerNames ? { playerNames } : {}),
      },
    });
  }

  recordPoint(winner: number): void {
    const match = this.#state.match;
    if (this.#state.phase !== 'match' || !match) return;
    const score = [...match.score];
    if (winner >= 0 && winner < score.length) {
      score[winner] = (score[winner] ?? 0) + 1;
    }
    const currentScore = score[winner] ?? 0;
    const nextMatch = { ...match, score, lastScorer: winner };
    if (currentScore >= 2) {
      const completed = this.#withReward(nextMatch, winner);
      this.#publish({ ...this.#state, phase: 'result', match: completed.match, profile: completed.profile });
      return;
    }
    this.#publish({
      ...this.#state,
      phase: 'match',
      match: nextMatch,
    });
  }

  setMatchTurn(player: number): void {
    const match = this.#state.match;
    if (this.#state.phase !== 'match' || !match || match.currentPlayer === player) return;
    this.#publish({ ...this.#state, match: { ...match, currentPlayer: player } });
  }

  syncOnlineMatch(score: readonly [number, number], currentPlayer: 0 | 1, phase: 'match' | 'result', rewardKey?: string): void {
    const match = this.#state.match;
    if (!match || match.mode !== 'online' || (this.#state.phase !== 'match' && this.#state.phase !== 'result')) return;
    const startingRematch = phase === 'match' && this.#state.phase === 'result';
    const nextMatch: NonNullable<AppState['match']> = startingRematch
      ? {
          mode: 'online',
          score: [score[0], score[1]],
          currentPlayer,
          localPlayer: match.localPlayer,
          rewardId: ++this.#matchSequence,
          rewardRecorded: false,
          ...(match.rivalName ? { rivalName: match.rivalName } : {}),
          ...(match.playerNames ? { playerNames: match.playerNames } : {}),
        }
      : { ...match, score: [score[0], score[1]], currentPlayer };
    if (phase === 'result' && !match.rewardRecorded) {
      const winner = score[0] >= score[1] ? 0 : 1;
      const completed = this.#withReward(nextMatch, winner, rewardKey);
      this.#publish({ ...this.#state, phase, match: completed.match, profile: completed.profile });
      return;
    }
    this.#publish({ ...this.#state, phase, match: nextMatch });
  }

  #withReward(match: NonNullable<AppState['match']>, winner: number, rewardKey?: string): { match: NonNullable<AppState['match']>; profile: ProfileSnapshot } {
    if (match.rewardRecorded) return { match, profile: this.#state.profile };
    if (rewardKey && this.#state.profile.awardedMatchIds.includes(rewardKey)) {
      const level = levelForXp(this.#state.profile.xp);
      return {
        match: { ...match, rewardRecorded: true, reward: { eligible: false, xp: 0, previousXp: this.#state.profile.xp, newXp: this.#state.profile.xp, previousLevel: level, newLevel: level, unlockedIds: [], reason: 'duplicate' } },
        profile: this.#state.profile,
      };
    }
    const won = winner === match.localPlayer;
    const award = rewardForMatch(match.mode, won);
    const previousXp = this.#state.profile.xp;
    const newXp = Math.min(Number.MAX_SAFE_INTEGER, previousXp + award.xp);
    const previousLevel = levelForXp(previousXp);
    const newLevel = levelForXp(newXp);
    const reward: MatchRewardSnapshot = {
      eligible: award.eligible,
      xp: award.xp,
      previousXp,
      newXp,
      previousLevel,
      newLevel,
      unlockedIds: newlyUnlocked(previousLevel, newLevel).map((item) => item.id),
      ...(award.reason ? { reason: award.reason } : {}),
    };
    return {
      match: { ...match, rewardRecorded: true, reward },
      profile: {
        ...this.#state.profile,
        xp: newXp,
        matches: Math.min(Number.MAX_SAFE_INTEGER, this.#state.profile.matches + award.matchIncrement),
        wins: Math.min(Number.MAX_SAFE_INTEGER, this.#state.profile.wins + award.winIncrement),
        awardedMatchIds: rewardKey
          ? [...this.#state.profile.awardedMatchIds.filter((id) => id !== rewardKey), rewardKey].slice(-100)
          : this.#state.profile.awardedMatchIds,
      },
    };
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
