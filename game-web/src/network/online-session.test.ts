import { describe, expect, it } from 'vitest';
import { OnlineSession } from './online-session';
describe('online session', () => it('reads invite codes', () => {
  expect(OnlineSession.roomFromUrl('https://game.test/?room=abc234')).toBe('ABC234');
  expect(OnlineSession.roomFromUrl('https://game.test/')).toBeNull();
}));
