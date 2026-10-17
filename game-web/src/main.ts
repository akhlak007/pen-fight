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
store.hydrate(save.playerName, save.settings);
const online = new OnlineSession();
const ambience = new AmbienceService(`${import.meta.env.BASE_URL}audio/sound_of_class.mp3`);
ambience.setEnabled(save.settings.ambience);
let pendingRoom = OnlineSession.roomFromUrl();

let renderer: GameRenderer | null = null;
try {
  renderer = new GameRenderer(canvas);
  renderer.setReducedMotion(save.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches);
  renderer.start();
} catch (error) {
  console.error('WebGL startup failed', error);
  canvas.classList.add('webgl-fallback');
}

const ui = new UiRoot(store, {
  onSaveName(name) {
    store.setPlayerName(name);
    const current = storage.update({ playerName: store.snapshot.player.name });
    renderer?.setPlayerName(current.playerName);
    store.transition('home');
    if (pendingRoom) { const room = pendingRoom; pendingRoom = null; store.transition('settingUpLocal'); online.join(room, store.snapshot.player.name); }
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
    store.startLocalMatch(rivalName);
    const playerCount = store.snapshot.match?.playerNames ? store.snapshot.match.playerNames.length : 2;
    renderer?.focusArena();
    renderer?.setMatchEnabled(true);
    renderer?.setMatchMode('local', playerCount, store.snapshot.match?.playerNames);
    ambience.startGameAmbience();
  },
  onCreateOnline() { online.create(store.snapshot.player.name); },
  onJoinOnline(room) { online.join(room, store.snapshot.player.name); },
  onCopyInvite() {
    const room = online.state.room; if (!room) return;
    const invite = new URL(location.href); invite.search = ''; invite.searchParams.set('room', room);
    if (navigator.share) void navigator.share({ title: 'Pen Fight', text: 'Fight me in Pen Fight!', url: invite.toString() }).catch(() => navigator.clipboard?.writeText(invite.toString()));
    else void navigator.clipboard?.writeText(invite.toString());
  },
  onBack() {
    online.close();
    renderer?.setInputListener(null);
    renderer?.setReplica(false);
    store.transition('home');
    renderer?.focusRoom();
    renderer?.setMatchEnabled(false);
    ambience.stopGameAmbience();
  },
  onChooseMode(mode) {
    storage.update({ lastMode: mode });
    store.startMatch(mode);
    renderer?.focusArena();
    renderer?.setMatchEnabled(true);
    renderer?.setMatchMode(mode, 2);
    ambience.startGameAmbience();
  },
  onRematch() {
    const match = store.snapshot.match;
    const mode = match?.mode ?? 'quick';
    if (mode === 'local' && match?.playerNames && match.playerNames.length > 2) {
      store.startLocalMatch(match.playerNames.slice(1));
    } else {
      store.startMatch(mode, match?.rivalName);
    }
    const playerCount = store.snapshot.match?.playerNames ? store.snapshot.match.playerNames.length : 2;
    renderer?.setMatchEnabled(true);
    renderer?.setMatchMode(mode, playerCount, store.snapshot.match?.playerNames);
    if (mode === 'online') renderer?.setReplica(online.state.seat === 'guest');
    ambience.startGameAmbience();
  },
  onEditName() {
    store.transition('naming');
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

function enterOnlineMatch(state: OnlineState): void {
  if (state.status !== 'ready' || store.snapshot.phase !== 'settingUpLocal') return;
  const rival = state.seat === 'host' ? state.players?.[1] : state.players?.[0];
  store.startOnlineMatch(rival || 'Online friend');
  renderer?.focusArena(); renderer?.setMatchMode('online'); renderer?.setReplica(state.seat === 'guest'); renderer?.setMatchEnabled(true);
  ambience.startGameAmbience();
  renderer?.setInputListener((action, x, y) => {
    if (state.seat === 'guest') {
      if (store.snapshot.match?.currentPlayer === 1) {
        online.send({ type: 'intent', action, ...(x === undefined ? {} : { x }), ...(y === undefined ? {} : { y }) });
        if (action === 'aim' || action === 'cancel') renderer?.remoteInput(action, x, y);
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
  if (store.snapshot.match?.mode === 'online') renderer?.setSuspended(state.status !== 'ready');
});
online.addEventListener('message', (event) => {
  const message = (event as CustomEvent<ServerMessage>).detail;
  if (message.type === 'intent' && online.state.seat === 'host' && store.snapshot.match?.currentPlayer === 1) renderer?.remoteInput(message.action, message.x, message.y);
  if (message.type === 'snapshot') renderer?.applyArenaSnapshot(message.arena);
  if (message.type === 'state' && online.state.seat === 'guest') store.syncOnlineMatch(message.score, message.currentPlayer, message.phase);
});

renderer?.setPointListener((winner) => store.recordPoint(winner));
renderer?.setTurnListener((player) => store.setMatchTurn(player));
renderer?.setAimListener((power) => ui.setAimPower(power));
renderer?.setRoundListener((message) => ui.setRoundMessage(message));
renderer?.setActionListener((action) => ui.setArenaAction(action));
renderer?.setHitListener((intensity) => ui.triggerHit(intensity));
store.subscribe((state) => {
  const rival = state.match?.rivalName ?? (state.match?.mode === 'local' ? 'PLAYER 2' : state.match?.mode === 'quick' ? 'CLASS ACE' : 'AI rival');
  renderer?.setBoardState(state.player.name, rival, state.match?.score ?? [0, 0]);
  renderer?.setSuspended(state.phase === 'paused' || (state.match?.mode === 'online' && online.state.status !== 'ready'));
  if (state.phase === 'result') renderer?.setMatchEnabled(false);
  if (state.match?.mode === 'online' && online.state.seat === 'host') {
    const onlineScore: readonly [number, number] = [state.match.score[0] ?? 0, state.match.score[1] ?? 0];
    const onlinePlayer: 0 | 1 = state.match.currentPlayer === 1 ? 1 : 0;
    online.send({ type: 'state', score: onlineScore, currentPlayer: onlinePlayer, phase: state.phase === 'result' ? 'result' : 'match' });
  }
  const inGameMatch = state.phase === 'match' || state.phase === 'paused' || state.phase === 'result';
  if (inGameMatch && !ambience.shouldPlay) {
    ambience.startGameAmbience();
  } else if (!inGameMatch && ambience.shouldPlay) {
    ambience.stopGameAmbience();
  }
});
let onlineSnapshotSeq = 0;
window.setInterval(() => {
  const state = store.snapshot;
  if (state.phase === 'match' && state.match?.mode === 'online' && online.state.seat === 'host' && renderer) online.send({ type: 'snapshot', arena: renderer.getArenaSnapshot(++onlineSnapshotSeq, state.match.score) });
}, 50);

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
  if (pendingRoom && save.playerName) { const room = pendingRoom; pendingRoom = null; store.transition('settingUpLocal'); online.join(room, save.playerName); }
}

void finishBoot().catch(() => {
  store.hydrate('', defaultSave.settings);
  store.transition('naming');
});
