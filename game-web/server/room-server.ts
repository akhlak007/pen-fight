import { createHash, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import { MAX_FRAME_BYTES, parseClientMessage, type ClientMessage, type Seat, type ServerMessage } from '../src/network/protocol';

interface Peer { socket: WebSocket | null; name: string; tokenHash: string; seq: number; disconnectedAt?: number }
interface Room { code: string; host: Peer; guest?: Peer; touchedAt: number; latestSnapshot?: ServerMessage; latestState?: ServerMessage; currentPlayer: 0 | 1; traffic: number; trafficWindow: number }

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = () => Array.from(randomBytes(6), (byte) => alphabet[byte % alphabet.length]).join('');
const token = () => randomBytes(16).toString('hex');
const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
const send = (socket: WebSocket | null, message: ServerMessage) => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
};

export interface RoomServerOptions { port?: number; host?: string; dist?: string; roomTtlMs?: number; reconnectMs?: number; allowCrossPortOrigin?: boolean }

export function createRoomServer(options: RoomServerOptions = {}): { server: Server; rooms: Map<string, Room>; listen(): Promise<number>; close(): Promise<void> } {
  const rooms = new Map<string, Room>();
  const dist = options.dist ?? join(process.cwd(), 'dist');
  const roomTtl = options.roomTtlMs ?? 30 * 60_000;
  const reconnectMs = options.reconnectMs ?? 30_000;
  const server = createServer((request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    const path = normalize((request.url ?? '/').split('?')[0] ?? '/').replace(/^(\.\.[/\\])+/, '');
    let file = join(dist, path === '/' ? 'index.html' : path);
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
    if (!existsSync(file)) { response.writeHead(404); response.end('Build the app first with npm run build.'); return; }
    const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(readFileSync(file));
  });
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_FRAME_BYTES });
  const alive = new WeakMap<WebSocket, boolean>();
  const peerOf = (room: Room, seat: Seat) => seat === 'host' ? room.host : room.guest;
  const other = (room: Room, seat: Seat) => seat === 'host' ? room.guest : room.host;

  wss.on('connection', (socket, request) => {
    const origin = request.headers.origin;
    if (origin) {
      try {
        const parsed = new URL(origin); const host = request.headers.host ?? '';
        const allowed = options.allowCrossPortOrigin ? parsed.hostname === host.split(':')[0] : parsed.host === host;
        if (!allowed || !['http:', 'https:'].includes(parsed.protocol)) { socket.close(1008, 'Origin not allowed'); return; }
      } catch { socket.close(1008, 'Origin not allowed'); return; }
    }
    alive.set(socket, true);
    socket.on('pong', () => alive.set(socket, true));
    let membership: { room: Room; seat: Seat } | null = null;
    let frames = 0;
    let windowStart = Date.now();
    socket.on('message', (data) => {
      if (Date.now() - windowStart > 1000) { frames = 0; windowStart = Date.now(); }
      if (++frames > 60) { send(socket, { type: 'error', code: 'rate_limited', message: 'Too many messages.' }); return; }
      const message = parseClientMessage(data.toString());
      if (!message) { send(socket, { type: 'error', code: 'bad_message', message: 'Invalid message.' }); return; }
      if (message.type === 'create') {
        if (membership) { send(socket, { type: 'error', code: 'forbidden', message: 'This connection already belongs to a room.' }); return; }
        let roomCode = code(); while (rooms.has(roomCode)) roomCode = code();
        const issuedToken = token();
        const room: Room = { code: roomCode, host: { socket, name: message.name, tokenHash: hashToken(issuedToken), seq: -1 }, touchedAt: Date.now(), currentPlayer: 0, traffic: 0, trafficWindow: Date.now() };
        rooms.set(roomCode, room); membership = { room, seat: 'host' };
        send(socket, { type: 'created', room: roomCode, seat: 'host', token: issuedToken }); return;
      }
      if (message.type === 'join') {
        if (membership) { send(socket, { type: 'error', code: 'forbidden', message: 'This connection already belongs to a room.' }); return; }
        const room = rooms.get(message.room);
        if (!room) { send(socket, { type: 'error', code: 'room_missing', message: 'That room has expired.' }); return; }
        if (!room.host.socket) { send(socket, { type: 'error', code: 'room_missing', message: 'The host is reconnecting. Try this invite again shortly.' }); return; }
        if (room.guest && (!room.guest.disconnectedAt || Date.now() - room.guest.disconnectedAt <= reconnectMs)) { send(socket, { type: 'error', code: 'room_full', message: 'That room already has two players.' }); return; }
        const issuedToken = token(); room.guest = { socket, name: message.name, tokenHash: hashToken(issuedToken), seq: -1 }; room.touchedAt = Date.now(); membership = { room, seat: 'guest' };
        send(socket, { type: 'joined', room: room.code, seat: 'guest', token: issuedToken, players: [room.host.name, room.guest.name] });
        if (room.latestSnapshot) send(socket, room.latestSnapshot);
        if (room.latestState) send(socket, room.latestState);
        send(room.host.socket, { type: 'peer', connected: true, name: room.guest.name }); return;
      }
      if (message.type === 'resume') {
        if (membership) { send(socket, { type: 'error', code: 'forbidden', message: 'This connection already belongs to a room.' }); return; }
        const room = rooms.get(message.room);
        const candidateHash = hashToken(message.token);
        const seat: Seat | null = room?.host.tokenHash === candidateHash ? 'host' : room?.guest?.tokenHash === candidateHash ? 'guest' : null;
        if (!room || !seat) { send(socket, { type: 'error', code: 'room_missing', message: 'This invite can no longer be resumed.' }); return; }
        const peer = peerOf(room, seat)!; const previousSocket = peer.socket; peer.socket = socket; peer.disconnectedAt = undefined; membership = { room, seat }; previousSocket?.close(1000, 'Seat resumed elsewhere');
        const bothConnected = Boolean(room.host.socket && room.guest?.socket);
        send(socket, { type: 'joined', room: room.code, seat, token: message.token, players: bothConnected && room.guest ? [room.host.name, room.guest.name] : [room.host.name] });
        if (room.latestSnapshot) send(socket, room.latestSnapshot); if (room.latestState) send(socket, room.latestState); send(other(room, seat)?.socket ?? null, { type: 'peer', connected: true, name: peer.name }); return;
      }
      if (!membership) { send(socket, { type: 'error', code: 'forbidden', message: 'Join a room first.' }); return; }
      const { room, seat } = membership; const peer = peerOf(room, seat)!;
      if (Date.now() - room.trafficWindow > 1000) { room.traffic = 0; room.trafficWindow = Date.now(); }
      if (++room.traffic > 100) { send(socket, { type: 'error', code: 'rate_limited', message: 'Room traffic is too high.' }); return; }
      if ('seq' in message && message.seq <= peer.seq) return;
      if ('seq' in message) peer.seq = message.seq;
      room.touchedAt = Date.now();
      if ((message.type === 'snapshot' || message.type === 'state') && seat !== 'host') { send(socket, { type: 'error', code: 'forbidden', message: 'Only the host can publish game state.' }); return; }
      if (message.type === 'intent' && seat !== 'guest') { send(socket, { type: 'error', code: 'forbidden', message: 'Only the guest sends remote input.' }); return; }
      if (message.type === 'intent' && room.currentPlayer !== 1) { send(socket, { type: 'error', code: 'forbidden', message: 'It is not the guest turn.' }); return; }
      const relay = message as Extract<ClientMessage, { type: 'ready' | 'intent' | 'snapshot' | 'state' }>;
      const outgoing = relay.type === 'ready' ? { type: 'ready' as const, seat } : relay;
      if (relay.type === 'snapshot') room.latestSnapshot = outgoing as ServerMessage;
      if (relay.type === 'state') { room.latestState = outgoing as ServerMessage; room.currentPlayer = relay.currentPlayer; }
      send(other(room, seat)?.socket ?? null, outgoing as ServerMessage);
    });
    socket.on('close', () => {
      if (!membership) return;
      const { room, seat } = membership; const peer = peerOf(room, seat);
      if (peer && peer.socket === socket) { peer.socket = null; peer.disconnectedAt = Date.now(); send(other(room, seat)?.socket ?? null, { type: 'peer', connected: false, name: peer.name }); }
    });
  });
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (alive.get(socket) === false) { socket.terminate(); continue; }
      alive.set(socket, false); socket.ping();
    }
  }, 15_000); heartbeat.unref();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [roomCode, room] of rooms) {
      const disconnectedTooLong = room.host.disconnectedAt && now - room.host.disconnectedAt > reconnectMs;
      if (room.guest?.disconnectedAt && now - room.guest.disconnectedAt > reconnectMs) { send(room.host.socket, { type: 'error', code: 'room_missing', message: 'Your friend did not reconnect.' }); room.guest = undefined; }
      if (now - room.touchedAt > roomTtl || disconnectedTooLong) { send(room.guest?.socket ?? null, { type: 'error', code: 'room_missing', message: 'The host left the room.' }); room.guest?.socket?.close(1000, 'Room expired'); rooms.delete(roomCode); }
    }
  }, 5_000); cleanup.unref();
  return {
    server, rooms,
    listen: () => new Promise((resolve) => server.listen(options.port ?? 4174, options.host ?? '0.0.0.0', () => resolve((server.address() as { port: number }).port))),
    close: () => new Promise((resolve, reject) => { clearInterval(cleanup); clearInterval(heartbeat); wss.close(); server.close((error) => error ? reject(error) : resolve()); }),
  };
}
