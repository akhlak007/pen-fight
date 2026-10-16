# Pen Fight Local and Online Friend Implementation Plan

## Objective

Finish same-device two-player mode, relocate the match HUD below the blackboard, and add host-authoritative online invite matches backed by a lightweight Node.js WebSocket room server.

## Working Rules

- Preserve current uncommitted gameplay and notebook-home improvements.
- Implement test-first at each boundary.
- Keep Quick Match and Practice behavior unchanged.
- Keep static aiming: pens do not translate or rotate until release.
- Do not require accounts, a database, or manual room-code entry in the normal invite flow.
- Keep local Friend mode usable when the room server is offline.

## Phase 1 — Complete Local Friend Mode and HUD Relocation

1. Finish `MatchMode` and application-state support for `local`.
2. Finish store tests for local setup, Player 2 validation, scoring, result, and rematch.
3. Complete active-player turn-controller tests and implementation.
4. Complete active-pen scene behavior for pickup, aim, flick, cancel, turn ring, and static targeting.
5. Finish the Friend setup UI with Same Device selection and Player 2 name entry.
6. Move the match scoreboard into a bottom-center console containing turn status.
7. Add responsive non-overlap tests for the blackboard, console, and Flick Power.
8. Run all existing unit and browser regressions before networking work.

Exit criteria: two people can complete a local match on one device; Quick and Practice still pass; the blackboard is unobstructed.

## Phase 2 — Shared Online Protocol

1. Add `ws` and the minimal development/process dependencies.
2. Create discriminated client/server message types and shared constants.
3. Write runtime validators for every inbound message and size/length boundary.
4. Add unit tests for valid messages, malformed JSON, oversized values, unknown types, invalid sequences, and unsafe names/codes.
5. Define authoritative arena snapshot and match-event types independent of Three.js classes.

Exit criteria: client and server compile against one protocol and untrusted frames cannot enter typed handlers without validation.

## Phase 3 — Room Server

1. Build an in-memory room registry with cryptographic room codes and reconnect tokens.
2. Implement host creation, guest join, seat assignment, ready state, full-room rejection, explicit leave, and expiry.
3. Implement monotonic sequence checks and direction/seat authorization for intents, snapshots, and events.
4. Add heartbeat, disconnect grace period, resume, and latest-snapshot restoration.
5. Add per-socket and per-room rate limits plus maximum frame size.
6. Expose `/health` and WebSocket `/ws` from a Node HTTP server.
7. Add integration tests using two real WebSocket clients on an ephemeral port.

Exit criteria: server tests prove the complete room lifecycle, unauthorized actions are rejected, and reconnect restores the correct seat.

## Phase 4 — Single-command Development and Production Serving

1. Add a development launcher that starts Vite and the room server together.
2. Allow LAN access in development and report usable client/server URLs.
3. Make the production Node server serve Vite `dist` with SPA fallback and WebSocket upgrades on one origin.
4. Add validated environment configuration for port, public URL, origins, and timeouts.
5. Update `npm run dev`, `npm run build`, and `npm start`.
6. Add startup and `/health` smoke tests.

Exit criteria: one command starts development; one process serves the production app and room transport.

## Phase 5 — Online Client and Session State

1. Implement a typed WebSocket client with connect, send, heartbeat, sequence, retry, close, and resume behavior.
2. Implement an online-session controller for host/join/wait/ready/match/reconnect/error states.
3. Detect `?room=` on boot and route directly into automatic join flow.
4. Store seat reconnect tokens in `sessionStorage` and never persistent profile storage.
5. Add application-store transitions and immutable snapshots for online phases and match metadata.
6. Unit-test URL detection, state transitions, retry, timeout, and token restoration.

Exit criteria: room creation and invite-link joining work without the renderer and recover correctly from simulated disconnects.

## Phase 6 — Authoritative Renderer Bridge

1. Define serializable pen/arena snapshot helpers with unit tests.
2. Add authoritative and replica modes to the renderer/scene boundary.
3. Publish host snapshots at 20 Hz plus immediate turn/score/round/result events.
4. Apply guest snapshots through a small interpolation buffer.
5. Add seat-aware local aim preview for the guest without advancing guest physics.
6. Route guest release as a flick intent; apply motion only after host acceptance.
7. Pause host simulation when either peer disconnects.
8. Add deterministic tests for active-seat authorization, snapshot correction, stale sequence rejection, and reconnect restoration.

Exit criteria: host and guest remain synchronized through full turns, falls, scoring, pause, and resume.

## Phase 7 — Online Invite UI

1. Expand Friend setup into Same Device and Online Invite choices.
2. Build host waiting UI with room code, Copy Invite, Share, cancel, and live status.
3. Build automatic guest join/name UI plus manual-code fallback.
4. Build ready, reconnecting, room-full, expired, host-left, and retry states.
5. Show both names, connection indicator, and room code in the bottom match console.
6. Preserve keyboard focus, live announcements, and readable narrow layouts.
7. Add browser tests for clipboard fallback and all terminal room errors.

Exit criteria: the normal host and guest flow requires only create, share, open link, and optional name entry.

## Phase 8 — End-to-end Verification

1. Run protocol, room-server, store, controller, scene, and storage unit tests.
2. Run strict TypeScript checks for client and server.
3. Run ESLint and production builds.
4. Run existing single-browser Playwright regressions.
5. Run two-context online Playwright tests for create/join, guest input, turn handoff, score sync, disconnect, and reconnect.
6. Visually verify desktop, landscape phone, and narrow portrait layouts.
7. Run an independent code review and fix all Critical and Important findings.

Exit criteria: all automated checks pass, online play works across two browser contexts, the local mode works without networking, and final review approves the change.
