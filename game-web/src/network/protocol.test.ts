import { describe, expect, it } from 'vitest';
import { MAX_FRAME_BYTES, parseClientMessage, parseServerMessage, safeName } from './protocol';

describe('multiplayer protocol', () => {
  it('accepts valid create and aim frames', () => {
    expect(parseClientMessage('{"type":"create","name":"Rafi"}')).toEqual({ type: 'create', name: 'Rafi' });
    expect(parseClientMessage('{"type":"intent","seq":2,"action":"aim","x":1,"y":-2}')).toMatchObject({ type: 'intent', seq: 2 });
    expect(parseClientMessage('{"type":"intent","seq":3,"action":"flick","x":0.4,"y":-0.2,"grab":0.8}')).toMatchObject({ grab: 0.8 });
  });
  it('rejects malformed, unsafe, oversized, and invalid-code frames', () => {
    expect(parseClientMessage('{')).toBeNull();
    expect(parseClientMessage('{"type":"create","name":"<b>"}')).toBeNull();
    expect(parseClientMessage('{"type":"join","room":"BAD","name":"A"}')).toBeNull();
    expect(parseClientMessage(' '.repeat(MAX_FRAME_BYTES + 1))).toBeNull();
    expect(parseClientMessage('{"type":"intent","seq":4,"action":"flick","x":0.4,"y":-0.2,"grab":1.1}')).toBeNull();
  });
  it('accepts safe public cosmetics and rejects malformed metadata', () => {
    const profile = { avatarId: 'ninja', flagCode: 'BD', penId: 'red-comet' };
    expect(parseClientMessage(JSON.stringify({ type: 'create', name: 'Rafi', profile }))).toMatchObject({ profile });
    expect(parseServerMessage(JSON.stringify({ type: 'peer', connected: true, name: 'Rafi', profile }))).toMatchObject({ profile });
    expect(parseClientMessage(JSON.stringify({ type: 'join', room: 'ABC234', name: 'Rafi', profile: { ...profile, penId: '<script>' } }))).toBeNull();
  });
  it('normalizes names for defensive display', () => expect(safeName('  <Akh\u0000lak>  ')).toBe('Akhlak'));
});
