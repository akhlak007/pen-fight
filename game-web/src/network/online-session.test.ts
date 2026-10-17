import { describe, expect, it } from 'vitest';
import { OnlineSession } from './online-session';

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
});
