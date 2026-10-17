import { describe, expect, it, vi } from 'vitest';

import { AppStore } from './app-store';
import { attachLifecycle } from './lifecycle';

describe('AppStore', () => {
  it('starts in booting with safe defaults', () => {
    const store = new AppStore();

    expect(store.snapshot.phase).toBe('booting');
    expect(store.snapshot.player.name).toBe('');
    expect(store.snapshot.settings.graphicsProfile).toBe('auto');
    expect(Object.isFrozen(store.snapshot)).toBe(true);
  });

  it('publishes immutable snapshots and supports unsubscribe', () => {
    const store = new AppStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setPlayerName('  Riya  ');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.snapshot.player.name).toBe('Riya');
    expect(Object.isFrozen(store.snapshot.player)).toBe(true);

    unsubscribe();
    store.setPlayerName('Dev');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('rejects illegal phase transitions', () => {
    const store = new AppStore();

    expect(() => store.transition('result')).toThrow(/booting.*result/i);
    expect(store.snapshot.phase).toBe('booting');
  });

  it('opens and exits local friend setup from home', () => {
    const store = new AppStore();
    store.transition('home');
    store.transition('settingUpLocal');
    expect(store.snapshot.phase).toBe('settingUpLocal');
    store.transition('home');
    expect(store.snapshot.phase).toBe('home');
  });

  it('starts a local match with a trimmed second-player name', () => {
    const store = new AppStore();
    store.transition('home');
    store.transition('settingUpLocal');
    store.startLocalMatch('  Priya  ');

    expect(store.snapshot.phase).toBe('match');
    expect(store.snapshot.match).toMatchObject({
      mode: 'local',
      rivalName: 'Priya',
      currentPlayer: 0,
      score: [0, 0],
    });
  });

  it('rejects a blank second-player name without leaving setup', () => {
    const store = new AppStore();
    store.transition('home');
    store.transition('settingUpLocal');

    expect(() => store.startLocalMatch('   ')).toThrow(/second player name/i);
    expect(store.snapshot.phase).toBe('settingUpLocal');
  });

  it('pauses a match while hidden and resumes only visibility pauses', () => {
    const store = new AppStore();
    store.transition('home');
    store.transition('match');

    store.pauseForVisibility();
    expect(store.snapshot.phase).toBe('paused');
    expect(store.snapshot.pauseReason).toBe('visibility');

    store.resumeFromVisibility();
    expect(store.snapshot.phase).toBe('match');

    store.pauseManually();
    store.resumeFromVisibility();
    expect(store.snapshot.phase).toBe('paused');
    expect(store.snapshot.pauseReason).toBe('manual');
  });
});

describe('match rules', () => {
  function readyStore(mode: 'quick' | 'practice'): AppStore {
    const store = new AppStore();
    store.transition('home');
    store.transition('selectingMode');
    store.startMatch(mode);
    return store;
  }

  it('ends a quick match when either player reaches two points', () => {
    const store = readyStore('quick');
    store.recordPoint(0);
    expect(store.snapshot.phase).toBe('match');
    store.recordPoint(0);
    expect(store.snapshot.phase).toBe('result');
    expect(store.snapshot.match?.score).toEqual([2, 0]);
  });

  it('keeps practice mode scoreless', () => {
    const store = readyStore('practice');
    store.recordPoint(0);
    expect(store.snapshot.match?.score).toEqual([0, 0]);
    expect(store.snapshot.phase).toBe('match');
  });

  it('scores local matches and preserves the rival name for a rematch', () => {
    const store = new AppStore();
    store.transition('home');
    store.transition('settingUpLocal');
    store.startLocalMatch('Priya');
    store.recordPoint(1);
    store.recordPoint(1);

    expect(store.snapshot.phase).toBe('result');
    expect(store.snapshot.match?.score).toEqual([0, 2]);
    expect(store.snapshot.match?.rivalName).toBe('Priya');

    store.startMatch('local', 'Priya');
    expect(store.snapshot.match).toMatchObject({ mode: 'local', rivalName: 'Priya', score: [0, 0] });
  });
});

describe('attachLifecycle', () => {
  it('routes document visibility and page lifecycle events', () => {
    const store = new AppStore();
    store.transition('home');
    store.transition('match');
    const handlers = new Map<string, EventListener>();
    const lifecycleTarget = {
      hidden: false,
      addEventListener: vi.fn((name: string, handler: EventListener) => {
        handlers.set(name, handler);
      }),
      removeEventListener: vi.fn((name: string) => {
        handlers.delete(name);
      }),
    };

    const detach = attachLifecycle(store, lifecycleTarget);
    lifecycleTarget.hidden = true;
    handlers.get('visibilitychange')?.(new Event('visibilitychange'));
    expect(store.snapshot.phase).toBe('paused');

    lifecycleTarget.hidden = false;
    handlers.get('visibilitychange')?.(new Event('visibilitychange'));
    expect(store.snapshot.phase).toBe('match');

    handlers.get('pagehide')?.(new Event('pagehide'));
    expect(store.snapshot.phase).toBe('paused');

    detach();
    expect(lifecycleTarget.removeEventListener).toHaveBeenCalledTimes(2);
  });
});
