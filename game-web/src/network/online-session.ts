import { MqttRelay } from './mqtt-relay';
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

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join('');
}

function shouldUseLocalWebSocket(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URL(location.href).searchParams;
    if (params.has('relay') || params.has('p2p')) return false;
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
  #relay: MqttRelay | null = null;
  #hostName = '';
  #state: OnlineState = { status: 'idle' };
  #seq = 0;
  #retry?: number;

  get state(): OnlineState {
    return this.#state;
  }

  get connected(): boolean {
    if (this.#socket) return this.#socket.readyState === WebSocket.OPEN;
    if (this.#relay) return this.#relay.connected;
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
      this.#createRelayRoom(name);
    }
  }

  join(room: string, name: string): void {
    const normalized = room.toUpperCase();
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
      this.#joinRelayRoom(normalized, name);
    }
  }

  send(message: OutgoingSequencedMessage): void {
    const payload = JSON.stringify({ ...message, seq: ++this.#seq });
    if (this.#socket?.readyState === WebSocket.OPEN) {
      this.#socket.send(payload);
    } else if (this.#relay && this.#state.room) {
      const targetTopic =
        this.#state.seat === 'host'
          ? `penfight/${this.#state.room}/guest`
          : `penfight/${this.#state.room}/host`;
      this.#relay.publish(targetTopic, payload);
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
    if (this.#relay) {
      if (this.#state.room && this.#state.seat) {
        // Broadcast leave
        const target =
          this.#state.seat === 'host'
            ? `penfight/${this.#state.room}/guest`
            : `penfight/${this.#state.room}/host`;
        this.#relay.publish(target, JSON.stringify({ type: 'peer', connected: false }));
      }
      this.#relay.close();
      this.#relay = null;
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

      // If local dev server is not running, fall back seamlessly to global relay
      if (!opened && !import.meta.env.VITE_WS_URL) {
        this.#socket = null;
        if (first.type === 'create') {
          this.#createRelayRoom(first.name);
        } else if (first.type === 'join') {
          this.#joinRelayRoom(first.room, first.name);
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

  #createRelayRoom(name: string): void {
    this.#cleanup();
    const room = generateRoomCode();
    this.#hostName = safeName(name) || 'Player 1';

    // Instantly show the room code and invite link without waiting for network!
    sessionStorage.setItem(`pen-fight:${room}:host`, 'relay-host');
    this.#set({
      status: 'waiting',
      room,
      seat: 'host',
      players: [this.#hostName],
    });

    const relay = new MqttRelay();
    this.#relay = relay;
    const hostTopic = `penfight/${room}/host`;
    const guestTopic = `penfight/${room}/guest`;

    relay.onConnect = () => {
      relay.subscribe(hostTopic);
    };

    relay.onMessage = (topic, raw) => {
      if (topic !== hostTopic) return;
      try {
        const data = JSON.parse(raw);
        if (data.type === 'join' && typeof data.name === 'string') {
          const guestName = safeName(data.name) || 'Player 2';
          // Send joined acknowledgment to guest
          const joinedMsg: ServerMessage = {
            type: 'joined',
            room,
            seat: 'guest',
            token: 'relay-guest',
            players: [this.#hostName, guestName],
          };
          relay.publish(guestTopic, JSON.stringify(joinedMsg));

          // Set host ready state
          this.#set({
            status: 'ready',
            room,
            seat: 'host',
            players: [this.#hostName, guestName],
          });

          this.dispatchEvent(
            new CustomEvent<ServerMessage>('message', {
              detail: { type: 'peer', connected: true, name: guestName },
            }),
          );
          return;
        }
      } catch {
        // Ignore JSON error
      }

      this.#message(raw);
    };

    relay.onError = (err) => {
      this.#set({
        status: 'error',
        error: err.message || 'Connection error. Check your internet connection.',
      });
    };

    relay.onDisconnect = () => {
      if (this.#state.status === 'ready') {
        this.#set({ ...this.#state, status: 'reconnecting' });
      }
    };

    relay.connect(`pf-h-${room.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`);
  }

  #joinRelayRoom(room: string, name: string): void {
    this.#cleanup();
    const guestName = safeName(name) || 'Player 2';
    this.#set({ status: 'connecting', room });

    const relay = new MqttRelay();
    this.#relay = relay;
    const hostTopic = `penfight/${room}/host`;
    const guestTopic = `penfight/${room}/guest`;

    let joinInterval: number | undefined;

    relay.onConnect = () => {
      relay.subscribe(guestTopic);
      // Send join message to host and retry until acknowledged
      const sendJoin = () => {
        if (this.#state.status !== 'ready') {
          relay.publish(
            hostTopic,
            JSON.stringify({
              type: 'join',
              room,
              name: guestName,
            }),
          );
        }
      };
      sendJoin();
      joinInterval = window.setInterval(sendJoin, 1500);
    };

    relay.onMessage = (topic, raw) => {
      if (topic !== guestTopic) return;
      if (joinInterval) {
        clearInterval(joinInterval);
        joinInterval = undefined;
      }
      this.#message(raw);
    };

    relay.onError = (err) => {
      if (joinInterval) {
        clearInterval(joinInterval);
        joinInterval = undefined;
      }
      this.#set({
        status: 'error',
        error: err.message || 'Could not connect to online room.',
      });
    };

    relay.onDisconnect = () => {
      if (joinInterval) {
        clearInterval(joinInterval);
        joinInterval = undefined;
      }
      if (this.#state.status === 'ready') {
        this.#set({ ...this.#state, status: 'reconnecting' });
      }
    };

    relay.connect(`pf-g-${room.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`);
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
