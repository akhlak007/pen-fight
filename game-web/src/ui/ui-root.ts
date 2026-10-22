import type { AppState } from '../app/app-state';
import type { AppStore } from '../app/app-store';
import type { ArenaAction } from '../game/solo-turn-controller';
import type { OnlineState } from '../network/online-session';
import type { AccountState } from '../account/account-client';
import type { LeaderboardPage } from '../account/account-types';
import { AVATARS, DESKS, FLAG_CODES, PENS, avatarById, flagEmoji, itemUnlocked } from '../profile/profile-catalog';
import { progressForXp, titleForLevel } from '../profile/progression';

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
  onOpenProfile(): void;
  onOpenAccount(): void;
  onOpenLeaderboard(): void;
  onSignup(username: string, password: string): Promise<void>;
  onLogin(username: string, password: string): Promise<void>;
  onLogout(): Promise<void>;
  onLoadMoreLeaderboard(): void;
  onSetAvatar(avatarId: string): void;
  onSetFlag(flagCode: string): void;
  onEquipPen(penId: string): void;
  onEquipDesk(deskId: string): void;
  onToggleReducedMotion(value: boolean): void;
  onToggleAmbience(value: boolean): void;
  onRematch(): void;
  onCancelOnline?(): void;
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

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function arenaStatus(action: ArenaAction, readyTitle: string, readyHint: string): readonly [string, string] {
  switch (action) {
    case 'aiming': return ['AIMING', 'Pull back for power · grab a tip to spin'];
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
  #pendingInvite: string | null = null;
  #friendSetupMode: 'local' | 'online' = 'local';
  #account: AccountState = { status: 'checking' };
  #leaderboard: { loading: boolean; page?: LeaderboardPage; error?: string } = { loading: false };
  #state!: AppState;

  constructor(store: AppStore, private readonly actions: UiActions) {
    this.#layer = document.createElement('div');
    this.#layer.className = 'ui-layer';
    document.querySelector('.game-shell')?.append(this.#layer);
    this.#unsubscribe = store.subscribe((state) => { this.#state = state; this.render(state); });
    this.#state = store.snapshot;
    this.render(store.snapshot);
  }

  setAccountState(state: AccountState): void {
    this.#account = state;
    if (this.#state.phase === 'home' || this.#state.phase === 'account' || this.#state.phase === 'profile') this.render(this.#state);
  }

  setLeaderboardState(state: { loading: boolean; page?: LeaderboardPage; error?: string }): void {
    this.#leaderboard = state;
    if (this.#state.phase === 'leaderboard') this.render(this.#state);
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
      const homeProgress = progressForXp(state.profile.xp);
      const homeAvatar = avatarById(state.profile.avatarId);
      const isUnlocked = (item: { readonly id: string; readonly unlockLevel: number }) =>
        itemUnlocked(item.unlockLevel, homeProgress.level) || state.profile.unlockedCosmeticIds.includes(item.id);
      const unlockedPenCount = PENS.filter(isUnlocked).length;
      const unlockedDeskCount = DESKS.filter(isUnlocked).length;
      this.#layer.innerHTML = `
        <!-- Classroom Desk Header Bar -->
        <header class="desk-top-bar" aria-label="Classroom navigation">
          <div class="pilot-badge-corner" aria-label="Pen Fight Pilot V5">
            <span class="pilot-box"><span class="pilot-pen-icon" aria-hidden="true"></span>PEN FIGHT</span>
            <span class="pilot-version">Pilot V5</span>
          </div>
          <div class="top-nav-actions">
            <button type="button" class="nav-text-btn" data-action="community">Community</button>
            <button type="button" class="nav-pill-btn" data-action="signin">${this.#account.status === 'authenticated' ? escapeText(this.#account.account?.username ?? 'ACCOUNT') : 'SIGN IN'}</button>
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
                ${hasName ? `
                  <div class="home-passport-wrap">
                    <button type="button" class="home-passport-card profile-open" aria-label="Open your Player Passport" aria-describedby="home-passport-summary">
                      <span class="home-passport-avatar" style="--avatar-color:${escapeAttr(homeAvatar.color)}" aria-hidden="true">${homeAvatar.glyph}</span>
                      <span class="home-passport-identity" id="home-passport-summary">
                        <span class="home-passport-kicker">PLAYER PASSPORT · ${flagEmoji(state.profile.flagCode)}</span>
                        <strong>${escapeText(displayName)}</strong>
                        <small>${escapeText(titleForLevel(homeProgress.level))} · LEVEL ${homeProgress.level} OF 99</small>
                        <span class="home-passport-xp" aria-hidden="true"><i style="width:${Math.round(homeProgress.ratio * 100)}%"></i></span>
                      </span>
                      <span class="home-passport-stats" aria-label="Player collection summary">
                        <span><b>${state.profile.wins}</b><small>WINS</small></span>
                        <span><b>${unlockedPenCount}/${PENS.length}</b><small>PENS</small></span>
                        <span><b>${unlockedDeskCount}/${DESKS.length}</b><small>DESKS</small></span>
                      </span>
                      <span class="home-passport-cta">OPEN PROFILE <b aria-hidden="true">→</b></span>
                    </button>
                    <button type="button" class="edit-name-pen" aria-label="Edit name" title="Change name">✎</button>
                  </div>
                ` : `
                  <div class="player-title-row">
                    <span class="player-display">${escapeText(displayName)}</span>
                  </div>
                  <div class="player-journey-subline">
                    <span>${escapeText(titleForLevel(homeProgress.level))} · </span><span class="trimax-red">Level ${homeProgress.level}</span>
                  </div>
                `}

                ${!hasName && this.#pendingInvite ? `
                  <div class="invite-welcome-banner" role="status">
                    <span class="invite-banner-badge">ROOM INVITATION</span>
                    <p>You’ve been challenged to Pen Fight in Desk <strong>${escapeText(this.#pendingInvite)}</strong>! Claim your desk to enter the battle.</p>
                  </div>
                ` : ''}

                <form class="home-name-form ${hasName ? 'name-saved' : 'name-active'}">
                  <label for="player-name">Your name</label>
                  <div class="notebook-name-line">
                    <input id="player-name" name="name" maxlength="18" autocomplete="nickname" placeholder="Write your name" value="${escapeText(inputValue)}" ${hasName ? '' : 'autofocus'}>
                    <button type="submit">${hasName ? 'UPDATE' : this.#pendingInvite ? `Claim my desk & Join ${escapeText(this.#pendingInvite)}` : 'Claim my desk'} <span aria-hidden="true">→</span></button>
                  </div>
                  <p class="form-error" role="alert"></p>
                </form>

                <div class="desk-bump" aria-hidden="true">
                  <div class="desk-bump-scene">
                    <i class="bump-trail"></i>
                    <i class="bump-pen bump-blue"><b></b><b></b><b></b></i>
                    <i class="bump-pen bump-orange"><b></b><b></b><b></b></i>
                    <i class="bump-spark"></i>
                  </div>
                </div>

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
                    <img src="${import.meta.env.BASE_URL}door_9a.jpg" alt="Classroom 9A door" class="door-img" />
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
                <img src="${import.meta.env.BASE_URL}blue_pen.jpg" alt="" class="pen-img-prop" />
              </div>

              <div class="ruled-heading play-heading"><span>PLAY ANOTHER WAY</span></div>

              <nav class="play-list" aria-label="Play another way">
                <button class="mode-item friend-choice online-friend-choice" data-action="friend" type="button" ${hasName ? '' : 'disabled'}>
                  <span class="mode-icon chain-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                  </span>
                  <span class="mode-content">
                    <span class="mode-title-row"><strong>PLAY A FRIEND ONLINE</strong><span class="badge-live">LIVE</span></span>
                    <small>2 players · private match</small>
                    <span class="feature-chips" aria-label="Online features"><i>INVITE LINK</i><i>ROOM CODE</i><i>BEST OF 3</i><i>REMATCH</i></span>
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
                      <strong>SAME-DEVICE LOCAL</strong>
                      <span class="badge-highlighter">SIMPLE</span>
                    </span>
                    <small>2–4 players · take turns on one device</small>
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

              <div class="physics-feature-note" aria-label="Pen physics feature">
                <b>REAL PEN PHYSICS</b><span>Pens collide, spin, and stay separate.</span>
              </div>

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
      this.#layer.querySelector('.profile-open')?.addEventListener('click', this.actions.onOpenProfile);

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
      this.#layer.querySelector('[data-action="friend"]')?.addEventListener('click', () => {
        this.#friendSetupMode = 'online';
        this.actions.onPlayFriend();
      });
      this.#layer.querySelector('[data-action="local"]')?.addEventListener('click', () => {
        this.#friendSetupMode = 'local';
        this.actions.onPlayFriend();
      });

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
      this.#layer.querySelector('[data-action="ranking"]')?.addEventListener('click', this.actions.onOpenLeaderboard);
      this.#layer.querySelector('[data-action="community"]')?.addEventListener('click', () => {
        showNotice('Classroom Community boards are preparing for next term. Join on Discord soon!');
      });
      this.#layer.querySelector('[data-action="signin"]')?.addEventListener('click', this.actions.onOpenAccount);
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

    if (state.phase === 'account') {
      const authenticated = this.#account.status === 'authenticated' && this.#account.account;
      const progress = progressForXp(state.profile.xp);
      this.#layer.innerHTML = `<div class="account-screen">
        <div class="top-bar"><button class="glass-button account-back" type="button">← CLASSROOM</button></div>
        <section class="paper account-card" role="dialog" aria-modal="true" aria-labelledby="account-title">
          ${authenticated ? `
            <p class="eyebrow">ONLINE ACCOUNT</p>
            <h1 id="account-title">${escapeText(authenticated.username)}</h1>
            <div class="account-online-badge"><span aria-hidden="true">●</span> SIGNED IN · ${this.#account.syncing ? 'SYNCING…' : this.#account.error ? 'SYNC NEEDS RETRY' : 'PROGRESS SYNCED'}</div>
            <div class="account-profile-summary">
              <span class="account-avatar" style="--avatar-color:${escapeAttr(avatarById(state.profile.avatarId).color)}">${avatarById(state.profile.avatarId).glyph}</span>
              <div><strong>${flagEmoji(state.profile.flagCode)} LEVEL ${progress.level}</strong><small>${state.profile.xp.toLocaleString()} XP · ${state.profile.wins} WINS · ${state.profile.matches} MATCHES</small></div>
            </div>
            ${this.#account.error ? `<p class="account-status-error" role="status">${escapeText(this.#account.error)}</p>` : ''}
            <p>Your Player Passport is saved to this account and can be restored on another device.</p>
            <button type="button" class="paper-button signout-button">SIGN OUT</button>
          ` : `
            <p class="eyebrow">PEN FIGHT ACCOUNT</p>
            <h1 id="account-title">Save your place</h1>
            ${this.#account.status === 'offline' ? `<p class="account-status-error" role="status">Account server unavailable. Local play still works.</p>` : ''}
            <div class="account-tabs" role="tablist" aria-label="Account action">
              <button type="button" role="tab" class="account-tab active" data-account-tab="signup" aria-selected="true">CREATE ACCOUNT</button>
              <button type="button" role="tab" class="account-tab" data-account-tab="login" aria-selected="false">SIGN IN</button>
            </div>
            <form class="account-form signup-form">
              <div class="import-progress-note"><strong>KEEP YOUR PROGRESS</strong><span>Your Level ${progress.level}, ${state.profile.xp} XP, avatar, flag, pens, and desks will move into this account.</span></div>
              <label for="signup-username">Username</label><input id="signup-username" name="username" minlength="3" maxlength="18" pattern="[A-Za-z0-9_]+" autocomplete="username" required placeholder="3–18 letters, numbers or _">
              <label for="signup-password">Password</label><input id="signup-password" name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required placeholder="At least 8 characters">
              <label for="signup-confirm">Confirm password</label><input id="signup-confirm" name="confirm" type="password" minlength="8" maxlength="128" autocomplete="new-password" required>
              <p class="account-error" role="alert"></p>
              <button class="paper-button primary" type="submit">CREATE ACCOUNT <span>→</span></button>
            </form>
            <form class="account-form login-form" hidden>
              <label for="login-username">Username</label><input id="login-username" name="username" maxlength="18" autocomplete="username" required>
              <label for="login-password">Password</label><input id="login-password" name="password" type="password" maxlength="128" autocomplete="current-password" required>
              <p class="account-error" role="alert"></p>
              <button class="paper-button primary" type="submit">SIGN IN <span>→</span></button>
            </form>
          `}
        </section>
      </div>`;
      this.#layer.querySelector('.account-back')?.addEventListener('click', this.actions.onBack);
      this.#layer.querySelector('.signout-button')?.addEventListener('click', () => void this.actions.onLogout());
      this.#layer.querySelectorAll<HTMLButtonElement>('[data-account-tab]').forEach((button) => button.addEventListener('click', () => {
        const signup = button.dataset.accountTab === 'signup';
        this.#layer.querySelector('.signup-form')?.toggleAttribute('hidden', !signup);
        this.#layer.querySelector('.login-form')?.toggleAttribute('hidden', signup);
        this.#layer.querySelectorAll<HTMLButtonElement>('[data-account-tab]').forEach((tab) => {
          const selected = tab === button;
          tab.classList.toggle('active', selected);
          tab.setAttribute('aria-selected', String(selected));
        });
      }));
      const submit = async (form: HTMLFormElement, mode: 'signup' | 'login') => {
        const error = form.querySelector<HTMLElement>('.account-error');
        const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
        const username = form.querySelector<HTMLInputElement>('input[name="username"]')?.value.trim() ?? '';
        const password = form.querySelector<HTMLInputElement>('input[name="password"]')?.value ?? '';
        const confirm = form.querySelector<HTMLInputElement>('input[name="confirm"]')?.value;
        if (mode === 'signup' && password !== confirm) { if (error) error.textContent = 'Passwords do not match.'; return; }
        if (error) error.textContent = '';
        if (button) { button.disabled = true; button.textContent = mode === 'signup' ? 'CREATING…' : 'SIGNING IN…'; }
        try {
          if (mode === 'signup') await this.actions.onSignup(username, password);
          else await this.actions.onLogin(username, password);
        } catch (cause) {
          if (error) error.textContent = cause instanceof Error ? cause.message : 'Account request failed.';
          if (button) { button.disabled = false; button.textContent = mode === 'signup' ? 'CREATE ACCOUNT →' : 'SIGN IN →'; }
        }
      };
      this.#layer.querySelector<HTMLFormElement>('.signup-form')?.addEventListener('submit', (event) => { event.preventDefault(); void submit(event.currentTarget as HTMLFormElement, 'signup'); });
      this.#layer.querySelector<HTMLFormElement>('.login-form')?.addEventListener('submit', (event) => { event.preventDefault(); void submit(event.currentTarget as HTMLFormElement, 'login'); });
      return;
    }

    if (state.phase === 'leaderboard') {
      const page = this.#leaderboard.page;
      const currentId = this.#account.account?.id;
      const rows = page?.entries.map((entry) => {
        const avatar = avatarById(entry.avatarId);
        const current = entry.playerId === currentId;
        return `<li class="leaderboard-row ${current ? 'current-player' : ''}" ${current ? 'aria-current="true"' : ''}>
          <b class="leader-rank">#${entry.rank}</b>
          <span class="leader-avatar" style="--avatar-color:${escapeAttr(avatar.color)}">${avatar.glyph}</span>
          <span class="leader-name"><strong>${escapeText(entry.username)} ${flagEmoji(entry.flagCode)}</strong><small>LEVEL ${entry.level} · ${entry.xp.toLocaleString()} XP</small></span>
          <span class="leader-record"><b>${entry.wins}</b><small>WINS</small></span>
          <span class="leader-record"><b>${entry.matches}</b><small>MATCHES</small></span>
          <span class="leader-record"><b>${entry.winRate}%</b><small>WIN RATE</small></span>
        </li>`;
      }).join('') ?? '';
      this.#layer.innerHTML = `<div class="leaderboard-screen">
        <div class="top-bar"><button class="glass-button leaderboard-back" type="button">← CLASSROOM</button></div>
        <section class="paper leaderboard-card" aria-labelledby="leaderboard-title">
          <header class="leaderboard-heading"><div><p class="eyebrow">GLOBAL CLASS RANKING</p><h1 id="leaderboard-title">All players</h1><p>${page ? `${page.total.toLocaleString()} registered players · ranked by XP then wins` : 'Opening the class register…'}</p></div><button type="button" class="glass-button leaderboard-refresh">REFRESH</button></header>
          ${page?.currentRank ? `<div class="my-rank-banner">YOUR GLOBAL RANK <strong>#${page.currentRank}</strong></div>` : this.#account.status === 'authenticated' ? '' : '<div class="my-rank-banner guest">Create an account to claim a global rank.</div>'}
          ${this.#leaderboard.error ? `<div class="leaderboard-error" role="alert"><strong>Leaderboard unavailable</strong><span>${escapeText(this.#leaderboard.error)}</span></div>` : this.#leaderboard.loading && !page ? '<div class="leaderboard-loading" role="status">Loading every desk…</div>' : page?.total === 0 ? '<div class="leaderboard-empty">No ranked players yet. Be the first.</div>' : `<ol class="leaderboard-list" aria-label="Global player rankings">${rows}</ol>`}
          ${page && page.entries.length < page.total ? `<button type="button" class="paper-button leaderboard-more" ${this.#leaderboard.loading ? 'disabled' : ''}>${this.#leaderboard.loading ? 'LOADING…' : `LOAD MORE · ${page.entries.length}/${page.total}`}</button>` : ''}
        </section>
      </div>`;
      this.#layer.querySelector('.leaderboard-back')?.addEventListener('click', this.actions.onBack);
      this.#layer.querySelector('.leaderboard-refresh')?.addEventListener('click', this.actions.onOpenLeaderboard);
      this.#layer.querySelector('.leaderboard-more')?.addEventListener('click', this.actions.onLoadMoreLeaderboard);
      return;
    }

    if (state.phase === 'profile') {
      const progress = progressForXp(state.profile.xp);
      const avatar = avatarById(state.profile.avatarId);
      const winRate = state.profile.matches > 0 ? Math.round((state.profile.wins / state.profile.matches) * 100) : 0;
      const unlockedPenCount = PENS.filter((pen) => itemUnlocked(pen.unlockLevel, progress.level) || state.profile.unlockedCosmeticIds.includes(pen.id)).length;
      const unlockedDeskCount = DESKS.filter((desk) => itemUnlocked(desk.unlockLevel, progress.level) || state.profile.unlockedCosmeticIds.includes(desk.id)).length;
      const flags = FLAG_CODES.map((code) => `<button type="button" role="radio" class="flag-option ${state.profile.flagCode === code ? 'selected' : ''}" data-flag="${code}" data-search="${escapeAttr(`${countryName(code)} ${code}`.toLowerCase())}" aria-checked="${state.profile.flagCode === code}"><span>${flagEmoji(code)}</span>${escapeText(countryName(code))}</button>`).join('');
      const penCards = PENS.map((pen) => {
        const unlocked = itemUnlocked(pen.unlockLevel, progress.level) || state.profile.unlockedCosmeticIds.includes(pen.id);
        const selected = state.profile.selectedPenId === pen.id;
        return `<button type="button" class="cosmetic-card ${selected ? 'equipped' : ''} ${unlocked ? '' : 'locked'}" data-pen="${pen.id}" ${unlocked ? '' : 'disabled'} aria-pressed="${selected}">
          <span class="pen-preview" style="--pen-primary:${pen.primary};--pen-accent:${pen.accent}"><i></i></span>
          <strong>${escapeText(pen.label)}</strong>
          <small>${selected ? 'EQUIPPED' : unlocked ? 'Unlocked' : `🔒 Level ${pen.unlockLevel}`}</small>
        </button>`;
      }).join('');
      const deskCards = DESKS.map((desk) => {
        const unlocked = itemUnlocked(desk.unlockLevel, progress.level) || state.profile.unlockedCosmeticIds.includes(desk.id);
        const selected = state.profile.selectedDeskId === desk.id;
        return `<button type="button" class="cosmetic-card desk-card ${selected ? 'equipped' : ''} ${unlocked ? '' : 'locked'}" data-desk="${desk.id}" ${unlocked ? '' : 'disabled'} aria-pressed="${selected}">
          <span class="desk-preview" style="--desk-surface:${desk.surface};--desk-trim:${desk.trim}"></span>
          <strong>${escapeText(desk.label)}</strong>
          <small>${selected ? 'EQUIPPED' : unlocked ? 'Unlocked' : `🔒 Level ${desk.unlockLevel}`}</small>
        </button>`;
      }).join('');

      this.#layer.innerHTML = `<div class="profile-screen">
        <div class="top-bar"><button class="glass-button profile-back" type="button">← CLASSROOM</button></div>
        <section class="paper player-passport" role="dialog" aria-modal="true" aria-labelledby="passport-title">
          <header class="passport-heading">
            <div class="passport-mark" style="--avatar-color:${avatar.color}">${avatar.glyph}</div>
            <div><p class="eyebrow">PEN FIGHT PLAYER PASSPORT</p><h1 id="passport-title">${escapeText(state.player.name.toUpperCase())} ${flagEmoji(state.profile.flagCode)}</h1><p>${escapeText(titleForLevel(progress.level))} · Level ${progress.level}</p>${this.#account.status === 'authenticated' ? `<span class="account-online-badge"><span aria-hidden="true">●</span> ONLINE ACCOUNT · ${escapeText(this.#account.account?.username ?? '')}</span>` : ''}<button type="button" class="text-button profile-edit-name">EDIT NAME</button></div>
          </header>
          <div class="passport-columns">
            <div class="passport-main">
              <section class="passport-panel progress-panel" aria-label="Player progress">
                <div class="level-summary"><strong>LEVEL ${progress.level}</strong><span>${progress.maxLevel ? 'MAX LEVEL' : `${progress.remainingXp} XP TO LEVEL ${progress.level + 1}`}</span></div>
                <div class="passport-xp" role="progressbar" aria-valuemin="0" aria-valuemax="${progress.maxLevel ? 1 : progress.requiredInLevel}" aria-valuenow="${progress.maxLevel ? 1 : progress.earnedInLevel}"><i style="width:${Math.round(progress.ratio * 100)}%"></i></div>
                <small>${progress.currentXp.toLocaleString()} TOTAL XP</small>
                <div class="passport-stats"><div><b>${state.profile.wins}</b><span>WINS</span></div><div><b>${state.profile.matches}</b><span>MATCHES</span></div><div><b>${winRate}%</b><span>WIN RATE</span></div></div>
              </section>
              <section class="passport-panel"><div class="section-title"><h2>MY PENS</h2><span>${unlockedPenCount}/${PENS.length} UNLOCKED</span></div><div class="cosmetic-row">${penCards}</div></section>
              <section class="passport-panel"><div class="section-title"><h2>MY DESKS</h2><span>${unlockedDeskCount}/${DESKS.length} UNLOCKED</span></div><div class="cosmetic-row desk-row">${deskCards}</div></section>
            </div>
            <aside class="passport-editor">
              <section class="passport-panel"><h2>AVATAR</h2><div class="avatar-grid" role="radiogroup" aria-label="Choose avatar">${AVATARS.map((option) => `<button type="button" role="radio" class="avatar-option ${option.id === state.profile.avatarId ? 'selected' : ''}" style="--avatar-color:${option.color}" data-avatar="${option.id}" aria-label="${escapeAttr(option.label)}" aria-checked="${option.id === state.profile.avatarId}">${option.glyph}</button>`).join('')}</div></section>
              <section class="passport-panel flag-panel"><h2>FLAG</h2><label for="flag-search">Find your country</label><input id="flag-search" type="search" placeholder="Search country or code" autocomplete="off"><div class="flag-list" role="radiogroup" aria-label="Choose country flag">${flags}</div></section>
            </aside>
          </div>
        </section>
      </div>`;

      this.#layer.querySelector('.profile-back')?.addEventListener('click', this.actions.onBack);
      this.#layer.querySelector('.profile-edit-name')?.addEventListener('click', this.actions.onEditName);
      this.#layer.querySelectorAll<HTMLElement>('[data-avatar]').forEach((button) => button.addEventListener('click', () => this.actions.onSetAvatar(button.dataset.avatar ?? '')));
      this.#layer.querySelectorAll<HTMLElement>('[data-flag]').forEach((button) => button.addEventListener('click', () => this.actions.onSetFlag(button.dataset.flag ?? '')));
      this.#layer.querySelectorAll<HTMLElement>('[data-pen]').forEach((button) => button.addEventListener('click', () => this.actions.onEquipPen(button.dataset.pen ?? '')));
      this.#layer.querySelectorAll<HTMLElement>('[data-desk]').forEach((button) => button.addEventListener('click', () => this.actions.onEquipDesk(button.dataset.desk ?? '')));
      this.#layer.querySelector<HTMLInputElement>('#flag-search')?.addEventListener('input', (event) => {
        const query = (event.currentTarget as HTMLInputElement).value.trim().toLowerCase();
        this.#layer.querySelectorAll<HTMLElement>('.flag-option').forEach((option) => {
          option.hidden = Boolean(query) && !(option.dataset.search ?? '').includes(query);
        });
      });
      return;
    }

    if (state.phase === 'settingUpLocal') {
      const onlineBusy = this.#online.status !== 'idle';
      const setupOnline = onlineBusy || this.#friendSetupMode === 'online';
      const room = this.#online.room ?? this.#pendingInvite ?? '';
      const isGuest = this.#online.seat === 'guest' || (onlineBusy && Boolean(this.#pendingInvite));
      this.#layer.innerHTML = `<div class="local-setup-screen">
        <div class="top-bar"><button class="glass-button back-button" type="button">← BACK</button></div>
        <section class="paper local-setup-card" aria-labelledby="local-setup-title">
          <p class="eyebrow">${onlineBusy ? (isGuest ? 'ONLINE FRIEND MATCH · GUEST' : 'ONLINE FRIEND MATCH · HOST') : setupOnline ? 'ONLINE FRIEND MATCH' : 'FRIEND MATCH · LOCAL DESK'}</p>
          <h1 id="local-setup-title">${onlineBusy ? (isGuest ? (room ? `Joining Desk ${escapeText(room)}` : 'Joining Friend’s Desk') : 'Invite a friend') : setupOnline ? 'Play a friend online' : 'Choose your rival'}</h1>
          <div class="match-rules-strip" aria-label="Match features"><strong>BEST OF 3</strong>${setupOnline ? '<span>PRIVATE ROOM</span><span>REMATCH READY</span>' : '<span>SAME DEVICE</span><span>2–4 PLAYERS</span>'}</div>
          <p class="local-player-one"><span>${onlineBusy ? (isGuest ? 'YOU (GUEST) · RED PEN' : 'YOU (HOST) · BLUE PEN') : 'PLAYER 1 · BLUE PEN'}</span><strong>${escapeText(state.player.name)}</strong></p>
          ${onlineBusy ? `<section class="online-room" aria-live="polite">
            <span>${this.#online.status === 'ready' ? 'FRIEND CONNECTED' : this.#online.status === 'error' ? 'CONNECTION PROBLEM' : isGuest ? 'JOINING ROOM' : 'ONLINE INVITE'}</span>
            ${this.#online.status === 'error' ? `
              ${this.#online.error ? `<p class="form-error">${escapeText(this.#online.error)}</p>` : '<p class="form-error">Could not connect to online room.</p>'}
              <div class="online-buttons">
                <button class="paper-button retry-online" type="button">Try again</button>
                <button class="glass-button cancel-online" type="button">Cancel</button>
              </div>
            ` : this.#online.status === 'waiting' && room ? `
              <small class="room-code-label">ROOM CODE</small>
              <strong class="room-code">${escapeText(room)}</strong>
              <p>Send this link to your friend. They only need to open it.</p>
              <div class="online-buttons">
                <button class="paper-button copy-invite" type="button">Copy invite link</button>
                <button class="glass-button cancel-online" type="button">Cancel</button>
              </div>
              <p class="waiting-hint">Waiting for friend to join…</p>
            ` : this.#online.status === 'ready' ? `
              ${room ? `<strong class="room-code">${escapeText(room)}</strong>` : ''}
              <p class="online-loading">Both desks ready! Entering match…</p>
            ` : `
              ${room ? `<strong class="room-code">${escapeText(room)}</strong>` : ''}
              <p class="online-loading">${isGuest ? `Connecting to desk ${escapeText(room)}…` : 'Opening a classroom online…'}</p>
              <div class="online-buttons">
                <button class="glass-button cancel-online" type="button">Cancel</button>
              </div>
            `}
          </section>` : `<div class="friend-mode-grid"><button class="friend-mode ${setupOnline ? '' : 'active'}" data-friend-mode="local" type="button" aria-label="Same-device local match" aria-pressed="${!setupOnline}"><strong>Same-device local</strong><small>2–4 players take turns at this desk</small></button><button class="friend-mode ${setupOnline ? 'active' : ''}" data-friend-mode="online" type="button" aria-label="Online invite — invite link or room code" aria-pressed="${setupOnline}"><strong>Play online</strong><small>Invite link or 6-character room code</small></button></div>
          <form class="local-setup-form" ${setupOnline ? 'hidden' : ''}>
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
          </form><section class="online-choice" ${setupOnline ? '' : 'hidden'}><p>Create a private room and share one link—no account required.</p><div class="online-feature-list"><span>✓ INVITE LINK</span><span>✓ ROOM CODE</span><span>✓ BEST OF 3</span><span>✓ REMATCH</span></div><button class="paper-button primary create-online" type="button">Create invite link <span>→</span></button><form class="join-room-form"><label for="room-code">Or join with a room code</label><div class="input-line"><input id="room-code" maxlength="6" placeholder="ABC234" aria-label="Room code"><button type="submit">JOIN ROOM</button></div></form></section>`}
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
      this.#layer.querySelector('.retry-online')?.addEventListener('click', () => {
        if (room) {
          this.actions.onJoinOnline(room);
        } else {
          this.actions.onCreateOnline();
        }
      });
      this.#layer.querySelector('.cancel-online')?.addEventListener('click', () => {
        if (this.actions.onCancelOnline) {
          this.actions.onCancelOnline();
        } else {
          this.actions.onBack();
        }
      });
      this.#layer.querySelector<HTMLFormElement>('.join-room-form')?.addEventListener('submit', (event) => { event.preventDefault(); const value = this.#layer.querySelector<HTMLInputElement>('#room-code')?.value.trim() ?? ''; if (value) this.actions.onJoinOnline(value); });
      this.#layer.querySelectorAll<HTMLElement>('[data-friend-mode]').forEach((button) => button.addEventListener('click', () => {
        const online = button.dataset.friendMode === 'online';
        this.#friendSetupMode = online ? 'online' : 'local';
        this.#layer.querySelector('.local-setup-form')?.toggleAttribute('hidden', online);
        this.#layer.querySelector('.online-choice')?.toggleAttribute('hidden', !online);
        this.#layer.querySelectorAll('.friend-mode').forEach((item) => {
          const active = item === button;
          item.classList.toggle('active', active);
          item.setAttribute('aria-pressed', String(active));
        });
        const eyebrow = this.#layer.querySelector<HTMLElement>('.local-setup-card > .eyebrow');
        const title = this.#layer.querySelector<HTMLElement>('#local-setup-title');
        const rules = this.#layer.querySelector<HTMLElement>('.match-rules-strip');
        if (eyebrow) eyebrow.textContent = online ? 'ONLINE FRIEND MATCH' : 'FRIEND MATCH · LOCAL DESK';
        if (title) title.textContent = online ? 'Play a friend online' : 'Choose your rival';
        if (rules) rules.innerHTML = online
          ? '<strong>BEST OF 3</strong><span>PRIVATE ROOM</span><span>REMATCH READY</span>'
          : '<strong>BEST OF 3</strong><span>SAME DEVICE</span><span>2–4 PLAYERS</span>';
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
      if (!onlineBusy && !setupOnline) queueMicrotask(() => input?.focus());
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

      const isOnline = Boolean(online);
      const isGuest = isOnline && this.#online.seat === 'guest';
      const isMyTurn = isOnline
        ? (isGuest ? activePlayer === 1 : activePlayer === 0)
        : (local ? true : activePlayer === 0);

      const PEN_COLOR_NAMES = ['blue', 'red', 'green', 'gold'] as const;
      const penColor = PEN_COLOR_NAMES[activePlayer] ?? 'blue';
      const activeName = playerNames[activePlayer] ?? (activePlayer === 0 ? state.player.name : rivalName);
      const paused = state.phase === 'paused';
      const roundLocked = Boolean(this.#roundMessage);

      const defaultTurnTitle = aiTurn
        ? 'RIVAL IS AIMING'
        : practice
          ? 'PRACTICE SHOT'
          : isOnline
            ? (isMyTurn ? 'YOUR TURN' : `${activeName.toUpperCase()}’S TURN`)
            : local
              ? `${activeName.toUpperCase()}’S TURN`
              : 'YOUR TURN';
      const defaultTurnHint = aiTurn
        ? 'Watch the table edge'
        : isOnline
          ? (isMyTurn ? `Grab the ${penColor} pen · pull back · release` : 'Waiting for rival to strike · stay sharp')
          : `Grab the ${penColor} pen · pull back · release`;
      const [actionTitle, actionHint] = arenaStatus(this.#arenaAction, defaultTurnTitle, defaultTurnHint);
      const turnTitle = paused ? 'MATCH PAUSED' : roundLocked ? 'ROUND RESETTING' : actionTitle;
      const turnHint = paused ? 'Return to the game to continue' : roundLocked ? this.#roundMessage! : actionHint;
      const scores = state.match?.score ?? [0, 0];
      const playerScore = scores[0] ?? 0;
      const rivalScore = scores[1] ?? 0;
      const isRivalTurn = isOnline ? !isMyTurn : (local ? false : activePlayer > 0);

      this.#layer.innerHTML = `
        <!-- Match Top Navigation Bar -->
        <header class="match-hud match-top-bar" aria-label="Match controls">
          <div class="match-bar-left">
            <button class="glass-button match-exit" type="button" aria-label="Leave match">
              <span>←</span> EXIT
            </button>
            <span class="match-mode match-mode-badge">${practice ? 'FREE PLAY' : online ? `ONLINE · BEST OF 3 · ${escapeText(this.#online.room ?? '')}` : local ? 'LOCAL FRIEND · BEST OF 3' : 'QUICK MATCH · BEST OF 3'}</span>
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
        <section class="turn-dock desk-turn-sticker ${isRivalTurn ? 'rival-turn' : ''} turn-player-${activePlayer} ${roundLocked ? 'round-locked' : ''}" aria-label="Turn status" aria-live="polite" data-player="${activePlayer}" data-my-turn="${isMyTurn}" data-action="${this.#arenaAction}" data-ready-title="${escapeAttr(defaultTurnTitle)}" data-ready-hint="${escapeAttr(defaultTurnHint)}" data-locked="${paused || roundLocked}">
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
                <span class="competitor-copy"><small>${local ? 'PLAYER 1' : isOnline ? (isGuest ? 'RIVAL (P1)' : 'YOU (P1)') : 'YOU'}</small><strong>${escapeText(playerNames[0] ?? state.player.name)}</strong></span>
                <span class="score-pips" aria-hidden="true">${scorePips(playerScore)}</span>
                <b>${playerScore}</b>
              </div>
              <div class="competitor rival ${activePlayer === 1 ? 'active' : ''}">
                <b>${rivalScore}</b>
                <span class="score-pips" aria-hidden="true">${scorePips(rivalScore)}</span>
                <span class="competitor-copy"><small>${local ? 'PLAYER 2' : isOnline ? (isGuest ? 'YOU (P2)' : 'RIVAL (P2)') : 'RIVAL'}</small><strong>${escapeText(playerNames[1] ?? rivalName)}</strong></span>
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
      const won = winningIndex === (state.match?.localPlayer ?? 0);
      const winnerName = playerNames[winningIndex] ?? state.player.name;
      const isMulti = playerNames.length > 2;
      const reward = state.match?.reward;
      const rewardProgress = reward ? progressForXp(reward.newXp) : null;
      const unlockedLabels = reward?.unlockedIds.map((id) => PENS.find((pen) => pen.id === id)?.label ?? DESKS.find((desk) => desk.id === id)?.label ?? id) ?? [];
      const rewardMarkup = reward?.reason === 'duplicate'
        ? `<p class="no-xp-note">Reward already collected</p>`
        : reward?.eligible && rewardProgress
        ? `<section class="result-reward" aria-label="Match rewards"><div><strong>+${reward.xp} XP</strong><span>${reward.newLevel > reward.previousLevel ? `LEVEL UP · ${reward.newLevel}` : `${rewardProgress.remainingXp} XP TO LEVEL ${rewardProgress.level + 1}`}</span></div><div class="passport-xp"><i style="width:${Math.round(rewardProgress.ratio * 100)}%"></i></div>${unlockedLabels.length ? `<p class="unlock-note">UNLOCKED · ${unlockedLabels.map(escapeText).join(' · ')}</p>` : ''}</section>`
        : reward?.reason ? `<p class="no-xp-note">No XP — ${reward.reason === 'local' ? 'local match' : 'practice match'}</p>` : '';

      this.#layer.innerHTML = `<section class="paper result-card" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <p class="eyebrow">FINAL BELL</p>
        <h1 id="result-title">${isMulti ? `${escapeText(winnerName)} is Champion!` : won ? 'Desk champion!' : 'Rematch?'}</h1>
        <p>${isMulti
          ? playerNames.map((name, i) => `${escapeText(name)}: <strong>${scores[i] ?? 0}</strong>`).join(' · ')
          : `${escapeText(playerNames[0] ?? state.player.name)} <strong>${scores[0] ?? 0} : ${scores[1] ?? 0}</strong> ${escapeText(playerNames[1] ?? 'Player 2')}`
        }</p>
        ${rewardMarkup}
        <div class="result-actions"><button class="paper-button primary rematch" type="button">REMATCH · FLICK AGAIN →</button><button class="text-button result-exit" type="button">Back to classroom</button></div>
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

  setPendingInvite(room: string | null): void {
    this.#pendingInvite = room;
    if (this.#state) this.render(this.#state);
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
    const isMyTurn = dock.dataset.myTurn === 'true';
    dock.classList.toggle(
      'rival-turn',
      !isMyTurn || action === 'aiWaiting' || action === 'aiMoving',
    );
  }

  triggerHit(_intensity: number): void {
    void _intensity;
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
