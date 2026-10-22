import './styles/global.css';
import { AppStore } from './app/app-store';
import { attachLifecycle } from './app/lifecycle';
import { GameRenderer } from './rendering/game-renderer';
import { defaultSave } from './storage/schema';
import { StorageService } from './storage/storage-service';
import { UiRoot } from './ui/ui-root';
import { OnlineSession, type OnlineState } from './network/online-session';
import type { ServerMessage } from './network/protocol';
import { AmbienceService } from './audio/ambience-service';
import { AVATARS, DESKS, PENS, itemUnlocked, validFlagCode } from './profile/profile-catalog';
import { levelForXp } from './profile/progression';
import { AccountClient } from './account/account-client';
import type { AccountSnapshot, LeaderboardPage } from './account/account-types';
import { challengeForLevel } from './game/arena-challenges';

function createApplicationShell(): { root: HTMLElement; canvas: HTMLCanvasElement } {
  const root = document.createElement('main');
  root.className = 'game-shell';
  root.setAttribute('aria-label', 'Pen Fight game');
  const canvas = document.createElement('canvas');
  canvas.className = 'game-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '3D classroom arena. During your turn, use arrow keys to aim and charge, then Space or Enter to flick.');
  canvas.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Space Enter Escape');
  root.append(canvas);
  return { root, canvas };
}

const mount = document.querySelector<HTMLElement>('#app');
if (!mount) throw new Error('Pen Fight could not find its application mount.');

const { root, canvas } = createApplicationShell();
mount.replaceChildren(root);
const store = new AppStore();
const fallbackValues = new Map<string, string>();
const fallbackStorage = {
  getItem: (key: string) => fallbackValues.get(key) ?? null,
  setItem: (key: string, value: string) => { fallbackValues.set(key, value); },
  removeItem: (key: string) => { fallbackValues.delete(key); },
};
let availableStorage = fallbackStorage;
try {
  availableStorage = window.localStorage;
} catch {
  // Sandboxed/private contexts can deny access to the localStorage getter itself.
}
const storage = new StorageService(availableStorage);
const save = storage.load();
store.hydrate(save.playerName, save.settings, {
  ...save.profile,
  ...save.progression,
  unlockedCosmeticIds: [...new Set([...save.unlockedPens, ...save.unlockedCosmetics])],
});
const online = new OnlineSession();
const accounts = new AccountClient();
const unlockedForStorage = (ids: readonly string[]) => ({
  unlockedPens: ids.filter((id) => PENS.some((pen) => pen.id === id)),
  unlockedCosmetics: ids.filter((id) => DESKS.some((desk) => desk.id === id)),
});
const ambience = new AmbienceService(`${import.meta.env.BASE_URL}audio/sound_of_class.mp3`);
ambience.setEnabled(save.settings.ambience);
ambience.startGameAmbience();
let pendingRoom = OnlineSession.roomFromUrl();
const publicProfile = () => ({
  avatarId: store.snapshot.profile.avatarId,
  flagCode: store.snapshot.profile.flagCode,
  penId: store.snapshot.profile.selectedPenId,
});
const currentQuickChallenge = () => challengeForLevel(levelForXp(store.snapshot.profile.xp));
let lockedQuickChallenge: ReturnType<typeof challengeForLevel> | null = null;

let renderer: GameRenderer | null = null;
try {
  renderer = new GameRenderer(canvas);
  renderer.setCosmeticLoadout(save.profile.selectedPenId, save.profile.selectedDeskId);
  renderer.setReducedMotion(save.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches);
  renderer.start();
} catch (error) {
  console.error('WebGL startup failed', error);
  canvas.classList.add('webgl-fallback');
}

let leaderboardPage: LeaderboardPage | undefined;
let applyingServerProfile = false;
const applyAccount = (account: AccountSnapshot) => {
  applyingServerProfile = true;
  store.hydrate(account.username, store.snapshot.settings, account.profile);
  storage.update({
    playerName: account.username,
    profile: {
      avatarId: account.profile.avatarId,
      flagCode: account.profile.flagCode,
      selectedPenId: account.profile.selectedPenId,
      selectedDeskId: account.profile.selectedDeskId,
    },
    progression: {
      wins: account.profile.wins,
      matches: account.profile.matches,
      xp: account.profile.xp,
      awardedMatchIds: account.profile.awardedMatchIds,
    },
    ...unlockedForStorage(account.profile.unlockedCosmeticIds),
  });
  renderer?.setPlayerName(account.username);
  renderer?.setCosmeticLoadout(account.profile.selectedPenId, account.profile.selectedDeskId);
  applyingServerProfile = false;
};

const ui = new UiRoot(store, {
  onSaveName(name) {
    store.setPlayerName(name);
    const current = storage.update({ playerName: store.snapshot.player.name });
    renderer?.setPlayerName(current.playerName);
    store.transition('home');
    if (pendingRoom) {
      const room = pendingRoom;
      pendingRoom = null;
      ui.setPendingInvite(null);
      store.transition('settingUpLocal');
      online.join(room, store.snapshot.player.name, publicProfile());
    }
  },
  onPlay() {
    store.transition('selectingMode');
    renderer?.focusArena();
    renderer?.setMatchEnabled(false);
  },
  onPlayFriend() {
    store.transition('settingUpLocal');
    renderer?.focusRoom();
    renderer?.setMatchEnabled(false);
  },
  onStartLocal(rivalName) {
    lockedQuickChallenge = null;
    ui.setChallengeBanner(null);
    store.startLocalMatch(rivalName);
    const playerCount = store.snapshot.match?.playerNames ? store.snapshot.match.playerNames.length : 2;
    renderer?.focusArena();
    renderer?.setLocalPlayer(null);
    renderer?.setCosmeticLoadout(null, store.snapshot.profile.selectedDeskId);
    renderer?.setMatchEnabled(true);
    renderer?.setMatchMode('local', playerCount, store.snapshot.match?.playerNames);
    ambience.startGameAmbience();
  },
  onCreateOnline() { online.create(store.snapshot.player.name, publicProfile()); },
  onJoinOnline(room) { online.join(room, store.snapshot.player.name, publicProfile()); },
  onCancelOnline() {
    online.close();
    ui.setOnlineState(online.state);
  },
  onCopyInvite() {
    const room = online.state.room; if (!room) return;
    const hasP2P = new URL(location.href).searchParams.has('p2p');
    const invite = new URL(location.href); invite.search = ''; invite.searchParams.set('room', room);
    if (hasP2P) invite.searchParams.set('p2p', '1');
    if (navigator.share) void navigator.share({ title: 'Pen Fight', text: 'Fight me in Pen Fight!', url: invite.toString() }).catch(() => navigator.clipboard?.writeText(invite.toString()));
    else void navigator.clipboard?.writeText(invite.toString());
  },
  onBack() {
    lockedQuickChallenge = null;
    ui.setChallengeBanner(null);
    online.close();
    renderer?.setInputListener(null);
    renderer?.setReplica(false);
    renderer?.setLocalPlayer(null);
    store.transition('home');
    renderer?.focusRoom();
    renderer?.setMatchEnabled(false);
    ambience.stopGameAmbience();
  },
  onChooseMode(mode) {
    storage.update({ lastMode: mode });
    lockedQuickChallenge = mode === 'quick' ? currentQuickChallenge() : null;
    const challenge = lockedQuickChallenge ?? undefined;
    ui.setChallengeBanner(challenge ? { level: challenge.level, name: challenge.name } : null);
    store.startMatch(mode);
    renderer?.focusArena();
    renderer?.setLocalPlayer(null);
    renderer?.setCosmeticLoadout(store.snapshot.profile.selectedPenId, store.snapshot.profile.selectedDeskId);
    renderer?.setMatchEnabled(true);
    renderer?.setMatchMode(mode, 2, undefined, challenge);
    ambience.startGameAmbience();
  },
  onRematch() {
    const match = store.snapshot.match;
    const mode = match?.mode ?? 'quick';
    const playerNames = match?.playerNames;
    if (mode === 'local' && match?.playerNames && match.playerNames.length > 2) {
      store.startLocalMatch(match.playerNames.slice(1));
    } else {
      store.startMatch(mode, match?.rivalName);
    }
    const playerCount = store.snapshot.match?.playerNames ? store.snapshot.match.playerNames.length : 2;
    const challenge = mode === 'quick' ? (lockedQuickChallenge ?? currentQuickChallenge()) : undefined;
    lockedQuickChallenge = challenge ?? null;
    ui.setChallengeBanner(challenge ? { level: challenge.level, name: challenge.name } : null);
    renderer?.setMatchEnabled(true);
    renderer?.setMatchMode(mode, playerCount, store.snapshot.match?.playerNames ?? playerNames, challenge);
    if (mode === 'online') {
      renderer?.setReplica(online.state.seat === 'guest');
      renderer?.setLocalPlayer(online.state.seat === 'guest' ? 1 : 0);
    } else {
      renderer?.setLocalPlayer(null);
      renderer?.setCosmeticLoadout(mode === 'local' ? null : store.snapshot.profile.selectedPenId, store.snapshot.profile.selectedDeskId);
    }
    renderer?.focusArena();
    ambience.startGameAmbience();
  },
  onEditName() {
    store.transition('naming');
  },
  onOpenProfile() {
    store.transition('profile');
    renderer?.focusRoom();
    renderer?.setMatchEnabled(false);
  },
  onOpenAccount() {
    if (store.snapshot.phase === 'home') store.transition('account');
    renderer?.focusRoom();
    renderer?.setMatchEnabled(false);
  },
  onOpenLeaderboard() {
    if (store.snapshot.phase === 'home') store.transition('leaderboard');
    leaderboardPage = undefined;
    ui.setLeaderboardState({ loading: true });
    void accounts.leaderboard().then((page) => {
      leaderboardPage = page;
      ui.setLeaderboardState({ loading: false, page });
    }).catch((error: unknown) => ui.setLeaderboardState({ loading: false, error: error instanceof Error ? error.message : 'Leaderboard unavailable.' }));
  },
  async onSignup(username, password) {
    const account = await accounts.signup(username, password, store.snapshot.profile);
    applyAccount(account);
  },
  async onLogin(username, password) {
    const account = await accounts.login(username, password);
    applyAccount(account);
  },
  async onLogout() {
    await accounts.logout();
  },
  onLoadMoreLeaderboard() {
    const current = leaderboardPage;
    if (!current || current.entries.length >= current.total) return;
    ui.setLeaderboardState({ loading: true, page: current });
    void accounts.leaderboard(current.entries.length).then((next) => {
      leaderboardPage = { ...next, offset: 0, entries: [...current.entries, ...next.entries] };
      ui.setLeaderboardState({ loading: false, page: leaderboardPage });
    }).catch((error: unknown) => ui.setLeaderboardState({ loading: false, page: current, error: error instanceof Error ? error.message : 'Leaderboard unavailable.' }));
  },
  onSetAvatar(avatarId) {
    if (AVATARS.some((avatar) => avatar.id === avatarId)) store.updateProfile({ avatarId });
  },
  onSetFlag(flagCode) {
    if (validFlagCode(flagCode)) store.updateProfile({ flagCode: flagCode.toUpperCase() });
  },
  onEquipPen(penId) {
    const pen = PENS.find((item) => item.id === penId);
    if (pen && (itemUnlocked(pen.unlockLevel, levelForXp(store.snapshot.profile.xp)) || store.snapshot.profile.unlockedCosmeticIds.includes(pen.id))) {
      store.updateProfile({ selectedPenId: pen.id });
      renderer?.setCosmeticLoadout(pen.id, store.snapshot.profile.selectedDeskId);
    }
  },
  onEquipDesk(deskId) {
    const desk = DESKS.find((item) => item.id === deskId);
    if (desk && (itemUnlocked(desk.unlockLevel, levelForXp(store.snapshot.profile.xp)) || store.snapshot.profile.unlockedCosmeticIds.includes(desk.id))) {
      store.updateProfile({ selectedDeskId: desk.id });
      renderer?.setCosmeticLoadout(store.snapshot.profile.selectedPenId, desk.id);
    }
  },
  onToggleReducedMotion(value) {
    store.updateSettings({ reducedMotion: value });
    storage.update({ settings: store.snapshot.settings });
    renderer?.setReducedMotion(value);
  },
  onToggleAmbience(value) {
    store.updateSettings({ ambience: value });
    storage.update({ settings: store.snapshot.settings });
    ambience.setEnabled(value);
  },
});
if (pendingRoom) ui.setPendingInvite(pendingRoom);
accounts.subscribe((state) => ui.setAccountState(state));
void accounts.restore().then((account) => { if (account) applyAccount(account); });

function enterOnlineMatch(state: OnlineState): void {
  if (state.status !== 'ready' || store.snapshot.phase !== 'settingUpLocal') return;
  lockedQuickChallenge = null;
  ui.setChallengeBanner(null);
  const hostName = state.players?.[0] || (state.seat === 'host' ? store.snapshot.player.name : 'Host');
  const guestName = state.players?.[1] || (state.seat === 'guest' ? store.snapshot.player.name : 'Guest');
  const playerNames = [hostName, guestName] as const;
  const rival = state.seat === 'host' ? guestName : hostName;
  store.startOnlineMatch(rival, playerNames, state.seat === 'guest' ? 1 : 0);
  renderer?.focusArena();
  renderer?.setMatchMode('online', 2, playerNames);
  renderer?.setReplica(state.seat === 'guest');
  renderer?.setLocalPlayer(state.seat === 'guest' ? 1 : 0);
  const remoteProfile = state.profiles?.[state.seat === 'guest' ? 0 : 1];
  renderer?.setCosmeticLoadout(store.snapshot.profile.selectedPenId, store.snapshot.profile.selectedDeskId, remoteProfile?.penId ?? null);
  renderer?.setMatchEnabled(true);
  ambience.startGameAmbience();

  let pendingAim: { x: number; y: number; grab?: number } | null = null;
  let aimSendTimer: number | null = null;
  const flushAim = () => {
    if (pendingAim && online.connected) {
      online.send({
        type: 'intent',
        action: 'aim',
        x: pendingAim.x,
        y: pendingAim.y,
        ...(pendingAim.grab !== undefined ? { grab: pendingAim.grab } : {}),
      });
      pendingAim = null;
    }
    aimSendTimer = null;
  };

  renderer?.setInputListener((action, x, y, grab) => {
    if (state.seat === 'guest') {
      if (action === 'aim' && x !== undefined && y !== undefined) {
        renderer?.remoteInput('aim', x, y, grab);
        pendingAim = { x, y, grab };
        if (aimSendTimer === null) {
          flushAim();
          aimSendTimer = window.setTimeout(flushAim, 30);
        }
      } else if (action === 'flick') {
        if (aimSendTimer !== null) {
          clearTimeout(aimSendTimer);
          aimSendTimer = null;
        }
        const finalX = x ?? pendingAim?.x;
        const finalY = y ?? pendingAim?.y;
        const finalGrab = grab ?? pendingAim?.grab;
        pendingAim = null;
        online.send({
          type: 'intent',
          action: 'flick',
          ...(finalX !== undefined ? { x: finalX } : {}),
          ...(finalY !== undefined ? { y: finalY } : {}),
          ...(finalGrab !== undefined ? { grab: finalGrab } : {}),
        });
        renderer?.remoteInput('flick', finalX, finalY, finalGrab);
      } else if (action === 'cancel') {
        if (aimSendTimer !== null) {
          clearTimeout(aimSendTimer);
          aimSendTimer = null;
        }
        pendingAim = null;
        online.send({ type: 'intent', action: 'cancel' });
        renderer?.remoteInput('cancel');
      }
      return true;
    }
    return store.snapshot.match?.currentPlayer === 1 ? true : undefined;
  });
}
online.addEventListener('state', (event) => {
  const state = (event as CustomEvent<OnlineState>).detail;
  ui.setOnlineState(state);
  enterOnlineMatch(state);
  if (store.snapshot.match?.mode === 'online' && state.seat) {
    const remoteProfile = state.profiles?.[state.seat === 'guest' ? 0 : 1];
    renderer?.setCosmeticLoadout(store.snapshot.profile.selectedPenId, store.snapshot.profile.selectedDeskId, remoteProfile?.penId ?? null);
  }
  if (store.snapshot.match?.mode === 'online') renderer?.setSuspended(state.status !== 'ready');
});
online.addEventListener('message', (event) => {
  const message = (event as CustomEvent<ServerMessage>).detail;
  if (message.type === 'intent' && online.state.seat === 'host') renderer?.remoteInput(message.action, message.x, message.y, message.grab);
  if (message.type === 'snapshot') {
    renderer?.applyArenaSnapshot(message.arena);
    if (online.state.seat === 'guest' && store.snapshot.phase === 'match') {
      store.syncOnlineMatch(message.arena.score, message.arena.currentPlayer, 'match');
    }
  }
  if (message.type === 'state' && online.state.seat === 'guest') {
    const rewardKey = online.state.room ? `${online.state.room.toLowerCase()}-${message.seq}` : undefined;
    store.syncOnlineMatch(message.score, message.currentPlayer, message.phase, rewardKey);
  }
});

renderer?.setPointListener((winner) => store.recordPoint(winner));
renderer?.setTurnListener((player) => store.setMatchTurn(player));
renderer?.setAimListener((power) => ui.setAimPower(power));
renderer?.setRoundListener((message) => ui.setRoundMessage(message));
renderer?.setActionListener((action) => ui.setArenaAction(action));
renderer?.setHitListener((intensity) => ui.triggerHit(intensity));
let persistedProfile = JSON.stringify(store.snapshot.profile);
store.subscribe((state) => {
  const nextProfile = JSON.stringify(state.profile);
  if (nextProfile !== persistedProfile) {
    persistedProfile = nextProfile;
    storage.update({
      profile: {
        avatarId: state.profile.avatarId,
        flagCode: state.profile.flagCode,
        selectedPenId: state.profile.selectedPenId,
        selectedDeskId: state.profile.selectedDeskId,
      },
      progression: {
        wins: state.profile.wins,
        matches: state.profile.matches,
        xp: state.profile.xp,
        awardedMatchIds: state.profile.awardedMatchIds,
      },
      ...unlockedForStorage(state.profile.unlockedCosmeticIds),
    });
    if (!applyingServerProfile && accounts.state.status === 'authenticated') void accounts.syncProfile(state.profile);
  }
  const rival = state.match?.rivalName ?? (state.match?.mode === 'local' ? 'PLAYER 2' : state.match?.mode === 'quick' ? 'CLASS ACE' : 'AI rival');
  renderer?.setBoardState(state.player.name, rival, state.match?.score ?? [0, 0]);
  renderer?.setSuspended(state.phase === 'paused' || (state.match?.mode === 'online' && online.state.status !== 'ready'));
  if (state.phase === 'result') {
    renderer?.setMatchEnabled(false);
  } else if (state.phase === 'match') {
    renderer?.setMatchEnabled(true);
  }
  if (state.match?.mode === 'online' && online.state.seat === 'host') {
    const onlineScore: readonly [number, number] = [state.match.score[0] ?? 0, state.match.score[1] ?? 0];
    const onlinePlayer: 0 | 1 = state.match.currentPlayer === 1 ? 1 : 0;
    online.send({ type: 'state', score: onlineScore, currentPlayer: onlinePlayer, phase: state.phase === 'result' ? 'result' : 'match' });
  }
  if (state.settings.ambience && !ambience.shouldPlay) {
    ambience.startGameAmbience();
  }
});
let onlineSnapshotSeq = 0;
let lastSnapshotSend = 0;
let wasMoving = false;
window.setInterval(() => {
  const state = store.snapshot;
  if (state.phase !== 'match' || state.match?.mode !== 'online' || online.state.seat !== 'host' || !renderer) return;
  const now = performance.now();
  const moving = renderer.isPenMoving();
  const interval = moving ? 40 : 300;
  if (now - lastSnapshotSend >= interval || moving !== wasMoving) {
    lastSnapshotSend = now;
    wasMoving = moving;
    online.send({ type: 'snapshot', arena: renderer.getArenaSnapshot(++onlineSnapshotSeq, state.match.score) });
  }
}, 16);

attachLifecycle(store);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    ambience.pauseForVisibility();
  } else {
    ambience.resumeFromVisibility();
  }
});
renderer?.setPlayerName(save.playerName);

async function finishBoot(): Promise<void> {
  const steps = [
    [0.22, 'Opening the classroom…'],
    [0.5, 'Polishing the desk…'],
    [0.78, 'Counting the pens…'],
    [1, 'Your seat is ready.'],
  ] as const;
  for (const [progress, label] of steps) {
    store.setLoadProgress(progress * 100, 100, label);
    await new Promise<void>((resolve) => window.setTimeout(resolve, save.settings.reducedMotion ? 20 : 170));
  }
  store.transition(save.playerName ? 'home' : 'naming');
  if (save.settings.ambience) {
    ambience.startGameAmbience();
  }
  if (pendingRoom && save.playerName) {
    const room = pendingRoom;
    pendingRoom = null;
    ui.setPendingInvite(null);
    store.transition('settingUpLocal');
    online.join(room, save.playerName, publicProfile());
  }
}

void finishBoot().catch(() => {
  store.hydrate('', defaultSave.settings);
  store.transition('naming');
});
