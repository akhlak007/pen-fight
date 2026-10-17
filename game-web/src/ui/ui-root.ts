import type { AppState } from '../app/app-state';
import type { AppStore } from '../app/app-store';
import type { ArenaAction } from '../game/solo-turn-controller';
import type { OnlineState } from '../network/online-session';

export interface UiActions {
  onSaveName(name: string): void;
  onPlay(): void;
  onPlayFriend(): void;
  onStartLocal(rivalName: string | readonly string[]): void;
  onCreateOnline(): void;
  onJoinOnline(room: string): void;
  onCopyInvite(): void;
  onBack(): void;
  onChooseMode(mode: 'quick' | 'practice'): void;
  onEditName(): void;
  onToggleReducedMotion(value: boolean): void;
  onToggleAmbience(value: boolean): void;
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
      this.#layer.innerHTML = `
        <!-- Classroom Desk Header Bar -->
        <header class="desk-top-bar" aria-label="Classroom navigation">
          <div class="pilot-badge-corner" aria-label="Pen Fight Pilot V5">
            <span class="pilot-box"><span class="pilot-pen-icon" aria-hidden="true"></span>PEN FIGHT</span>
            <span class="pilot-version">Pilot V5</span>
          </div>
          <div class="top-nav-actions">
            <button type="button" class="nav-text-btn" data-action="community">Community</button>
            <button type="button" class="nav-pill-btn" data-action="signin">SIGN IN</button>
            <button type="button" class="nav-menu-btn" data-action="menu" aria-label="Menu">
              <i></i><i></i><i></i>
            </button>
          </div>
        </header>

        <section class="notebook-home ${hasName ? 'has-player' : 'needs-player'}" role="region" aria-labelledby="home-title">
          <div class="notebook-spread">
            <!-- Left Notebook Page -->
            <div class="notebook-page notebook-left">
              <header class="notebook-brand">
                <span class="pen-logo" aria-hidden="true"><i></i><b></b></span>
                <strong>PEN FIGHT</strong>
              </header>

              <section class="player-intro">
                <h1 id="home-title" class="home-main-title ${hasName ? 'sr-only' : ''}">Welcome to Pen Fight</h1>
                <div class="player-title-row">
                  <strong class="player-display">${escapeText(displayName)}</strong>
                  ${hasName ? '<button type="button" class="edit-name-pen" aria-label="Edit name" title="Change name">✎</button>' : ''}
                </div>
                <div class="player-journey-subline">
                  <span>2 of 12 pens · </span><span class="trimax-red">10 to the Trimax</span>
                </div>

                <form class="home-name-form ${hasName ? 'name-saved' : 'name-active'}">
                  <label for="player-name">Your name</label>
                  <div class="notebook-name-line">
                    <input id="player-name" name="name" maxlength="18" autocomplete="nickname" placeholder="Write your name" value="${escapeText(inputValue)}" ${hasName ? '' : 'autofocus'}>
                    <button type="submit">${hasName ? 'UPDATE' : 'Claim my desk'} <span aria-hidden="true">→</span></button>
                  </div>
                  <p class="form-error" role="alert"></p>
                </form>

                <div class="journey-progress-track" aria-label="Class journey: 2 of 12 pens">
                  <div class="track-nodes">
                    <i class="node filled"></i>
                    <i class="node red-ring"></i>
                    <i class="node"></i>
                    <i class="node"></i>
                    <i class="node"></i>
                    <i class="node"></i>
                    <i class="node"></i>
                    <i class="node"></i>
                    <i class="node"></i>
                    <i class="node"></i>
                    <i class="node"></i>
                    <i class="trophy-node" aria-hidden="true">🏆</i>
                  </div>
                </div>
              </section>

              <div class="ruled-heading"><span>YOUR NEXT FIGHT</span></div>

              <article class="next-fight-card">
                <div class="polaroid-photo">
                  <div class="tape-strip" aria-hidden="true"></div>
                  <div class="photo-frame">
                    <img src="/door_9a.jpg" alt="Classroom 9A door" class="door-img" />
                    <span class="door-room-tag">9A</span>
                  </div>
                </div>
                <div class="fight-copy">
                  <div class="you-are-here-tag">YOU ARE HERE</div>
                  <span class="room-title-code">9A</span>
                  <h2>${hasName ? 'CLASSROOM PEN FIGHT ARENA' : 'START YOUR CLASSROOM MATCH'}</h2>
                  <p>${hasName ? 'Take your place at desk 9A and flick to win.' : 'Take your place at desk 9A and flick first.'}</p>
                  <div class="line-score-stamp">${hasName ? 'DESK NO. 04 · BEST OF 3' : 'DESK NO. 04 · BEST OF 3'}</div>
                  <button class="continue-fight" data-action="play" type="button" ${hasName ? '' : 'disabled'}>
                    ${hasName ? 'ENTER THE ARENA' : 'START THE MATCH'}
                  </button>
                </div>
              </article>

              <div class="route-tracker">
                <div class="route-lead">
                  <span class="red-pin"></span>
                  <small>AFTER 9A: YOUR SOLO JOURNEY CONTINUES</small>
                </div>
                <div class="class-route" aria-label="Your class route">
                  <div class="route-row current up-next-stage">
                    <b class="route-code">9B</b>
                    <div class="route-details">
                      <div class="route-headline">
                        <span class="badge-up-next">UP NEXT</span>
                        <strong>OTHER CLASSES</strong>
                        <span class="route-desc">Their room. Two captains! one.</span>
                      </div>
                      <div class="route-sub-goal">FINISH 9A AND WIN THE TRIMAX</div>
                    </div>
                    <span class="route-lock" aria-label="Locked">🔒</span>
                  </div>

                  <div class="route-row locked">
                    <b class="route-code">9C</b>
                    <div class="route-details">
                      <div class="route-headline">
                        <span class="badge-then">THEN</span>
                        <strong>THE BIG TABLE</strong>
                        <span class="route-desc">Pencils only. Four rivals.</span>
                      </div>
                    </div>
                    <span class="route-lock" aria-label="Locked">🔒</span>
                  </div>

                  <div class="route-row locked">
                    <b class="route-code">CHEM</b>
                    <div class="route-details">
                      <div class="route-headline">
                        <span class="badge-later">LATER</span>
                        <strong>CHEMISTRY LAB</strong>
                        <span class="route-desc">A practical at the wet bench.</span>
                      </div>
                    </div>
                    <span class="route-lock" aria-label="Locked">🔒</span>
                  </div>

                  <div class="route-row locked">
                    <b class="route-code">PHYS</b>
                    <div class="route-details">
                      <div class="route-headline">
                        <span class="badge-later">LATER</span>
                        <strong>PHYSICS LAB</strong>
                        <span class="route-desc">One desk. Three ways it moves.</span>
                      </div>
                    </div>
                    <span class="route-lock" aria-label="Locked">🔒</span>
                  </div>

                  <div class="route-row locked">
                    <b class="route-code">STAFF</b>
                    <div class="route-details">
                      <div class="route-headline">
                        <span class="badge-later">LATER</span>
                        <strong>THE STAFF ROOM</strong>
                        <span class="route-desc">Teachers only. The door stays shut.</span>
                      </div>
                    </div>
                    <span class="route-lock" aria-label="Locked">🔒</span>
                  </div>

                  <div class="route-row route-more">
                    <b class="route-code dots">···</b>
                    <div class="route-details">
                      <div class="route-headline">
                        <strong>THE ROUTE CONTINUES</strong>
                        <span class="route-desc">8 more stages appear as you move forward</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Notebook Page -->
            <div class="notebook-page notebook-right">
              <button class="notebook-sound-toggle ${state.settings.ambience ? '' : 'muted'}" data-action="toggle-audio" type="button" aria-label="${state.settings.ambience ? 'Mute sound' : 'Unmute sound'}" title="${state.settings.ambience ? 'Mute sound' : 'Unmute sound'}">${state.settings.ambience ? '🔊' : '🔇'}</button>
              <button class="notebook-settings" data-action="settings" type="button" aria-label="Settings" aria-expanded="false" aria-controls="desk-settings">⚙</button>
              <div class="desk-pen-prop" aria-hidden="true">
                <img src="/blue_pen.jpg" alt="" class="pen-img-prop" />
              </div>

              <div class="ruled-heading play-heading"><span>PLAY ANOTHER WAY</span></div>

              <nav class="play-list" aria-label="Play another way">
                <button class="mode-item friend-choice" data-action="friend" type="button" ${hasName ? '' : 'disabled'}>
                  <span class="mode-icon chain-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                  </span>
                  <span class="mode-content">
                    <strong>FRIEND</strong>
                    <small>2-3 players · invite with a Link</small>
                  </span>
                  <span class="mode-chevron" aria-hidden="true">›</span>
                </button>

                <button class="mode-item tournament-choice" data-action="tournament" type="button">
                  <span class="mode-icon trophy-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.45 1-1 1H7v2h10v-2h-2c-.55 0-1-.45-1-1v-2.34"></path><path d="M18 4H6v7a6 6 0 0 0 12 0V4z"></path></svg>
                  </span>
                  <span class="mode-content">
                    <span class="mode-title-row">
                      <strong>TOURNAMENT</strong>
                      <span class="badge-highlighter">NEW</span>
                    </span>
                    <small>next one today (sat) · Sattu holds the belt</small>
                  </span>
                  <span class="mode-chevron" aria-hidden="true">›</span>
                </button>

                <button class="mode-item local-choice" data-action="local" type="button" ${hasName ? '' : 'disabled'}>
                  <span class="mode-icon people-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                  </span>
                  <span class="mode-content">
                    <span class="mode-title-row">
                      <strong>LOCAL</strong>
                      <span class="badge-highlighter">SIMPLE</span>
                    </span>
                    <small>6 players · score 0-0-0-0-0-0</small>
                  </span>
                  <span class="mode-chevron" aria-hidden="true">›</span>
                </button>

                <button class="mode-item instant-choice" data-action="instant" type="button" ${hasName ? '' : 'disabled'}>
                  <span class="mode-icon globe-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                  </span>
                  <span class="mode-content">
                    <strong>INSTANT</strong>
                    <small>2-3 players · find someone online</small>
                  </span>
                  <span class="mode-chevron" aria-hidden="true">›</span>
                </button>
              </nav>

              <div class="ruled-heading rivals-heading"><span>YOUR RIVALS</span></div>
              <div class="rivals-settle-box">
                <p>Play a friend and the score settles here.</p>
              </div>

              <div class="ranking-row" data-action="ranking" role="button" tabindex="0">
                <span class="ranking-icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                </span>
                <strong class="ranking-label">CLASS RANKING</strong>
                <span class="mode-chevron" aria-hidden="true">›</span>
              </div>

              <footer class="notebook-footer-notes">
                <p class="bench-credit">made on the last bench by @rinks___g and @littleplaycode</p>
                <nav class="footer-links" aria-label="Game links">
                  <a href="#how-to-play" class="notebook-link" data-action="info-how">How To Play Pen Fight</a> ·
                  <a href="#what-is-pen-fight" class="notebook-link" data-action="info-what">What is Pen Fight?</a> ·
                  <a href="#notice-board" class="notebook-link" data-action="info-notice">Notice Board</a>
                </nav>
              </footer>
            </div>
          </div>

          <aside class="settings-popover paper" id="desk-settings" hidden>
            <strong>Desk settings</strong>
            <label><span>Classroom ambience</span><input data-setting="ambience" type="checkbox" ${state.settings.ambience ? 'checked' : ''}></label>
            <label><span>Calm camera</span><input data-setting="motion" type="checkbox" ${state.settings.reducedMotion ? 'checked' : ''}></label>
          </aside>

          <aside class="notice-toast paper" id="desk-notice" hidden aria-live="polite">
            <span class="notice-pin">📌</span>
            <p class="notice-msg"></p>
            <button type="button" class="notice-close">Got it</button>
          </aside>
        </section>`;

      const form = this.#layer.querySelector<HTMLFormElement>('.home-name-form');
      const input = this.#layer.querySelector<HTMLInputElement>('#player-name');
      const error = this.#layer.querySelector<HTMLElement>('.form-error');
      const editPen = this.#layer.querySelector<HTMLButtonElement>('.edit-name-pen');

      editPen?.addEventListener('click', () => {
        form?.classList.toggle('name-saved');
        input?.focus();
      });

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
      this.#layer.querySelector('[data-action="instant"]')?.addEventListener('click', this.actions.onPlay);
      this.#layer.querySelector('[data-action="friend"]')?.addEventListener('click', this.actions.onPlayFriend);
      this.#layer.querySelector('[data-action="local"]')?.addEventListener('click', this.actions.onPlayFriend);

      const notice = this.#layer.querySelector<HTMLElement>('#desk-notice');
      const noticeMsg = this.#layer.querySelector<HTMLElement>('.notice-msg');
      const showNotice = (msg: string) => {
        if (!notice || !noticeMsg) return;
        noticeMsg.textContent = msg;
        notice.hidden = false;
      };
      this.#layer.querySelector('.notice-close')?.addEventListener('click', () => {
        if (notice) notice.hidden = true;
      });

      this.#layer.querySelector('[data-action="tournament"]')?.addEventListener('click', () => {
        showNotice('Saturday Recess Tournament opens at 2:00 PM! Sattu currently holds the championship belt.');
      });
      this.#layer.querySelector('[data-action="ranking"]')?.addEventListener('click', () => {
        showNotice('Class 9A Standings: You are at #12 (Rookie Desk). Defeat your classmate rivals to climb into the top 10!');
      });
      this.#layer.querySelector('[data-action="community"]')?.addEventListener('click', () => {
        showNotice('Classroom Community boards are preparing for next term. Join on Discord soon!');
      });
      this.#layer.querySelector('[data-action="signin"]')?.addEventListener('click', () => {
        showNotice('Sign in with school roll number or Google will arrive in Pilot V6.');
      });
      this.#layer.querySelector('[data-action="info-how"]')?.addEventListener('click', (e) => {
        e.preventDefault();
        showNotice('Rules: Pull back on your pen to set direction and power, release to flick. Knock rival pen off the desk to win rounds!');
      });
      this.#layer.querySelector('[data-action="info-what"]')?.addEventListener('click', (e) => {
        e.preventDefault();
        showNotice('Pen Fight: The legendary classroom tabletop sport played on wooden desks with ballpoint pens.');
      });
      this.#layer.querySelector('[data-action="info-notice"]')?.addEventListener('click', (e) => {
        e.preventDefault();
        showNotice('Notice: Pencils and Geometry boxes will be allowed in Stage 9C!');
      });

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
      this.#layer.querySelector<HTMLInputElement>('[data-setting="ambience"]')?.addEventListener('change', (event) => {
        this.actions.onToggleAmbience((event.currentTarget as HTMLInputElement).checked);
      });
      this.#layer.querySelector<HTMLInputElement>('[data-setting="motion"]')?.addEventListener('change', (event) => {
        this.actions.onToggleReducedMotion((event.currentTarget as HTMLInputElement).checked);
      });
      this.#layer.querySelectorAll<HTMLElement>('[data-action="toggle-audio"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.actions.onToggleAmbience(!state.settings.ambience);
        });
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
          <p class="eyebrow">FRIEND MATCH · LOCAL DESK</p>
          <h1 id="local-setup-title">Choose your rival</h1>
          <p class="local-player-one"><span>PLAYER 1 · BLUE PEN</span><strong>${escapeText(state.player.name)}</strong></p>
          ${onlineBusy ? `<section class="online-room" aria-live="polite"><span>${this.#online.status === 'ready' ? 'FRIEND CONNECTED' : this.#online.status === 'error' ? 'CONNECTION PROBLEM' : 'ONLINE INVITE'}</span>${room ? `<strong class="room-code">${escapeText(room)}</strong><p>Send this link to your friend. They only need to open it.</p><button class="paper-button copy-invite" type="button">Copy invite link</button>` : '<p>Opening a classroom online…</p>'}${this.#online.error ? `<p class="form-error">${escapeText(this.#online.error)}</p>` : ''}</section>` : `<div class="friend-mode-grid"><button class="friend-mode active" data-friend-mode="local" type="button"><strong>Same device</strong><small>Take turns at this desk</small></button><button class="friend-mode" data-friend-mode="online" type="button"><strong>Online invite</strong><small>Each friend uses a device</small></button></div>
          <form class="local-setup-form">
            <div class="player-count-picker-group">
              <span class="picker-label">Number of players</span>
              <div class="player-count-picker" role="radiogroup" aria-label="Number of players">
                <button type="button" class="player-count-btn active" data-count="2" aria-pressed="true">2 Players</button>
                <button type="button" class="player-count-btn" data-count="3" aria-pressed="false">3 Players</button>
                <button type="button" class="player-count-btn" data-count="4" aria-pressed="false">4 Players</button>
              </div>
            </div>

            <div class="player-input-row" data-player-field="2">
              <label for="rival-name">Player 2 name</label>
              <div class="input-line"><input id="rival-name" name="rivalName" maxlength="18" autocomplete="off" placeholder="Who is taking the red pen?" autofocus><span class="pencil-mark">✎</span></div>
            </div>

            <div class="player-input-row" data-player-field="3" hidden>
              <label for="player-3-name">Player 3 name</label>
              <div class="input-line"><input id="player-3-name" name="player3Name" maxlength="18" autocomplete="off" placeholder="Who is taking the green pen?"><span class="pencil-mark">✎</span></div>
            </div>

            <div class="player-input-row" data-player-field="4" hidden>
              <label for="player-4-name">Player 4 name</label>
              <div class="input-line"><input id="player-4-name" name="player4Name" maxlength="18" autocomplete="off" placeholder="Who is taking the gold pen?"><span class="pencil-mark">✎</span></div>
            </div>

            <p class="form-error" role="alert"></p>
            <button class="paper-button primary" type="submit">Start local match <span>→</span></button>
          </form><section class="online-choice" hidden><p>Create a private room and share one link—no account required.</p><button class="paper-button primary create-online" type="button">Create invite link <span>→</span></button><form class="join-room-form"><label for="room-code">Or enter a room code</label><div class="input-line"><input id="room-code" maxlength="6" placeholder="ABC234"><button type="submit">JOIN</button></div></form></section>`}
        </section>
      </div>`;
      let selectedPlayerCount = 2;
      const countButtons = this.#layer.querySelectorAll<HTMLButtonElement>('.player-count-btn');
      countButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const count = Number(btn.dataset.count ?? '2');
          selectedPlayerCount = count;
          countButtons.forEach((b) => {
            const active = b === btn;
            b.classList.toggle('active', active);
            b.setAttribute('aria-pressed', String(active));
          });
          const row3 = this.#layer.querySelector<HTMLElement>('[data-player-field="3"]');
          const row4 = this.#layer.querySelector<HTMLElement>('[data-player-field="4"]');
          if (row3) row3.hidden = count < 3;
          if (row4) row4.hidden = count < 4;
          if (error) error.textContent = '';
        });
      });
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

        if (selectedPlayerCount === 2) {
          this.actions.onStartLocal(rivalName);
          return;
        }

        const p3Input = this.#layer.querySelector<HTMLInputElement>('#player-3-name');
        const p3Name = p3Input?.value.trim() ?? '';
        if (!p3Name) {
          if (error) error.textContent = 'Write Player 3’s name before starting.';
          p3Input?.focus();
          return;
        }

        if (selectedPlayerCount === 3) {
          this.actions.onStartLocal([rivalName, p3Name]);
          return;
        }

        const p4Input = this.#layer.querySelector<HTMLInputElement>('#player-4-name');
        const p4Name = p4Input?.value.trim() ?? '';
        if (!p4Name) {
          if (error) error.textContent = 'Write Player 4’s name before starting.';
          p4Input?.focus();
          return;
        }

        this.actions.onStartLocal([rivalName, p3Name, p4Name]);
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
      const rivalName = local || online
        ? state.match?.rivalName ?? 'PLAYER 2'
        : state.match?.rivalName ?? 'CLASS ACE';

      const playerNames: readonly string[] = state.match?.playerNames && state.match.playerNames.length > 0
        ? state.match.playerNames
        : [state.player.name, rivalName];

      const activeName = playerNames[activePlayer] ?? (activePlayer === 0 ? state.player.name : rivalName);
      const paused = state.phase === 'paused';
      const roundLocked = Boolean(this.#roundMessage);
      const PEN_COLOR_NAMES = ['blue', 'red', 'green', 'gold'] as const;
      const penColor = PEN_COLOR_NAMES[activePlayer] ?? 'blue';
      const defaultTurnTitle = aiTurn
        ? 'RIVAL IS AIMING'
        : practice
          ? 'PRACTICE SHOT'
          : local || online
            ? `${activeName.toUpperCase()}’S TURN`
            : 'YOUR TURN';
      const defaultTurnHint = aiTurn
        ? 'Watch the table edge'
        : `Grab the ${penColor} pen · pull back · release`;
      const [actionTitle, actionHint] = arenaStatus(this.#arenaAction, defaultTurnTitle, defaultTurnHint);
      const turnTitle = paused ? 'MATCH PAUSED' : roundLocked ? 'ROUND RESETTING' : actionTitle;
      const turnHint = paused ? 'Return to the game to continue' : roundLocked ? this.#roundMessage! : actionHint;
      const scores = state.match?.score ?? [0, 0];
      const playerScore = scores[0] ?? 0;
      const rivalScore = scores[1] ?? 0;

      this.#layer.innerHTML = `
        <!-- Match Top Navigation Bar -->
        <header class="match-hud match-top-bar" aria-label="Match controls">
          <div class="match-bar-left">
            <button class="glass-button match-exit" type="button" aria-label="Leave match">
              <span>←</span> EXIT
            </button>
            <span class="match-mode match-mode-badge">${practice ? 'FREE PLAY' : online ? `ONLINE · ${escapeText(this.#online.room ?? '')}` : local ? 'LOCAL FRIEND' : 'QUICK MATCH'}</span>
          </div>

          <div class="match-bar-right">
            <button type="button" class="match-chip-btn audio-toggle-btn ${state.settings.ambience ? '' : 'muted'}" data-action="toggle-audio" aria-label="${state.settings.ambience ? 'Mute sound' : 'Unmute sound'}" title="${state.settings.ambience ? 'Mute sound' : 'Unmute sound'}">
              <span class="audio-icon" aria-hidden="true">${state.settings.ambience ? '🔊' : '🔇'}</span>
              <span class="audio-label">${state.settings.ambience ? 'SOUND ON' : 'MUTED'}</span>
            </button>
            <button type="button" class="match-chip-btn friend-btn" data-action="friend">FRIEND</button>
            <button type="button" class="match-chip-btn instant-btn" data-action="instant">INSTANT</button>
            <button type="button" class="match-text-btn" data-action="community">community</button>
            <button type="button" class="match-signin-btn" data-action="signin">SIGN IN</button>
            <button type="button" class="match-menu-btn" data-action="leave" aria-label="Match menu">
              <i></i><i></i><i></i>
            </button>
          </div>
        </header>

        <!-- Bottom Left Corner Watermark -->
        <div class="match-corner-badge" aria-label="Pen Fight Pilot V5">
          <span class="pilot-box"><span class="pilot-pen-icon" aria-hidden="true"></span>PEN FIGHT</span>
          <span class="pilot-version">Pilot V5</span>
        </div>

        <!-- Bottom Right Sticky Badge -->
        <section class="turn-dock desk-turn-sticker ${activePlayer > 0 ? 'rival-turn' : ''} turn-player-${activePlayer} ${roundLocked ? 'round-locked' : ''}" aria-label="Turn status" aria-live="polite" data-player="${activePlayer}" data-action="${this.#arenaAction}" data-ready-title="${escapeAttr(defaultTurnTitle)}" data-ready-hint="${escapeAttr(defaultTurnHint)}" data-locked="${paused || roundLocked}">
          <span class="sticker-hand" aria-hidden="true">👉</span>
          <div class="turn-copy">
            <strong>${escapeText(turnTitle)}</strong>
            <small class="${turnHint ? '' : 'sr-only'}">${escapeText(turnHint)}</small>
          </div>
        </section>

        <!-- Match Footer Dock (Power Meter & Clean Scoreboard) -->
        <div class="match-footer">
          <section class="round-banner paper" role="status" ${this.#roundMessage ? '' : 'hidden'}>
            ${escapeText(this.#roundMessage ?? '')}
          </section>

          <section class="power-dock" role="meter" aria-label="Flick power" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(this.#aimPower * 100)}">
            <span class="power-label">FLICK POWER</span>
            <div class="power-track"><i style="width: ${Math.round(this.#aimPower * 100)}%"></i></div>
            <b class="power-percent">${Math.round(this.#aimPower * 100)}%</b>
          </section>

          <section class="scoreboard match-clean-scoreboard ${playerNames.length > 2 ? 'multi-player' : ''}" aria-label="Match score">
            ${playerNames.length > 2 ? playerNames.map((name, idx) => `
              <div class="competitor competitor-${idx} ${activePlayer === idx ? 'active' : ''}">
                <span class="pen-swatch ${PEN_COLOR_NAMES[idx] ?? 'blue'}"></span>
                <span class="competitor-copy"><small>PLAYER ${idx + 1}</small><strong>${escapeText(name)}</strong></span>
                <span class="score-pips" aria-hidden="true">${scorePips(scores[idx] ?? 0)}</span>
                <b>${scores[idx] ?? 0}</b>
              </div>
            `).join('') : `
              <div class="competitor player ${activePlayer === 0 ? 'active' : ''}">
                <span class="pen-swatch blue"></span>
                <span class="competitor-copy"><small>${local || online ? 'PLAYER 1' : 'YOU'}</small><strong>${escapeText(playerNames[0] ?? state.player.name)}</strong></span>
                <span class="score-pips" aria-hidden="true">${scorePips(playerScore)}</span>
                <b>${playerScore}</b>
              </div>
              <div class="competitor rival ${activePlayer === 1 ? 'active' : ''}">
                <b>${rivalScore}</b>
                <span class="score-pips" aria-hidden="true">${scorePips(rivalScore)}</span>
                <span class="competitor-copy"><small>${local || online ? 'PLAYER 2' : 'RIVAL'}</small><strong>${escapeText(playerNames[1] ?? rivalName)}</strong></span>
                <span class="pen-swatch red"></span>
              </div>
            `}
          </section>
        </div>
      `;

      this.#layer.querySelectorAll<HTMLElement>('.match-exit, [data-action="leave"]').forEach((btn) => {
        btn.addEventListener('click', this.actions.onBack);
      });
      this.#layer.querySelector('[data-action="toggle-audio"]')?.addEventListener('click', () => {
        this.actions.onToggleAmbience(!state.settings.ambience);
      });
      this.#layer.querySelector('[data-action="friend"]')?.addEventListener('click', () => {
        this.actions.onPlayFriend();
      });
      this.#layer.querySelector('[data-action="instant"]')?.addEventListener('click', () => {
        this.actions.onChooseMode('quick');
      });
      this.#layer.querySelector('[data-action="community"]')?.addEventListener('click', () => {
        alert('Classroom Community is coming soon in the next school term!');
      });
      this.#layer.querySelector('[data-action="signin"]')?.addEventListener('click', () => {
        alert('Player accounts will be available in Pilot V6!');
      });

      this.setAimPower(this.#aimPower);
      return;
    }

    if (state.phase === 'result') {
      const scores = state.match?.score ?? [0, 0];
      const maxScore = Math.max(...scores);
      const winningIndex = scores.indexOf(maxScore);
      const playerNames = state.match?.playerNames && state.match.playerNames.length > 0
        ? state.match.playerNames
        : [state.player.name, state.match?.rivalName ?? 'Player 2'];
      const won = winningIndex === 0;
      const winnerName = playerNames[winningIndex] ?? state.player.name;
      const isMulti = playerNames.length > 2;

      this.#layer.innerHTML = `<section class="paper result-card" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <p class="eyebrow">FINAL BELL</p>
        <h1 id="result-title">${isMulti ? `${escapeText(winnerName)} is Champion!` : won ? 'Desk champion!' : 'Rematch?'}</h1>
        <p>${isMulti
          ? playerNames.map((name, i) => `${escapeText(name)}: <strong>${scores[i] ?? 0}</strong>`).join(' · ')
          : `${escapeText(playerNames[0])} <strong>${scores[0] ?? 0} : ${scores[1] ?? 0}</strong> ${escapeText(playerNames[1])}`
        }</p>
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

  triggerHit(intensity: number): void {
    if (this.#state?.settings?.reducedMotion) return;
    this.#layer.classList.remove('pen-hit-pulse');
    void this.#layer.offsetWidth;
    this.#layer.classList.add('pen-hit-pulse');
    window.setTimeout(() => {
      this.#layer.classList.remove('pen-hit-pulse');
    }, 280);
  }

  dispose(): void { this.#unsubscribe(); this.#layer.remove(); }
}
