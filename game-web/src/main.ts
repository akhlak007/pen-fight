import './styles/global.css';
import { AppStore } from './app/app-store';
import { attachLifecycle } from './app/lifecycle';
import { GameRenderer } from './rendering/game-renderer';
import { defaultSave } from './storage/schema';
import { StorageService } from './storage/storage-service';
import { UiRoot } from './ui/ui-root';

function createApplicationShell(): { root: HTMLElement; canvas: HTMLCanvasElement } {
  const root = document.createElement('main');
  root.className = 'game-shell';
  root.setAttribute('aria-label', 'Pen Fight game');
  const canvas = document.createElement('canvas');
  canvas.className = 'game-canvas';
  canvas.setAttribute('aria-label', '3D classroom');
  root.append(canvas);
  return { root, canvas };
}

const mount = document.querySelector<HTMLElement>('#app');
if (!mount) throw new Error('Pen Fight could not find its application mount.');

const { root, canvas } = createApplicationShell();
mount.replaceChildren(root);
const store = new AppStore();
const storage = new StorageService(localStorage);
const save = storage.load();
store.hydrate(save.playerName, save.settings);

let renderer: GameRenderer | null = null;
try {
  renderer = new GameRenderer(canvas);
  renderer.setReducedMotion(save.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches);
  renderer.start();
} catch (error) {
  console.error('WebGL startup failed', error);
  canvas.classList.add('webgl-fallback');
}

new UiRoot(store, {
  onSaveName(name) {
    store.setPlayerName(name);
    const current = storage.update({ playerName: store.snapshot.player.name });
    renderer?.setPlayerName(current.playerName);
    store.transition('home');
  },
  onPlay() {
    store.transition('selectingMode');
    renderer?.focusArena();
    renderer?.setMatchEnabled(false);
  },
  onBack() {
    store.transition('home');
    renderer?.focusRoom();
    renderer?.setMatchEnabled(false);
  },
  onChooseMode(mode) {
    storage.update({ lastMode: mode });
    store.transition('match');
    renderer?.focusArena();
    renderer?.setMatchEnabled(true);
  },
  onEditName() {
    store.transition('naming');
  },
  onToggleReducedMotion(value) {
    store.updateSettings({ reducedMotion: value });
    storage.update({ settings: store.snapshot.settings });
    renderer?.setReducedMotion(value);
  },
});

attachLifecycle(store);
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
}

void finishBoot().catch(() => {
  store.hydrate('', defaultSave.settings);
  store.transition('naming');
});
