import type { AppState } from '../app/app-state';
import type { AppStore } from '../app/app-store';
import type { ArenaAction } from '../game/solo-turn-controller';
import type { OnlineState } from '../network/online-session';

export interface UiActions {
  onSaveName(name: string): void;
  onPlay(): void;
  onPlayFriend(): void;
  onStartLocal(rivalName: string): void;
  onCreateOnline(): void;
  onJoinOnline(room: string): void;
  onCopyInvite(): void;
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

function escapeAttr(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;');
}

function scorePips(score: number): string {
  return Array.from(
    { length: 3 },
    (_, index) => `<i class="${index < score ? 'won' : ''}"></i>`,
  ).join('');
}

function arenaStatus(action: ArenaAction, readyTitle: string, readyHint: string): readonly [string, string] {
  switch (action) {
    case 'aiming': return ['AIMING', 'Pull back for power · release to flick'];
    case 'playerMoving': return ['SHOT IN MOTION', 'Pens are moving · next turn soon'];
    case 'aiWaiting': return ['RIVAL IS LINING UP', 'Stay sharp'];
    case 'aiMoving': return ['RIVAL SHOT IN MOTION', 'Watch the table edge'];
    case 'roundReset': return ['ROUND RESETTING', 'Pens return after the point'];
    default: return [readyTitle, readyHint];
  }
}

export class UiRoot {
  readonly #layer: HTMLElement;
  readonly #unsubscribe: () => void;
  #aimPower = 0;
  #roundMessage: string | null = null;
  #arenaAction: ArenaAction = 'ready';
  #nameDraft: string | null = null;
  #online: OnlineState = { status: 'idle' };
  #state!: AppState;

  constructor(store: AppStore, private readonly actions: UiActions) {
    this.#layer = document.createElement('div');
    this.#layer.className = 'ui-layer';
    document.querySelector('.game-shell')?.append(this.#layer);
    this.#unsubscribe = store.subscribe((state) => { this.#state = state; this.render(state); });
    this.#state = store.snapshot;
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

    if (state.phase === 'naming' || state.phase === 'home') {
      const hasName = Boolean(state.player.name);
      const displayName = hasName ? state.player.name.toUpperCase() : 'NEW PLAYER';
      const inputValue = this.#nameDraft ?? state.player.name;
      this.#layer.innerHTML = `<section class="notebook-home ${hasName ? 'has-player' : 'needs-player'}" role="region" aria-labelledby="home-title">
        <div class="notebook-spread">
          <div class="notebook-page notebook-left">
            <header class="notebook-brand">
              <span class="pen-logo" aria-hidden="true"><i></i><b></b></span>
              <strong>PEN FIGHT</strong><small>DESK LEAGUE</small>
            </header>
            <section class="player-intro">
              <p class="notebook-kicker">WELCOME TO PEN FIGHT</p>
              <h1 id="home-title">Welcome to Pen Fight</h1>
              <strong class="player-display">${escapeText(displayName)}</strong>
              <form class="home-name-form">
                <label for="player-name">Your name</label>
                <div class="notebook-name-line">
                  <input id="player-name" name="name" maxlength="18" autocomplete="nickname" placeholder="Write your name" value="${escapeText(inputValue)}" ${hasName ? '' : 'autofocus'}>
                  <button type="submit">${hasName ? 'UPDATE' : 'Claim my desk'} <span aria-hidden="true">→</span></button>
                </div>
                <p class="form-error" role="alert"></p>
              </form>
              <div class="journey-progress" aria-label="Class journey: 2 of 12 pens">
                <span><b>2</b> of 12 pens</span><i class="won"></i>${Array.from({ length: 9 }, () => '<i></i>').join('')}<i class="trophy">♛</i>
              </div>
            </section>

            <div class="ruled-heading"><span>YOUR NEXT FIGHT</span></div>
            <article class="next-fight-card">
              <div class="classroom-stamp" aria-hidden="true"><span>ROOM</span><strong>9A</strong><small>OPEN</small></div>
              <div class="fight-copy"><small>UP NEXT · CLASS 9A</small><h2>${hasName ? 'DEFEND YOUR DESK' : 'ENTER THE CLASSROOM'}</h2><p>${hasName ? 'The class ace is waiting. First to knock three pens off wins.' : 'Add your name above, then take your place at the desk.'}</p></div>
              <button class="continue-fight" data-action="play" type="button" ${hasName ? '' : 'disabled'}>START THE MATCH <span aria-hidden="true">→</span></button>
            </article>

            <div class="class-route" aria-label="Your class route">
              <div class="route-row current"><b>9B</b><span><strong>OTHER CLASSES</strong><small>Two pens. One desk. No excuses.</small></span><em>UP NEXT</em></div>
              <div class="route-row locked"><b>9C</b><span><strong>THE BIG TABLE</strong><small>Pencils only. Four rivals.</small></span><em>LOCKED</em></div>
              <div class="route-row locked"><b>CHEM</b><span><strong>CHEMISTRY LAB</strong><small>A practical at the wet bench.</small></span><em>LOCKED</em></div>
              <div class="route-row locked"><b>PHYS</b><span><strong>PHYSICS LAB</strong><small>One desk. Three ways it moves.</small></span><em>LOCKED</em></div>
            </div>
          </div>

          <div class="notebook-page notebook-right">
            <button class="notebook-settings" data-action="settings" type="button" aria-label="Settings" aria-expanded="false" aria-controls="desk-settings">⚙</button>
            <div class="ruled-heading play-heading"><span>PLAY ANOTHER WAY</span></div>
            <nav class="play-list" aria-label="Play another way">
              <button class="friend-choice" data-action="friend" type="button" ${hasName ? '' : 'disabled'}><span class="menu-icon">↗</span><span><strong>FRIEND</strong><small>Two players · same device</small></span><em>PLAY →</em></button>
              <button type="button" disabled><span class="menu-icon">♜</span><span><strong>TOURNAMENT</strong><small>Climb the weekly classroom bracket</small></span><em>SOON</em></button>
              <button class="instant-choice" data-action="play" type="button" ${hasName ? '' : 'disabled'}><span class="menu-icon">◎</span><span><strong>INSTANT</strong><small>Quick solo match against the class ace</small></span><em>PLAY →</em></button>
            </nav>

            <div class="ruled-heading rivals-heading"><span>YOUR RIVALS</span></div>
            <div class="rivals-empty"><span>✦</span><p>Win your first match and your rivals will settle here.</p></div>

            <div class="notebook-ranking"><span>▥</span><strong>CLASS RANKING</strong><small>#12 · ROOKIE DESK</small></div>
            <footer class="notebook-footer"><span>PILOT V6</span><span>Made at the last bench</span></footer>
          </div>
        </div>
        <aside class="settings-popover paper" id="desk-settings" hidden>
          <strong>Desk settings</strong>
          <label><span>Calm camera</span><input data-setting="motion" type="checkbox" ${state.settings.reducedMotion ? 'checked' : ''}></label>
        </aside>
      </section>`;
      const form = this.#layer.querySelector<HTMLFormElement>('.home-name-form');
      const input = this.#layer.querySelector<HTMLInputElement>('#player-name');
      const error = this.#layer.querySelector<HTMLElement>('.form-error');
      input?.addEventListener('input', () => { this.#nameDraft = input.value; });
      form?.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = input?.value.trim() ?? '';
        if (!name) {
          if (error) error.textContent = 'Write a name before the bell rings.';
          input?.focus();
          return;
        }
        this.#nameDraft = null;
        this.actions.onSaveName(name);
      });
      this.#layer.querySelectorAll<HTMLElement>('[data-action="play"]').forEach((button) => {
        button.addEventListener('click', this.actions.onPlay);
      });
      this.#layer.querySelector('[data-action="friend"]')?.addEventListener('click', this.actions.onPlayFriend);
      const settings = this.#layer.querySelector<HTMLElement>('.settings-popover');
      const settingsButton = this.#layer.querySelector<HTMLButtonElement>('[data-action="settings"]');
      const closeSettings = () => {
        if (!settings || !settingsButton) return;
        settings.hidden = true;
        settingsButton.setAttribute('aria-expanded', 'false');
      };
      settingsButton?.addEventListener('click', () => {
        if (!settings) return;
        settings.hidden = !settings.hidden;
        settingsButton.setAttribute('aria-expanded', `${!settings.hidden}`);
      });
      this.#layer.querySelector<HTMLElement>('.notebook-home')?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && settings && !settings.hidden) {
          closeSettings();
          settingsButton?.focus();
        }
      });
      this.#layer.querySelector<HTMLInputElement>('[data-setting="motion"]')?.addEventListener('change', (event) => {
        this.actions.onToggleReducedMotion((event.currentTarget as HTMLInputElement).checked);
      });
      if (!hasName) queueMicrotask(() => input?.focus());
      return;
    }

    if (state.phase === 'settingUpLocal') {
      const onlineBusy = this.#online.status !== 'idle';
      const room = this.#online.room ?? '';
      this.#layer.innerHTML = `<div class="local-setup-screen">
        <div class="top-bar"><button class="glass-button back-button" type="button">← BACK</button></div>
        <section class="paper local-setup-card" aria-labelledby="local-setup-title">
          <p class="eyebrow">FRIEND MATCH · TWO PLAYERS</p>
          <h1 id="local-setup-title">Choose your rival</h1>
          <p class="local-player-one"><span>PLAYER 1 · BLUE PEN</span><strong>${escapeText(state.player.name)}</strong></p>
          ${onlineBusy ? `<section class="online-room" aria-live="polite"><span>${this.#online.status === 'ready' ? 'FRIEND CONNECTED' : this.#online.status === 'error' ? 'CONNECTION PROBLEM' : 'ONLINE INVITE'}</span>${room ? `<strong class="room-code">${escapeText(room)}</strong><p>Send this link to your friend. They only need to open it.</p><button class="paper-button copy-invite" type="button">Copy invite link</button>` : '<p>Opening a classroom online…</p>'}${this.#online.error ? `<p class="form-error">${escapeText(this.#online.error)}</p>` : ''}</section>` : `<div class="friend-mode-grid"><button class="friend-mode active" data-friend-mode="local" type="button"><strong>Same device</strong><small>Take turns at this desk</small></button><button class="friend-mode" data-friend-mode="online" type="button"><strong>Online invite</strong><small>Each friend uses a device</small></button></div>
          <form class="local-setup-form">
            <label for="rival-name">Player 2 name</label>
            <div class="input-line"><input id="rival-name" name="rivalName" maxlength="18" autocomplete="off" placeholder="Who is taking the red pen?" autofocus><span class="pencil-mark">✎</span></div>
            <p class="form-error" role="alert"></p>
            <button class="paper-button primary" type="submit">Start local match <span>→</span></button>
          </form><section class="online-choice" hidden><p>Create a private room and share one link—no account required.</p><button class="paper-button primary create-online" type="button">Create invite link <span>→</span></button><form class="join-room-form"><label for="room-code">Or enter a room code</label><div class="input-line"><input id="room-code" maxlength="6" placeholder="ABC234"><button type="submit">JOIN</button></div></form></section>`}
        </section>
      </div>`;
      const form = this.#layer.querySelector<HTMLFormElement>('.local-setup-form');
      const input = this.#layer.querySelector<HTMLInputElement>('#rival-name');
      const error = this.#layer.querySelector<HTMLElement>('.form-error');
      const goBack = () => this.actions.onBack();
      this.#layer.querySelector('.back-button')?.addEventListener('click', goBack);
      this.#layer.querySelector('.copy-invite')?.addEventListener('click', this.actions.onCopyInvite);
      this.#layer.querySelector('.create-online')?.addEventListener('click', this.actions.onCreateOnline);
      this.#layer.querySelector<HTMLFormElement>('.join-room-form')?.addEventListener('submit', (event) => { event.preventDefault(); const value = this.#layer.querySelector<HTMLInputElement>('#room-code')?.value.trim() ?? ''; if (value) this.actions.onJoinOnline(value); });
      this.#layer.querySelectorAll<HTMLElement>('[data-friend-mode]').forEach((button) => button.addEventListener('click', () => {
        const online = button.dataset.friendMode === 'online';
        this.#layer.querySelector('.local-setup-form')?.toggleAttribute('hidden', online);
        this.#layer.querySelector('.online-choice')?.toggleAttribute('hidden', !online);
        this.#layer.querySelectorAll('.friend-mode').forEach((item) => item.classList.toggle('active', item === button));
      }));
      form?.addEventListener('submit', (event) => {
        event.preventDefault();
        const rivalName = input?.value.trim() ?? '';
        if (!rivalName) {
          if (error) error.textContent = 'Write Player 2’s name before starting.';
          input?.focus();
          return;
        }
        this.actions.onStartLocal(rivalName);
      });
      this.#layer.querySelector<HTMLElement>('.local-setup-screen')?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') goBack();
      });
      if (!onlineBusy) queueMicrotask(() => input?.focus());
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
      const practice = state.match?.mode === 'practice';
      const local = state.match?.mode === 'local';
      const online = state.match?.mode === 'online';
      const activePlayer = state.match?.currentPlayer ?? 0;
      const aiTurn = state.match?.mode === 'quick' && activePlayer === 1;
      const rivalName = local || online ? state.match?.rivalName ?? 'PLAYER 2' : 'CLASS ACE';
      const activeName = activePlayer === 0 ? state.player.name : rivalName;
      const paused = state.phase === 'paused';
      const roundLocked = Boolean(this.#roundMessage);
      const defaultTurnTitle = aiTurn ? 'RIVAL IS AIMING' : practice ? 'PRACTICE SHOT' : local || online ? `${activeName.toUpperCase()}’S TURN` : 'YOUR TURN';
      const defaultTurnHint = aiTurn ? 'Watch the table edge' : `Grab the ${activePlayer === 0 ? 'blue' : 'red'} pen · pull back · release`;
      const [actionTitle, actionHint] = arenaStatus(this.#arenaAction, defaultTurnTitle, defaultTurnHint);
      const turnTitle = paused ? 'MATCH PAUSED' : roundLocked ? 'ROUND RESETTING' : actionTitle;
      const turnHint = paused ? 'Return to the game to continue' : roundLocked ? this.#roundMessage! : actionHint;
      const playerScore = state.match?.score[0] ?? 0;
      const rivalScore = state.match?.score[1] ?? 0;
      this.#layer.innerHTML = `<header class="match-hud">
        <button class="glass-button match-exit" type="button" aria-label="Leave match"><span>←</span> EXIT</button>
        <span class="match-mode">${practice ? 'FREE PLAY' : online ? `ONLINE · ${escapeText(this.#online.room ?? '')}` : local ? 'LOCAL FRIEND' : 'QUICK MATCH'}</span>
      </header>
      <div class="match-footer">
        <section class="round-banner paper" role="status" ${this.#roundMessage ? '' : 'hidden'}>${escapeText(this.#roundMessage ?? '')}</section>
        <section class="power-dock" role="meter" aria-label="Flick power" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(this.#aimPower * 100)}">
          <span>FLICK POWER</span><div class="power-track"><i></i></div><b>${Math.round(this.#aimPower * 100)}%</b>
        </section>
        <section class="scoreboard" aria-label="Match score">
          <div class="competitor player ${activePlayer === 0 ? 'active' : ''}">
            <span class="pen-swatch blue"></span><span class="competitor-copy"><small>${local || online ? 'PLAYER 1' : 'YOU'}</small><strong>${escapeText(state.player.name)}</strong></span>
            <span class="score-pips" aria-hidden="true">${scorePips(playerScore)}</span><b>${playerScore}</b>
          </div>
          <section class="turn-dock ${activePlayer === 1 ? 'rival-turn' : ''} ${roundLocked ? 'round-locked' : ''}" aria-label="Turn status" aria-live="polite" data-player="${activePlayer}" data-action="${this.#arenaAction}" data-ready-title="${escapeAttr(defaultTurnTitle)}" data-ready-hint="${escapeAttr(defaultTurnHint)}" data-locked="${paused || roundLocked}">
            <span class="turn-indicator"></span><div><strong>${escapeText(turnTitle)}</strong><small>${escapeText(turnHint)}</small></div>
          </section>
          <div class="competitor rival ${activePlayer === 1 ? 'active' : ''}">
            <b>${rivalScore}</b><span class="score-pips" aria-hidden="true">${scorePips(rivalScore)}</span>
            <span class="competitor-copy"><small>${local || online ? 'PLAYER 2' : 'RIVAL'}</small><strong>${escapeText(rivalName)}</strong></span><span class="pen-swatch red"></span>
          </div>
        </section>
      </div>`;
      this.#layer.querySelector('.match-exit')?.addEventListener('click', this.actions.onBack);
      this.setAimPower(this.#aimPower);
      return;
    }

    if (state.phase === 'result') {
      const won = (state.match?.score[0] ?? 0) > (state.match?.score[1] ?? 0);
      const rivalName = state.match?.mode === 'local' || state.match?.mode === 'online' ? state.match.rivalName ?? 'Player 2' : 'Class rival';
      this.#layer.innerHTML = `<section class="paper result-card" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <p class="eyebrow">FINAL BELL</p>
        <h1 id="result-title">${won ? 'Desk champion!' : 'Rematch?'}</h1>
        <p>${escapeText(state.player.name)} <strong>${state.match?.score[0] ?? 0} : ${state.match?.score[1] ?? 0}</strong> ${escapeText(rivalName)}</p>
        <div class="result-actions"><button class="paper-button primary rematch" type="button">Flick again →</button><button class="text-button result-exit" type="button">Back to classroom</button></div>
      </section>`;
      this.#layer.querySelector('.rematch')?.addEventListener('click', this.actions.onRematch);
      this.#layer.querySelector('.result-exit')?.addEventListener('click', this.actions.onBack);
      return;
    }

    this.#layer.innerHTML = `<section class="paper result-card" role="alert"><p class="eyebrow">CLASSROOM ERROR</p><h1>That page is missing.</h1></section>`;
  }

  setAimPower(power: number): void {
    this.#aimPower = Math.max(0, Math.min(1, power));
    const meter = this.#layer.querySelector<HTMLElement>('.power-dock');
    if (!meter) return;
    meter.style.setProperty('--power', `${this.#aimPower * 100}%`);
    meter.setAttribute('aria-valuenow', `${Math.round(this.#aimPower * 100)}`);
    const label = meter.querySelector<HTMLElement>('b');
    if (label) label.textContent = `${Math.round(this.#aimPower * 100)}%`;
  }

  setOnlineState(state: OnlineState): void {
    this.#online = state;
    if (this.#state.phase === 'settingUpLocal' || this.#state.match?.mode === 'online') this.render(this.#state);
  }

  setRoundMessage(message: string | null): void {
    this.#roundMessage = message;
    const banner = this.#layer.querySelector<HTMLElement>('.round-banner');
    if (!banner) return;
    banner.hidden = !message;
    banner.textContent = message ?? '';
    const dock = this.#layer.querySelector<HTMLElement>('.turn-dock');
    if (!dock) return;
    dock.classList.toggle('round-locked', Boolean(message));
    dock.dataset.locked = `${Boolean(message)}`;
    const title = dock.querySelector<HTMLElement>('strong');
    const hint = dock.querySelector<HTMLElement>('small');
    const [actionTitle, actionHint] = arenaStatus(
      this.#arenaAction,
      dock.dataset.readyTitle ?? 'YOUR TURN',
      dock.dataset.readyHint ?? 'Pull back and release',
    );
    if (title) title.textContent = message ? 'ROUND RESETTING' : actionTitle;
    if (hint) hint.textContent = message ?? actionHint;
  }

  setArenaAction(action: ArenaAction): void {
    this.#arenaAction = action;
    const dock = this.#layer.querySelector<HTMLElement>('.turn-dock');
    if (!dock || dock.dataset.locked === 'true') return;
    const [titleText, hintText] = arenaStatus(
      action,
      dock.dataset.readyTitle ?? 'YOUR TURN',
      dock.dataset.readyHint ?? 'Pull back and release',
    );
    const title = dock.querySelector<HTMLElement>('strong');
    const hint = dock.querySelector<HTMLElement>('small');
    if (title) title.textContent = titleText;
    if (hint) hint.textContent = hintText;
    dock.dataset.action = action;
    dock.classList.toggle(
      'rival-turn',
      dock.dataset.player === '1' || action === 'aiWaiting' || action === 'aiMoving',
    );
  }

  dispose(): void { this.#unsubscribe(); this.#layer.remove(); }
}
