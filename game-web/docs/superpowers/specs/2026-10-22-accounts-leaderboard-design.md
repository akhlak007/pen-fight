# Pen Fight Accounts and Global Leaderboard Design

Date: 2026-10-22

## Objective

Add persistent username-and-password accounts and an all-player global leaderboard to the existing Pen Fight web game. A player can create an account without losing existing local progress, restore that account in another browser, keep profile progress synchronized, and see every registered player ranked by XP and then wins.

## Scope

This project includes:

- Username/password sign-up, sign-in, session restoration, and sign-out.
- Importing the current local profile when an account is first created.
- Persistent server-side player profiles using SQLite.
- Automatic profile synchronization while authenticated.
- A public, paginated all-player leaderboard.
- Account and leaderboard UI that follows the existing classroom-paper visual language and works on mobile.
- Server, client, unit, integration, and browser tests.

This project does not include email verification, password recovery, social login, weekly leaderboards, teams, moderation tools, or fully server-authoritative anti-cheat simulation.

## Architecture

The existing Node HTTP/WebSocket process remains the single application server. Its HTTP handler will route `/api/*` requests before static-file fallback, while the existing `/ws` room service remains unchanged.

Persistence uses Node 24's built-in `node:sqlite` API. The database location is configurable and defaults to a `data/pen-fight.sqlite` file outside the generated `dist` directory. Startup creates missing tables and applies versioned migrations inside transactions.

The server is divided into focused modules:

- `account-database`: schema creation, migrations, and prepared queries.
- `auth-service`: password hashing, credential validation, sessions, and cookies.
- `profile-service`: profile validation, first-time import, and monotonic synchronization.
- `leaderboard-service`: deterministic ordering, global ranks, and pagination.
- `api-router`: request parsing, response formatting, origin checks, body limits, and rate limits.
- `account-client`: browser API calls and normalized client-side errors.

## Data Model

### Players

Each player row stores:

- Stable generated player ID.
- Case-preserving username and a case-folded unique username key.
- Password hash, salt, and hashing parameters.
- Avatar ID and country flag code.
- XP, wins, and matches.
- Selected pen ID and selected desk ID.
- Unlocked cosmetic IDs as validated JSON.
- Awarded match IDs as bounded validated JSON for replay deduplication.
- Creation and last-active timestamps.

Level is derived from XP using the existing progression rules and is not stored independently.

### Sessions

Each session row stores:

- A cryptographic hash of a random bearer token.
- Player ID.
- Creation, last-used, and expiry timestamps.

Only the raw token is sent to the browser, in an HTTP-only cookie. The database never stores the raw session token.

### Migrations

A metadata table records the current schema version. Every migration is ordered, idempotent at its version boundary, and transactional. Startup fails clearly rather than serving with a partially migrated database.

## Authentication

### Credentials

- Usernames are 3–18 characters, case-insensitively unique, trimmed, and limited to safe display characters.
- Passwords are 8–128 characters.
- Passwords are hashed with Node's `crypto.scrypt`, a unique random salt, and constant-time comparison.
- Passwords, hashes, salts, and raw session tokens are never returned by an API.

### Sessions

Successful sign-up or sign-in creates a random session token. The response sets a cookie with `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in production HTTPS. Sessions have a finite lifetime and last-used timestamp. Sign-out deletes the current session and clears the cookie.

Authentication endpoints use per-IP and per-username rate limits. State-changing requests require a same-origin `Origin` header when browsers supply one. Request bodies have small explicit size limits.

## API

All responses use JSON. Errors have a stable machine code and a safe user-facing message.

### `POST /api/auth/signup`

Accepts username, password, and a validated local profile snapshot. Creates the account and session atomically. The supplied profile seeds the account so existing local progress is retained. Duplicate usernames return a conflict without revealing private account details.

### `POST /api/auth/login`

Accepts username and password. Returns the authoritative server profile and creates a session.

### `POST /api/auth/logout`

Deletes the current session and clears its cookie. It is safe to call more than once.

### `GET /api/auth/me`

Returns the authenticated public account and full owned profile, or an unauthenticated result. The client calls this during startup to restore a session.

### `PATCH /api/profile`

Requires authentication. Accepts validated profile fields. Progression is monotonic: XP, wins, and matches cannot decrease. Cosmetic, avatar, flag, pen, and desk identifiers must exist in the game catalogs, and equipped items must be unlocked at the resulting level. Awarded match IDs remain bounded and sanitized.

The endpoint returns the canonical saved profile so the client and server converge after every update.

### `GET /api/leaderboard?offset=0&limit=50`

Public endpoint. Returns the requested rows, total player count, and the authenticated player's rank when applicable. `limit` is capped at 50. Repeated **Load More** requests make every registered player reachable.

Each public row contains rank, username, avatar, flag, XP, derived level, wins, matches, and derived win rate. No credential or session data is exposed.

## Profile Import and Synchronization

Sign-up imports the current sanitized local save. That import occurs only while creating a new account; it cannot overwrite an existing account.

After sign-in, the server profile is authoritative. The client hydrates the existing application store with that profile and writes a safe local cache. While authenticated, profile changes and completed-match rewards trigger `PATCH /api/profile`. Cosmetic selections also synchronize.

If synchronization fails, gameplay continues using the local cache. The UI reports an offline synchronization state and retries after the next profile change or session restoration. It never stores credentials or session tokens in local storage. Signing out preserves the safe local profile cache but stops server synchronization.

Because current matches are client-controlled, progression updates can only be constrained rather than proven. The server validates types, known catalog values, monotonic counters, bounded awarded-match history, and sane per-request growth. Fully cheat-resistant ranking requires a future server-authoritative match project.

## Ranking Rules

The global ordering is deterministic:

1. XP descending.
2. Wins descending when XP is tied.
3. Account creation time ascending when XP and wins are tied.
4. Player ID ascending as the final stable tie-break.

Ranks are calculated across all accounts before pagination, so page boundaries do not restart numbering. Guests can view rankings but do not appear until they create an account.

## User Interface

### Account Panel

The existing **SIGN IN** navigation button opens a paper-style modal with **CREATE ACCOUNT** and **SIGN IN** tabs.

Create Account contains username, password, password confirmation, an explanation that current progress will be imported, validation feedback, and a submission loading state. Sign In contains username and password fields with equivalent loading and error handling.

After authentication, the navigation button displays the username. Its account view shows account status, synchronization status, and **SIGN OUT**. The Player Passport shows an **ONLINE ACCOUNT** badge. An unavailable server produces a clear offline message but never blocks local play.

### Leaderboard

The existing **CLASS RANKING** row opens a full leaderboard instead of its placeholder notice. It includes:

- Total registered players and refresh control.
- The current player's highlighted, pinned rank summary when signed in.
- Ranked rows with avatar, flag, username, level, XP, wins, matches, and win rate.
- Loading, empty, unavailable, retry, and end-of-list states.
- **LOAD MORE** pagination in batches of 50 until all players are visible.

Desktop uses a compact table. Mobile uses two-line cards with no horizontal document overflow, large touch targets, and a scrollable content region. Both screens reuse the existing paper, blue-ink, red-accent, and classroom visual system.

## Error Handling

- Invalid input is rejected both client-side for immediacy and server-side for authority.
- Authentication failures use a generic message.
- Database operations that modify related records use transactions.
- SQLite busy conditions return a retryable service error rather than losing data.
- Malformed JSON, oversized bodies, unsupported methods, expired sessions, and rate limits receive distinct safe error codes.
- UI submissions disable only while active and always recover after failure.
- Leaderboard failure does not affect gameplay or account access.

## Testing

### Unit and server tests

- Schema creation and migration behavior.
- Case-insensitive username uniqueness.
- Password hashing and successful/failed verification.
- Session creation, cookie flags, restoration, expiry, and logout.
- Body limits, origin checks, and rate limiting.
- Local-profile import during sign-up.
- Server-authoritative profile loading during sign-in.
- Monotonic progression and catalog validation.
- Ranking order and every tie-break.
- Pagination with stable global ranks and complete reachability.
- Private fields absent from leaderboard responses.

### Browser tests

- Create an account from an existing local profile.
- Restore the session after reload.
- Sign out and sign back in.
- Show server-backed profile data in the Passport.
- Open the leaderboard as a guest and authenticated player.
- Highlight and pin the current player.
- Load additional pages until every seeded player is visible.
- Display recoverable offline and validation states.
- Prevent horizontal overflow on a 360-pixel-wide viewport.

The full existing unit, online-room, gameplay, physics, profile, and onboarding test suites must continue to pass. The production build and targeted lint checks must pass before handoff.

## Acceptance Criteria

- A new player can create a username/password account and retain existing local progress.
- A returning player can sign in and restore the authoritative server profile.
- Sessions restore after refresh and are removed on sign-out.
- Authenticated progression and cosmetic changes persist across browsers using the same account.
- Any visitor can open the global leaderboard.
- Every registered player is reachable through the ranked list.
- Ranking uses XP, then wins, then account age, with stable rank numbers.
- The current authenticated player is clearly highlighted.
- Account and leaderboard flows remain functional at 360-pixel mobile width.
- Passwords and raw session tokens are never stored in browser local storage or returned by APIs.
