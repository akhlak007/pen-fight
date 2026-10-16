# Online Invite Match Design

## Summary

Add real two-device Pen Fight matches through shareable invite links while preserving Quick Match, Practice, and same-device Friend play. A lightweight Node.js WebSocket server owns room membership and message relay. The host browser remains authoritative for physics, scoring, and turns; the guest browser sends input intents and renders interpolated host snapshots.

The production server serves the built web application and handles WebSocket connections on the same origin. Development starts the Vite client and room server with one command.

## Goals

- Create a private online room without accounts.
- Generate a short code and full invite URL automatically.
- Let the host copy or share the invite with one action.
- Auto-detect and join the room when the guest opens the URL.
- Ask only for a missing guest name; avoid manual code entry in the normal flow.
- Synchronize turns, shots, physics, falls, scores, and results across two devices.
- Pause safely during disconnection and allow short reconnects.
- Preserve the approved same-device Friend mode and relocated bottom HUD.
- Run client and server locally with one command and deploy them as one process.

## Non-goals

- Public matchmaking, accounts, chat, spectators, tournaments, or more than two seats.
- Persistent rooms or match history.
- Ranked anti-cheat guarantees.
- WebRTC or peer-to-peer transport.
- Server-side Three.js rendering or a second physics implementation.

## Chosen Architecture

Use host-authoritative WebSocket rooms.

- The room server creates rooms, assigns seats, validates envelopes, relays approved message categories, tracks reconnect tokens, and expires inactive rooms.
- The host browser runs the existing scene simulation and is the only authority for pen transforms, physics, turn changes, knockouts, and scores.
- The guest browser renders host snapshots and sends aim/flick intents only while assigned the active seat.
- Shared protocol types and runtime validators keep client and server messages aligned.

This avoids rewriting physics for Node while providing more reliable connectivity and reconnect behavior than WebRTC. It is appropriate for a casual private match; a malicious host can theoretically cheat, which is accepted for this scope.

## User Experience

### Friend menu

The notebook Friend option opens a single friend setup screen with two choices:

- **Same device:** enter Player 2's name and begin local alternating turns.
- **Online invite:** create a private room automatically.

### Hosting

1. The host selects Online Invite.
2. The client connects to the room server and requests a room using the saved player name.
3. The server returns a six-character room code, host reconnect token, and canonical invite URL.
4. The UI shows Copy Invite and Share buttons plus a waiting state.
5. The Share button uses `navigator.share` when available and falls back to copying.
6. When the guest joins, both clients show the two names and a brief ready state.
7. The host starts the authoritative simulation automatically.

### Joining

1. An invite uses `?room=ABC123` on the normal application URL.
2. Opening it detects the room automatically.
3. A returning player with a saved name joins immediately; otherwise the notebook asks for a name and joins after it is saved.
4. No room-code transcription is required. A small manual code field remains as a fallback for links that cannot be opened directly.

### Leaving and reconnecting

- Refreshing reuses a seat-specific reconnect token from `sessionStorage`.
- A disconnected match pauses for both players and displays a reconnect countdown.
- Rejoining within 30 seconds restores the seat and latest authoritative snapshot.
- Explicit leave or timeout closes the room and returns both players to the notebook with a clear message.
- Idle waiting rooms expire after 10 minutes. Completed rooms expire after 2 minutes.

## Server Components

### HTTP application server

The production Node process serves the Vite `dist` directory, falls back to `index.html` for client routes, exposes `/health`, and accepts WebSocket upgrades at `/ws`.

### Room registry

An in-memory registry stores:

- room code and match identifier;
- host and guest display names;
- live socket references;
- hashed reconnect tokens;
- connection and ready state;
- current active seat and last accepted input sequence;
- latest authoritative snapshot;
- creation, activity, disconnect, and expiry timestamps.

No room survives a server restart.

### Message validation

Every inbound frame is limited in bytes, parsed defensively, checked against a discriminated message schema, and validated for room membership, seat, match identifier, monotonic sequence, and allowed direction.

The server rate-limits connection attempts, room creation, join attempts, aim intents, and flick intents. Unknown fields are ignored only where explicitly allowed; malformed or oversized frames receive an error and may close the socket.

## Protocol

All messages use JSON with a protocol version.

Client-to-server categories:

- `createRoom`
- `joinRoom`
- `resumeRoom`
- `clientReady`
- `aimIntent`
- `flickIntent`
- `hostSnapshot`
- `hostEvent`
- `leaveRoom`
- `ping`

Server-to-client categories:

- `roomCreated`
- `roomJoined`
- `peerJoined`
- `matchReady`
- `intentForwarded`
- `snapshot`
- `matchEvent`
- `peerDisconnected`
- `peerReconnected`
- `roomClosed`
- `error`
- `pong`

Every match message includes `version`, `roomCode`, `matchId`, `seat`, and `sequence` as appropriate. Runtime validation functions return typed results and never trust TypeScript types at the network boundary.

## Authoritative Game Synchronization

### Host

The host runs the existing capped-delta scene update. Local host input enters the scene directly. Valid guest intents are applied only when Player 2 is active. The host publishes:

- snapshots at approximately 20 Hz;
- immediate turn, score, round, pause, and result events;
- a full snapshot after join or reconnect.

Snapshots contain both pen positions and quaternions, visibility/fall state, active player, scores, action state, round message, and a monotonic host timestamp.

### Guest

The guest does not advance authoritative physics. It buffers recent snapshots and interpolates pen transforms with a short delay. UI state follows authoritative events and snapshots.

During the guest turn, pointer or keyboard aiming renders a local static guide and power preview. Release sends one normalized flick intent. The guest waits for host acceptance before showing physical motion. Rejected or stale input cancels the preview and restores the authoritative state.

### Drift and recovery

Because only the host simulates physics, clients cannot permanently diverge. Sequence checks discard old snapshots. A reconnect requests the latest full snapshot before input is re-enabled.

## Application State

Add online phases for friend selection, room creation/waiting, joining, ready, active online match, reconnecting, and terminal room error. Network state stays in a dedicated online-session controller rather than being mixed into the persistence service.

Match mode gains `online`. Online match snapshots contain local seat, both names, room code, connection state, score, and current player. Reconnect tokens live only in `sessionStorage`; saved profile name and accessibility settings continue using existing storage.

## Client Modules

- `network/protocol.ts`: shared message types, limits, and validators.
- `network/online-client.ts`: WebSocket lifecycle, sequencing, heartbeat, reconnect, and typed events.
- `network/online-session.ts`: room/user flow and bridge between application state and rendering.
- `rendering/game-renderer.ts`: authoritative/replica mode, snapshot extraction/application, and remote-input hooks.
- `scene/classroom.ts`: active-seat aim preview, authoritative flick application, snapshot serialization, and replica transform application.
- `ui/ui-root.ts`: local/online friend choice, invite waiting/join screens, connection feedback, and online HUD labels.

Server modules remain independent of DOM and Three.js.

## HUD Layout

The approved bottom-center match console applies to Quick, Practice, Local, and Online modes so the blackboard remains unobstructed. Online mode adds a small connection indicator and room code without moving the console back over the board.

The console shows both real player names, scores, active turn, and connection state. On narrow screens, Flick Power moves above the console and status text shortens before names or scores are hidden.

## Error Handling

- Connection failure offers Retry and Back Home.
- Invalid, missing, full, or expired rooms have distinct messages.
- Joining with the same reconnect token restores the prior seat; a different third client is rejected.
- Guest intent received out of turn is rejected without changing the match.
- Host loss pauses the room; if the host does not return before timeout, the room closes.
- Guest loss pauses the authoritative simulation to prevent an unfair turn.
- Server shutdown closes sockets with a retryable reason.

## Accessibility

- All connection statuses use a polite live region; terminal failures use an alert.
- Copy and Share buttons expose success feedback without relying on color.
- Room codes are selectable text with a spelled-out accessible label.
- Name, room-code fallback, Retry, Leave, and Start controls are keyboard accessible.
- Focus moves to the primary next action after each setup transition.

## Development and Deployment

- `npm run dev` starts Vite and the WebSocket room server together.
- Development accepts LAN connections for two-device testing and prints the local network URL.
- `npm run build` builds client and server.
- `npm start` runs one Node process that serves static assets and WebSockets on one port.
- Configuration uses validated environment variables for port, public URL, allowed origins, room TTLs, and reconnect timeout.
- `/health` reports process readiness without exposing room data.

## Testing

Unit tests cover protocol validation, room lifecycle, seat assignment, duplicate/full rooms, sequence rejection, rate limits, expiry, reconnect, local turn behavior, and snapshot serialization.

Integration tests start the room server on an ephemeral port and connect two WebSocket clients to verify create, join, ready, intent relay, snapshot broadcast, disconnect, resume, and close flows.

Playwright uses two isolated browser contexts to verify invite creation, automatic link join, two names, guest turn input, synchronized scores/turns, reconnect UI, and room errors. Existing Quick, Practice, Local, static-aim, responsive HUD, and accessibility tests remain required.

## Security and Privacy

- Room codes are generated with cryptographically secure randomness.
- Reconnect tokens use at least 128 bits of entropy and are compared by hash.
- Display names are length-limited and escaped before rendering.
- Origin allowlisting is configurable and enforced for WebSocket upgrades.
- Rooms store no chat, email, account, or long-term personal data.
- Logs contain room codes and event types but never reconnect tokens.

## Acceptance Criteria

- Two devices can open one invite link and complete a first-to-three match.
- Only the active seat can cause a shot.
- Guest rendering remains smooth under ordinary LAN/internet latency.
- Refresh reconnects to the same seat within the grace period.
- The blackboard remains unobstructed in every match mode.
- Local Friend mode works with the server unavailable.
- One command starts development and one process serves production.
- All unit, integration, browser, type, lint, and production-build checks pass.
