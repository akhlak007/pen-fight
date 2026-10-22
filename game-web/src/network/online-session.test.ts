import { describe, expect, it } from 'vitest';
import { failedWebSocketAction, OnlineSession, shouldUseWebSocket } from './online-session';

describe('online session', () => {
  it('reads invite codes', () => {
    expect(OnlineSession.roomFromUrl('https://game.test/?room=abc234')).toBe('ABC234');
    expect(OnlineSession.roomFromUrl('https://game.test/')).toBeNull();
    expect(OnlineSession.roomFromUrl('not-a-valid-url')).toBeNull();
  });

  it('starts with idle state', () => {
    const session = new OnlineSession();
    expect(session.state).toEqual({ status: 'idle' });
    expect(session.connected).toBe(false);
    session.close();
    expect(session.state).toEqual({ status: 'idle' });
  });

  it('uses the same-origin WebSocket server when the deployment enables it', () => {
    expect(shouldUseWebSocket('https://pen-fight.onrender.com/', '', true)).toBe(true);
    expect(shouldUseWebSocket('https://pen-fight.onrender.com/?relay=1', '', true)).toBe(false);
    expect(shouldUseWebSocket('https://static.example/', '', false)).toBe(false);
    expect(failedWebSocketAction('create', '', true)).toBe('retry');
    expect(failedWebSocketAction('join', '', true)).toBe('retry');
    expect(failedWebSocketAction('resume', '', true)).toBe('retry');
    expect(failedWebSocketAction('create', '', false)).toBe('relay');
  });
});
