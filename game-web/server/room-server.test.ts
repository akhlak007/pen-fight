import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createRoomServer } from './room-server';

const open = (url: string) => new Promise<WebSocket>((resolve) => { const ws = new WebSocket(url); ws.once('open', () => resolve(ws)); });
const next = (ws: WebSocket) => new Promise<Record<string, unknown>>((resolve) => ws.once('message', (data) => resolve(JSON.parse(data.toString()))));

describe('room server', () => {
  const servers: ReturnType<typeof createRoomServer>[] = [];
  afterEach(async () => Promise.all(servers.splice(0).map((server) => server.close())));
  it('creates, joins, relays authorized input, and resumes a seat', async () => {
    const server = createRoomServer({ port: 0 }); servers.push(server); const port = await server.listen();
    const host = await open(`ws://127.0.0.1:${port}/ws`); host.send(JSON.stringify({ type: 'create', name: 'Akhlaq' }));
    const created = await next(host); expect(created.type).toBe('created');
    const guest = await open(`ws://127.0.0.1:${port}/ws`); guest.send(JSON.stringify({ type: 'join', room: created.room, name: 'Priya' }));
    const joined = await next(guest); await next(host); expect(joined.players).toEqual(['Akhlaq', 'Priya']);
    host.send(JSON.stringify({ type: 'state', seq: 1, score: [0, 0], currentPlayer: 1, phase: 'match' })); await next(guest);
    guest.send(JSON.stringify({ type: 'intent', seq: 1, action: 'aim', x: 1, y: 2 })); expect((await next(host)).type).toBe('intent');
    const resumeToken = joined.token; guest.close(); await next(host);
    const resumed = await open(`ws://127.0.0.1:${port}/ws`); resumed.send(JSON.stringify({ type: 'resume', room: created.room, token: resumeToken }));
    expect((await next(resumed)).seat).toBe('guest'); host.close(); resumed.close();
  });
});
