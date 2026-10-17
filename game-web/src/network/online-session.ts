import { Peer, type DataConnection } from 'peerjs';
import {
  parseServerMessage,
  safeName,
  type ClientMessage,
  type OutgoingSequencedMessage,
  type Seat,
  type ServerMessage,
} from './protocol';

export interface OnlineState {
  status: 'idle' | 'connecting' | 'waiting' | 'ready' | 'reconnecting' | 'error';
  room?: string;
  seat?: Seat;
  players?: readonly [string, string?];
  error?: string;
}

const PEER_CONFIG = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
  },
};

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join('');
}

function shouldUseLocalWebSocket(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (new URL(location.href).searchParams.has('p2p')) return false;
  } catch {
    // Ignore URL parse error
  }
  if (import.meta.env.VITE_WS_URL) return true;
  const hostname = location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function getWebSocketUrl(): URL {
  if (import.meta.env.VITE_WS_URL) {
    return new URL(import.meta.env.VITE_WS_URL);
  }
  const url = new URL('/ws', location.href);
  url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (import.meta.env.DEV && location.port === '4173') url.port = '4174';
  return url;
}

export class OnlineSession extends EventTarget {
  #socket: WebSocket | null = null;
  #peer: Peer | null = null;
  #conn: DataConnection | null = null;
  #hostName = '';
  #state: OnlineState = { status: 'idle' };
  #seq = 0;
  #retry?: number;

  get state(): OnlineState {
    return this.#state;
  }

  get connected(): boolean {
    if (this.#socket) return this.#socket.readyState === WebSocket.OPEN;
    if (this.#conn) return Boolean(this.#conn.open);
    return false;
  }

  static roomFromUrl(url = location.href): string | null {
    try {
      return new URL(url).searchParams.get('room')?.toUpperCase() ?? null;
    } catch {
      return null;
    }
  }

  create(name: string): void {
    if (shouldUseLocalWebSocket()) {
      this.#connectWebSocket({ type: 'create', name });
    } else {
      this.#createP2P(name);
    }
  }

  join(room: string, name: string): void {
    const normalized = room.toUpperCase();
    const isHostStored = Boolean(sessionStorage.getItem(`pen-fight:${normalized}:host`));
    if (isHostStored && !shouldUseLocalWebSocket()) {
      this.#createP2P(name, normalized);
      return;
    }

    if (shouldUseLocalWebSocket()) {
      const stored =
        sessionStorage.getItem(`pen-fight:${normalized}:host`) ??
        sessionStorage.getItem(`pen-fight:${normalized}:guest`);
      this.#connectWebSocket(
        stored
          ? { type: 'resume', room: normalized, token: stored }
          : { type: 'join', room: normalized, name },
      );
    } else {
      this.#joinP2P(normalized, name);
    }
  }

  send(message: OutgoingSequencedMessage): void {
    if (!this.connected) return;
    const payload = JSON.stringify({ ...message, seq: ++this.#seq });
    if (this.#socket?.readyState === WebSocket.OPEN) {
      this.#socket.send(payload);
    } else if (this.#conn?.open) {
      this.#conn.send(payload);
    }
  }

  close(): void {
    this.#cleanup();
    this.#set({ status: 'idle' });
  }

  #cleanup(): void {
    if (this.#retry) {
      clearTimeout(this.#retry);
      this.#retry = undefined;
    }
    if (this.#socket) {
      this.#socket.close();
      this.#socket = null;
    }
    if (this.#conn) {
      this.#conn.close();
      this.#conn = null;
    }
    if (this.#peer) {
      this.#peer.destroy();
      this.#peer = null;
    }
  }

  #connectWebSocket(first: ClientMessage): void {
    this.#cleanup();
    this.#set({
      ...this.#state,
      status: 'connecting',
      ...('room' in first ? { room: first.room } : {}),
    });

    let opened = false;
    const url = getWebSocketUrl();
    const socket = new WebSocket(url);
    this.#socket = socket;

    socket.addEventListener('open', () => {
      opened = true;
      socket.send(JSON.stringify(first));
    });

    socket.addEventListener('message', (event) => {
      this.#message(String(event.data));
    });

    socket.addEventListener('close', () => {
      if (this.#socket !== socket || this.#state.status === 'idle') return;

      // If local dev server is not running, fall back seamlessly to P2P WebRTC
      if (!opened && !import.meta.env.VITE_WS_URL) {
        this.#socket = null;
        if (first.type === 'create') {
          this.#createP2P(first.name);
        } else if (first.type === 'join') {
          this.#joinP2P(first.room, first.name);
        } else if (first.type === 'resume') {
          this.#joinP2P(first.room, 'Player');
        }
        return;
      }

      const room = this.#state.room;
      const seat = this.#state.seat;
      const stored = room && seat ? sessionStorage.getItem(`pen-fight:${room}:${seat}`) : null;
      if (!room || !stored) {
        this.#set({ ...this.#state, status: 'error', error: 'Connection lost. Try the invite again.' });
        return;
      }
      this.#set({ ...this.#state, status: 'reconnecting' });
      this.#retry = window.setTimeout(
        () => this.#connectWebSocket({ type: 'resume', room, token: stored }),
        800,
      );
    });
  }

  #createP2P(name: string, existingRoom?: string, attempt = 0): void {
    this.#cleanup();
    const room = existingRoom ?? generateRoomCode();
    this.#set({ status: 'connecting', room });
    this.#hostName = safeName(name) || 'Player 1';

    try {
      const peerId = `pf-${room.toLowerCase()}`;
      const peer = new Peer(peerId, PEER_CONFIG);
      this.#peer = peer;

      peer.on('open', () => {
        sessionStorage.setItem(`pen-fight:${room}:host`, 'p2p-host');
        this.#set({
          status: 'waiting',
          room,
          seat: 'host',
          players: [this.#hostName],
        });
      });

      peer.on('connection', (conn) => {
        if (this.#conn && this.#conn.open) {
          conn.on('open', () => {
            conn.send(
              JSON.stringify({
                type: 'error',
                code: 'room_full',
                message: 'That room already has two players.',
              }),
            );
            setTimeout(() => conn.close(), 400);
          });
          return;
        }

        this.#conn = conn;

        conn.on('data', (raw) => {
          this.#handleP2PIncoming(conn, String(raw));
        });

        conn.on('close', () => {
          if (this.#conn === conn) {
            this.#conn = null;
            this.#set({ ...this.#state, status: 'reconnecting' });
            this.dispatchEvent(
              new CustomEvent<ServerMessage>('message', {
                detail: { type: 'peer', connected: false },
              }),
            );
          }
        });

        conn.on('error', () => {
          if (this.#conn === conn) {
            this.#conn = null;
            this.#set({ ...this.#state, status: 'reconnecting' });
          }
        });
      });

      peer.on('error', (err: { type?: string; message?: string }) => {
        if (err?.type === 'unavailable-id' && attempt < 3 && !existingRoom) {
          peer.destroy();
          this.#createP2P(name, undefined, attempt + 1);
          return;
        }
        this.#set({
          status: 'error',
          error: err?.message || 'Could not open online room. Check your internet connection.',
        });
      });
    } catch {
      this.#set({
        status: 'error',
        error: 'Failed to start peer connection.',
      });
    }
  }

  #joinP2P(room: string, name: string): void {
    this.#cleanup();
    const normalized = room.toUpperCase();
    this.#set({ status: 'connecting', room: normalized });
    const guestName = safeName(name) || 'Player 2';

    try {
      const peer = new Peer(PEER_CONFIG);
      this.#peer = peer;

      peer.on('open', () => {
        const targetPeerId = `pf-${normalized.toLowerCase()}`;
        const conn = peer.connect(targetPeerId, { reliable: true });
        this.#conn = conn;

        conn.on('open', () => {
          conn.send(
            JSON.stringify({
              type: 'join',
              room: normalized,
              name: guestName,
            }),
          );
        });

        conn.on('data', (raw) => {
          this.#handleP2PIncoming(conn, String(raw));
        });

        conn.on('close', () => {
          this.#set({ status: 'error', error: 'Host disconnected from match.' });
        });

        conn.on('error', () => {
          this.#set({ status: 'error', error: 'Connection to host lost.' });
        });
      });

      peer.on('error', (err: { type?: string; message?: string }) => {
        if (err?.type === 'peer-unavailable') {
          this.#set({
            status: 'error',
            error: 'Room not found. Check the code or ask your friend to create a new room.',
          });
        } else {
          this.#set({
            status: 'error',
            error: err?.message || 'Could not connect to online room.',
          });
        }
      });
    } catch {
      this.#set({
        status: 'error',
        error: 'Failed to connect to online room.',
      });
    }
  }

  #handleP2PIncoming(conn: DataConnection, raw: string): void {
    try {
      const data = JSON.parse(raw) as Record<string, unknown>;
      if (this.#state.seat === 'host' && data.type === 'join' && typeof data.name === 'string') {
        const guestName = safeName(data.name) || 'Guest';
        const hostName = this.#hostName || this.#state.players?.[0] || 'Host';
        const room = this.#state.room!;

        const joinedMsg: ServerMessage = {
          type: 'joined',
          room,
          seat: 'guest',
          token: 'p2p-guest-token',
          players: [hostName, guestName],
        };
        conn.send(JSON.stringify(joinedMsg));

        this.#set({
          status: 'ready',
          room,
          seat: 'host',
          players: [hostName, guestName],
        });

        this.dispatchEvent(
          new CustomEvent<ServerMessage>('message', {
            detail: { type: 'peer', connected: true, name: guestName },
          }),
        );
        return;
      }
    } catch {
      // Ignore parse failure
    }

    this.#message(raw);
  }

  #message(raw: string): void {
    const message = parseServerMessage(raw);
    if (!message) return;
    if (message.type === 'error') {
      this.#set({ ...this.#state, status: 'error', error: message.message });
      return;
    }
    if (message.type === 'created') {
      sessionStorage.setItem(`pen-fight:${message.room}:host`, message.token);
      this.#set({ status: 'waiting', room: message.room, seat: 'host', players: [''] });
      return;
    }
    if (message.type === 'joined') {
      sessionStorage.setItem(`pen-fight:${message.room}:${message.seat}`, message.token);
      this.#set({
        status: message.players[1] ? 'ready' : 'waiting',
        room: message.room,
        seat: message.seat,
        players: message.players,
      });
      return;
    }
    if (message.type === 'peer') {
      const players =
        message.connected && message.name
          ? ([this.#state.players?.[0] ?? '', message.name] as const)
          : this.#state.players;
      this.#set({ ...this.#state, status: message.connected ? 'ready' : 'reconnecting', players });
    }
    this.dispatchEvent(new CustomEvent<ServerMessage>('message', { detail: message }));
  }

  #set(state: OnlineState): void {
    this.#state = state;
    this.dispatchEvent(new CustomEvent<OnlineState>('state', { detail: state }));
  }
}
