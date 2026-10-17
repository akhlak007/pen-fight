export const MAX_FRAME_BYTES = 16_384;
export const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export type Seat = 'host' | 'guest';
export type ArenaPhase = 'player' | 'playerMoving' | 'aiWaiting' | 'aiMoving' | 'falling';

export interface PenState {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly angle: number;
  readonly rotationX: number;
  readonly rotationZ: number;
  readonly velocityX: number;
  readonly velocityZ: number;
  readonly angularVelocity: number;
}

export interface ArenaSnapshot {
  readonly seq: number;
  readonly pens: readonly [PenState, PenState];
  readonly score: readonly [number, number];
  readonly currentPlayer: 0 | 1;
  readonly phase: ArenaPhase;
}

export type ClientMessage =
  | { readonly type: 'create'; readonly name: string }
  | { readonly type: 'join'; readonly room: string; readonly name: string }
  | { readonly type: 'resume'; readonly room: string; readonly token: string }
  | { readonly type: 'ready'; readonly seq: number }
  | { readonly type: 'intent'; readonly seq: number; readonly action: 'aim' | 'flick' | 'cancel'; readonly x?: number; readonly y?: number }
  | { readonly type: 'snapshot'; readonly seq: number; readonly arena: ArenaSnapshot }
  | { readonly type: 'state'; readonly seq: number; readonly score: readonly [number, number]; readonly currentPlayer: 0 | 1; readonly phase: 'match' | 'result' };
export type SequencedClientMessage = Exclude<ClientMessage, { type: 'create' | 'join' | 'resume' }>;
export type OutgoingSequencedMessage = SequencedClientMessage extends infer Message ? Message extends { seq: number } ? Omit<Message, 'seq'> : never : never;

export type ServerMessage =
  | { readonly type: 'created'; readonly room: string; readonly seat: Seat; readonly token: string }
  | { readonly type: 'joined'; readonly room: string; readonly seat: Seat; readonly token: string; readonly players: readonly [string, string?] }
  | { readonly type: 'peer'; readonly connected: boolean; readonly name?: string }
  | { readonly type: 'ready'; readonly seat: Seat }
  | { readonly type: 'intent'; readonly seq: number; readonly action: 'aim' | 'flick' | 'cancel'; readonly x?: number; readonly y?: number }
  | { readonly type: 'snapshot'; readonly seq: number; readonly arena: ArenaSnapshot }
  | { readonly type: 'state'; readonly seq: number; readonly score: readonly [number, number]; readonly currentPlayer: 0 | 1; readonly phase: 'match' | 'result' }
  | { readonly type: 'error'; readonly code: 'bad_message' | 'room_missing' | 'room_full' | 'forbidden' | 'rate_limited'; readonly message: string };

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
const seq = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 100;
const score = (value: unknown): value is [number, number] => Array.isArray(value) && value.length === 2 && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 3);

export function safeName(value: string): string {
  return Array.from(value).filter((character) => { const point = character.codePointAt(0) ?? 0; return point > 31 && point !== 127 && character !== '<' && character !== '>'; }).join('').trim().slice(0, 18);
}

export function parseClientMessage(raw: string): ClientMessage | null {
  if (new TextEncoder().encode(raw).byteLength > MAX_FRAME_BYTES) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!object(value) || typeof value.type !== 'string') return null;
  switch (value.type) {
    case 'create': return text(value.name, 18) && safeName(value.name as string) === (value.name as string).trim() ? { type: 'create', name: (value.name as string).trim() } : null;
    case 'join': return text(value.name, 18) && typeof value.room === 'string' && ROOM_CODE_PATTERN.test(value.room) ? { type: 'join', room: value.room, name: (value.name as string).trim() } : null;
    case 'resume': return typeof value.room === 'string' && ROOM_CODE_PATTERN.test(value.room) && text(value.token, 128) ? { type: 'resume', room: value.room, token: value.token as string } : null;
    case 'ready': return seq(value.seq) ? { type: 'ready', seq: value.seq as number } : null;
    case 'intent':
      if (!seq(value.seq) || !['aim', 'flick', 'cancel'].includes(String(value.action))) return null;
      if (value.action === 'aim' && (!finite(value.x) || !finite(value.y))) return null;
      return { type: 'intent', seq: value.seq as number, action: value.action as 'aim' | 'flick' | 'cancel', ...(finite(value.x) ? { x: value.x as number } : {}), ...(finite(value.y) ? { y: value.y as number } : {}) };
    case 'snapshot': return seq(value.seq) && validArena(value.arena) ? { type: 'snapshot', seq: value.seq as number, arena: value.arena } : null;
    case 'state': return seq(value.seq) && score(value.score) && (value.currentPlayer === 0 || value.currentPlayer === 1) && (value.phase === 'match' || value.phase === 'result') ? { type: 'state', seq: value.seq as number, score: value.score, currentPlayer: value.currentPlayer, phase: value.phase } : null;
    default: return null;
  }
}

function validArena(value: unknown): value is ArenaSnapshot {
  if (!object(value) || !seq(value.seq) || !score(value.score) || (value.currentPlayer !== 0 && value.currentPlayer !== 1) || !['player', 'playerMoving', 'aiWaiting', 'aiMoving', 'falling'].includes(String(value.phase)) || !Array.isArray(value.pens) || value.pens.length !== 2) return false;
  return value.pens.every((pen) => object(pen) && finite(pen.x) && finite(pen.y) && finite(pen.z) && finite(pen.angle) && finite(pen.rotationX) && finite(pen.rotationZ) && finite(pen.velocityX) && finite(pen.velocityZ) && finite(pen.angularVelocity));
}

export function parseServerMessage(raw: string): ServerMessage | null {
  if (new TextEncoder().encode(raw).byteLength > MAX_FRAME_BYTES) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!object(value) || typeof value.type !== 'string') return null;
    switch (value.type) {
      case 'created': return typeof value.room === 'string' && ROOM_CODE_PATTERN.test(value.room) && value.seat === 'host' && text(value.token, 128) ? value as unknown as ServerMessage : null;
      case 'joined': return typeof value.room === 'string' && ROOM_CODE_PATTERN.test(value.room) && (value.seat === 'host' || value.seat === 'guest') && text(value.token, 128) && Array.isArray(value.players) && value.players.length >= 1 && value.players.length <= 2 && text(value.players[0], 18) && (value.players[1] === undefined || text(value.players[1], 18)) ? value as unknown as ServerMessage : null;
      case 'peer': return typeof value.connected === 'boolean' && (value.name === undefined || text(value.name, 18)) ? value as unknown as ServerMessage : null;
      case 'ready': return value.seat === 'host' || value.seat === 'guest' ? value as unknown as ServerMessage : null;
      case 'intent': return parseClientMessage(raw)?.type === 'intent' ? value as unknown as ServerMessage : null;
      case 'snapshot': return seq(value.seq) && validArena(value.arena) ? value as unknown as ServerMessage : null;
      case 'state': return seq(value.seq) && score(value.score) && (value.currentPlayer === 0 || value.currentPlayer === 1) && (value.phase === 'match' || value.phase === 'result') ? value as unknown as ServerMessage : null;
      case 'error': return ['bad_message', 'room_missing', 'room_full', 'forbidden', 'rate_limited'].includes(String(value.code)) && text(value.message, 200) ? value as unknown as ServerMessage : null;
      default: return null;
    }
  } catch { return null; }
}
