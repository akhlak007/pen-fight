import { parseServerMessage, type ClientMessage, type OutgoingSequencedMessage, type Seat, type ServerMessage } from './protocol';

export interface OnlineState { status: 'idle' | 'connecting' | 'waiting' | 'ready' | 'reconnecting' | 'error'; room?: string; seat?: Seat; players?: readonly [string, string?]; error?: string }

export class OnlineSession extends EventTarget {
  #socket: WebSocket | null = null;
  #state: OnlineState = { status: 'idle' };
  #seq = 0;
  #retry?: number;
  get state(): OnlineState { return this.#state; }
  get connected(): boolean { return this.#socket?.readyState === WebSocket.OPEN; }
  static roomFromUrl(url = location.href): string | null { return new URL(url).searchParams.get('room')?.toUpperCase() ?? null; }
  create(name: string): void { this.#connect({ type: 'create', name }); }
  join(room: string, name: string): void {
    const normalized = room.toUpperCase();
    const stored = sessionStorage.getItem(`pen-fight:${normalized}:host`) ?? sessionStorage.getItem(`pen-fight:${normalized}:guest`);
    this.#connect(stored ? { type: 'resume', room: normalized, token: stored } : { type: 'join', room: normalized, name });
  }
  send(message: OutgoingSequencedMessage): void { if (this.connected) this.#socket!.send(JSON.stringify({ ...message, seq: ++this.#seq })); }
  close(): void { if (this.#retry) clearTimeout(this.#retry); this.#socket?.close(); this.#socket = null; this.#set({ status: 'idle' }); }
  #connect(first: ClientMessage): void {
    this.#socket?.close(); this.#set({ ...this.#state, status: 'connecting', ...('room' in first ? { room: first.room } : {}) });
    const url = new URL('/ws', location.href); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (import.meta.env.DEV && location.port === '4173') url.port = '4174';
    const socket = new WebSocket(url); this.#socket = socket;
    socket.addEventListener('open', () => socket.send(JSON.stringify(first)));
    socket.addEventListener('message', (event) => this.#message(String(event.data)));
    socket.addEventListener('close', () => {
      if (this.#socket !== socket || this.#state.status === 'idle') return;
      const room = this.#state.room; const seat = this.#state.seat;
      const stored = room && seat ? sessionStorage.getItem(`pen-fight:${room}:${seat}`) : null;
      if (!room || !stored) { this.#set({ ...this.#state, status: 'error', error: 'Connection lost. Try the invite again.' }); return; }
      this.#set({ ...this.#state, status: 'reconnecting' });
      this.#retry = window.setTimeout(() => this.#connect({ type: 'resume', room, token: stored }), 800);
    });
  }
  #message(raw: string): void {
    const message = parseServerMessage(raw); if (!message) return;
    if (message.type === 'error') { this.#set({ ...this.#state, status: 'error', error: message.message }); return; }
    if (message.type === 'created') { sessionStorage.setItem(`pen-fight:${message.room}:host`, message.token); this.#set({ status: 'waiting', room: message.room, seat: 'host', players: [''] }); return; }
    if (message.type === 'joined') { sessionStorage.setItem(`pen-fight:${message.room}:${message.seat}`, message.token); this.#set({ status: message.players[1] ? 'ready' : 'waiting', room: message.room, seat: message.seat, players: message.players }); return; }
    if (message.type === 'peer') {
      const players = message.connected && message.name ? [this.#state.players?.[0] ?? '', message.name] as const : this.#state.players;
      this.#set({ ...this.#state, status: message.connected ? 'ready' : 'reconnecting', players });
    }
    this.dispatchEvent(new CustomEvent<ServerMessage>('message', { detail: message }));
  }
  #set(state: OnlineState): void { this.#state = state; this.dispatchEvent(new CustomEvent<OnlineState>('state', { detail: state })); }
}
