import { describe, expect, it } from 'vitest';
import { MAX_FRAME_BYTES, parseClientMessage, safeName } from './protocol';

describe('multiplayer protocol', () => {
  it('accepts valid create and aim frames', () => {
    expect(parseClientMessage('{"type":"create","name":"Rafi"}')).toEqual({ type: 'create', name: 'Rafi' });
    expect(parseClientMessage('{"type":"intent","seq":2,"action":"aim","x":1,"y":-2}')).toMatchObject({ type: 'intent', seq: 2 });
  });
  it('rejects malformed, unsafe, oversized, and invalid-code frames', () => {
    expect(parseClientMessage('{')).toBeNull();
    expect(parseClientMessage('{"type":"create","name":"<b>"}')).toBeNull();
    expect(parseClientMessage('{"type":"join","room":"BAD","name":"A"}')).toBeNull();
    expect(parseClientMessage(' '.repeat(MAX_FRAME_BYTES + 1))).toBeNull();
  });
  it('normalizes names for defensive display', () => expect(safeName('  <Akh\u0000lak>  ')).toBe('Akhlak'));
});
