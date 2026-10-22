# Render Free + Neon Account Persistence Design

Date: 2026-10-22
Status: Proposed

## Goal

Run Pen Fight on Render's free web-service plan without losing registered accounts or leaderboard data when Render sleeps, restarts, or redeploys the service.

## Constraints

- Render Free has an ephemeral filesystem and cannot attach a persistent disk.
- Render Free sleeps after inactivity, so the first request after sleep can take about one minute.
- Live room state is held in memory and can end during a sleep, restart, or deploy.
- Player accounts, profiles, sessions, and rankings must survive those events.
- Local development must remain usable without requiring a cloud database.
- Existing HTTP endpoints and browser UI must remain compatible.

## Architecture

The application will support two account-store implementations behind one asynchronous interface:

1. `SqliteAccountStore` for local development and isolated tests. It retains the current `data/pen-fight.sqlite` behavior.
2. `PostgresAccountStore` for hosted production. It connects to Neon using `DATABASE_URL`.

The Node server will select Postgres whenever `DATABASE_URL` is present. A production start without `DATABASE_URL` will fail immediately with a clear configuration error instead of silently writing accounts to Render's temporary filesystem.

Render will continue serving the Vite build, account API, health endpoint, and same-origin WebSocket rooms from one free Node service. Neon stores only durable account data; active match-room state remains in the Render process.

## Database and Migrations

Postgres will contain the existing logical tables:

- `schema_meta`
- `players`
- `sessions`

The schema retains case-insensitive username uniqueness through a normalized `username_key`, hashed passwords, hashed session tokens, profile data, replay-protection IDs, timestamps, and the XP/wins ranking indexes.

Startup will acquire a Postgres advisory lock before checking or applying migrations. Version 1 creates the tables, constraints, foreign keys, and leaderboard indexes transactionally. Unknown future versions or incomplete schemas fail startup safely.

The existing SQLite file is not automatically uploaded to Neon. There is no hosted production player data yet, so automatic cross-database migration is outside this change.

## Server and API Data Flow

Account-store methods become asynchronous. The API router will await session lookup, signup, login, logout, profile updates, and leaderboard reads. Password hashing and validation rules remain unchanged.

Server startup completes database initialization before binding the public port. `/health` performs a lightweight schema query against the selected database and returns `503` if the database is unavailable.

On shutdown, the server terminates active WebSockets, closes HTTP, and closes the selected database connection pool.

## Render Blueprint

`render.yaml` will change to:

- `plan: free`
- one instance
- no persistent disk
- `DATABASE_URL` as a secret value entered during Blueprint creation
- Node 24
- production build and start commands
- `/health` health check
- `VITE_WS_MODE=server`

`DATA_DIR` will be removed from the hosted configuration but remain supported for local SQLite use.

## Neon Setup

The deployment guide will instruct the user to:

1. Create a free Neon project.
2. Copy its pooled Postgres connection string.
3. Create the Render Blueprint.
4. Paste the connection string into the prompted `DATABASE_URL` secret.
5. Verify `/health`, create an account, restart Render, and confirm the leaderboard persists.

The database URL will never be committed to Git.

## Failure Handling

- Missing `DATABASE_URL` in production: startup fails with an actionable log message.
- Neon temporarily unavailable: startup or health check fails; Render retries/restarts according to its health policy.
- Database request fails after startup: the API returns a safe server error without exposing credentials or SQL.
- Render sleeps or restarts: account data persists in Neon; open match rooms end and clients keep retrying the same-origin WebSocket.
- Free-tier limits are exceeded: the app surfaces service/database unavailability; it does not fall back to ephemeral production SQLite.

## Testing

- Shared contract tests will run against the SQLite implementation.
- Postgres store tests will use an in-memory Postgres-compatible test adapter, covering signup, case-insensitive uniqueness, authentication, profile monotonicity, replay protection, sessions, and ranking.
- Runtime tests will verify that `DATABASE_URL` selects Postgres and production rejects missing configuration.
- API tests will run against the asynchronous store boundary.
- Deployment tests will verify durable data across server/store restarts.
- Existing account, leaderboard, online friend, mobile, physics, and responsive tests must remain green.

## Success Criteria

- The Blueprint can be created on Render's free web-service plan without a disk.
- Production never stores accounts on Render's ephemeral filesystem.
- Accounts and leaderboard data survive Render restarts and deploys.
- Same-origin WebSocket matches work while the free service is awake and reconnect after temporary downtime.
- Local development continues to work with SQLite when no `DATABASE_URL` is configured.
