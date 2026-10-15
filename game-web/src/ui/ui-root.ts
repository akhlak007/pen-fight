import type { AppState } from '../app/app-state';
import type { AppStore } from '../app/app-store';

export interface UiActions {
  onSaveName(name: string): void;
  onPlay(): void;
  onBack(): void;
  onChooseMode(mode: 'quick' | 'practice'): void;
  onEditName(): void;
  onToggleReducedMotion(value: boolean): void;
  onRematch(): void;
}

function escapeText(value: string): string {
  const span = document.createElement('span');
  span.textContent = value;
  return span.innerHTML;
}

export class UiRoot {
  readonly #layer: HTMLElement;
  readonly #unsubscribe: () => void;

  constructor(store: AppStore, private readonly actions: UiActions) {
    this.#layer = document.createElement('div');
    this.#layer.className = 'ui-layer';
    this.#layer.setAttribute('aria-live', 'polite');
    document.querySelector('.game-shell')?.append(this.#layer);
    this.#unsubscribe = store.subscribe((state) => this.render(state));
    this.render(store.snapshot);
  }

  render(state: AppState): void {
    if (state.phase === 'booting') {
      const percent = Math.round((state.loadProgress.loaded / state.loadProgress.total) * 100);
      this.#layer.innerHTML = `<section class="paper splash-card" role="status">
        <p class="eyebrow">PEN FIGHT // PILOT V6</p>
        <h1>Finding your seat.</h1>
        <p>${escapeText(state.loadProgress.label)}</p>
        <div class="scribble-progress"><i style="width:${percent}%"></i></div>
        <small>${percent}% · sharpening pencils</small>
      </section>`;
      return;
    }

    if (state.phase === 'naming') {
      this.#layer.innerHTML = `<section class="paper name-card" role="dialog" aria-modal="true" aria-labelledby="name-title">
        <p class="eyebrow">ROLL CALL</p>
        <h1 id="name-title">What should we write on the board?</h1>
        <p>Your classroom name follows you into every match.</p>
        <form class="name-form">
          <label for="player-name">Your name</label>
          <div class="input-line"><input id="player-name" name="name" maxlength="18" autocomplete="nickname" placeholder="e.g. Rafi" value="${escapeText(state.player.name)}" autofocus><span class="pencil-mark">✎</span></div>
          <p class="form-error" role="alert"></p>
          <button class="paper-button primary" type="submit">Claim my desk <span>→</span></button>
        </form>
      </section>`;
      const form = this.#layer.querySelector<HTMLFormElement>('form');
      const input = this.#layer.querySelector<HTMLInputElement>('input');
      const error = this.#layer.querySelector<HTMLElement>('.form-error');
      form?.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = input?.value.trim() ?? '';
        if (!name) {
          if (error) error.textContent = 'Write a name before the bell rings.';
          input?.focus();
          return;
        }
        this.actions.onSaveName(name);
      });
      queueMicrotask(() => input?.focus());
      return;
    }

    if (state.phase === 'selectingMode') {
      this.#layer.innerHTML = `<div class="top-bar"><button class="glass-button back-button" type="button">← BACK</button></div>
        <section class="paper mode-card" aria-labelledby="mode-title">
          <p class="eyebrow">PICK YOUR BATTLE</p>
          <h1 id="mode-title">School rules?</h1>
          <div class="mode-grid">
            <button class="mode-choice quick" data-mode="quick" type="button"><span class="mode-number">01</span><strong>Quick Match</strong><small>First to knock 3 pens off the desk.</small></button>
            <button class="mode-choice practice" data-mode="practice" type="button"><span class="mode-number">∞</span><strong>Practice</strong><small>Learn your flick. No score, no pressure.</small></button>
          </div>
        </section>`;
      this.#layer.querySelector('.back-button')?.addEventListener('click', this.actions.onBack);
      this.#layer.querySelectorAll<HTMLElement>('[data-mode]').forEach((button) => {
        button.addEventListener('click', () => this.actions.onChooseMode(button.dataset.mode as 'quick' | 'practice'));
      });
      return;
    }

    if (state.phase === 'match' || state.phase === 'paused') {
      const score = state.match?.score ?? [0, 0];
      const practice = state.match?.mode === 'practice';
      this.#layer.innerHTML = `<header class="match-hud">
        <button class="glass-button match-exit" type="button">← CLASSROOM</button>
        <div class="score-paper"><span>${escapeText(state.player.name)}</span><strong>${practice ? 'FREE PLAY' : `${score[0]} : ${score[1]}`}</strong><span>${practice ? 'PRACTICE' : 'CLASS RIVAL'}</span></div>
        <div class="turn-chip"><i></i> ${practice ? 'YOUR FLICK' : state.match?.lastScorer === 1 ? 'RIVAL SCORED' : state.match?.lastScorer === 0 ? 'POINT!' : 'YOUR FLICK'}</div>
      </header>
      <section class="flick-guide" aria-label="Flick controls">
        <span class="flick-hand">☝</span><strong>DRAG TO AIM</strong><small>Pull back · release to flick</small>
      </section>`;
      this.#layer.querySelector('.match-exit')?.addEventListener('click', this.actions.onBack);
      return;
    }

    if (state.phase === 'result') {
      const won = (state.match?.score[0] ?? 0) > (state.match?.score[1] ?? 0);
      this.#layer.innerHTML = `<section class="paper result-card" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <p class="eyebrow">FINAL BELL</p>
        <h1 id="result-title">${won ? 'Desk champion!' : 'Rematch?'}</h1>
        <p>${escapeText(state.player.name)} <strong>${state.match?.score[0] ?? 0} : ${state.match?.score[1] ?? 0}</strong> Class rival</p>
        <div class="result-actions"><button class="paper-button primary rematch" type="button">Flick again →</button><button class="text-button result-exit" type="button">Back to classroom</button></div>
      </section>`;
      this.#layer.querySelector('.rematch')?.addEventListener('click', this.actions.onRematch);
      this.#layer.querySelector('.result-exit')?.addEventListener('click', this.actions.onBack);
      return;
    }

    this.#layer.innerHTML = `<header class="reference-nav">
      <nav aria-label="Game menu">
        <button class="glass-button nav-secondary" type="button">FRIEND</button>
        <button class="glass-button instant-button" data-action="play" type="button">INSTANT</button>
        <button class="glass-button nav-secondary" type="button">COMMUNITY</button>
        <button class="profile-button" data-action="edit" type="button">${escapeText(state.player.name || 'SIGN IN')}</button>
        <button class="glass-button icon-button" data-action="settings" type="button" aria-label="Settings">☰</button>
      </nav>
    </header>
    <aside class="settings-popover paper" hidden>
      <strong>Desk settings</strong>
      <label><span>Calm camera</span><input data-setting="motion" type="checkbox" ${state.settings.reducedMotion ? 'checked' : ''}></label>
      <button class="text-button" data-action="rename" type="button">Change player name</button>
    </aside>
    <footer class="reference-brand"><span class="brand-icon">PF</span><span><strong>PEN FIGHT</strong><small>PILOT V6</small></span></footer>`;
    this.#layer.querySelector('[data-action="play"]')?.addEventListener('click', this.actions.onPlay);
    this.#layer.querySelector('[data-action="edit"]')?.addEventListener('click', this.actions.onEditName);
    this.#layer.querySelector('[data-action="rename"]')?.addEventListener('click', this.actions.onEditName);
    const settings = this.#layer.querySelector<HTMLElement>('.settings-popover');
    this.#layer.querySelector('[data-action="settings"]')?.addEventListener('click', () => { if (settings) settings.hidden = !settings.hidden; });
    this.#layer.querySelector<HTMLInputElement>('[data-setting="motion"]')?.addEventListener('change', (event) => {
      this.actions.onToggleReducedMotion((event.currentTarget as HTMLInputElement).checked);
    });
  }

  dispose(): void { this.#unsubscribe(); this.#layer.remove(); }
}
