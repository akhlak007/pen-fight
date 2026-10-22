# Deploy Pen Fight on Render Free + Neon Free

Pen Fight runs as one free Render Node web service. The same process serves the website, account API, leaderboard, and WebSocket match rooms. Player accounts live in a free Neon PostgreSQL database, so they survive Render restarts and deploys.

## 1. Create the free database

1. Sign in at [Neon](https://neon.tech/) and create a project.
2. Open the project's **Connect** panel.
3. Select the pooled connection and copy its `postgresql://...` connection string.
4. Keep this value private. It contains the database password.

The server creates its account tables and indexes automatically on first startup.

## 2. Create the free Render service

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. In Render, select **New > Blueprint**.
3. Connect the repository containing the root `render.yaml` file.
4. When Render asks for `DATABASE_URL`, paste the Neon pooled connection string.
5. Apply the Blueprint and wait for the build and health check to pass.

The Blueprint configures:

- Free Render web-service plan
- Root directory: `game-web`
- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm start`
- Health check: `/health`
- Node.js: `24.21.0`
- Secure same-origin WebSocket rooms at `/ws`
- One service instance

Render supplies `PORT` and public HTTPS automatically. The app issues `Secure`, `HttpOnly`, `SameSite=Lax` account cookies. `DATABASE_URL` is a secret and is not stored in the repository.

## 3. Verify the deployment

1. Open `https://YOUR-SERVICE.onrender.com/health`; it should return `{"ok":true}`.
2. Open the main URL and create an account.
3. Confirm the account appears in **Class Ranking**.
4. Trigger a manual restart or deploy, sign in again, and confirm the account and ranking remain available.
5. Create a friend room and open its invite from another browser or phone.

## Free-tier behavior

Render's free service can spin down while idle, so the first request after a quiet period may take longer. A sleep, restart, or deploy ends active match rooms because rooms are held in server memory. Accounts, profiles, unlocks, and leaderboard rows remain in Neon.

Keep the service at one instance because live rooms are in memory. Monitor the free usage limits in both Render and Neon dashboards. Never publish `DATABASE_URL` or put it in frontend variables such as `VITE_DATABASE_URL`.

## Local development

`npm run dev` uses local SQLite at `game-web/data/pen-fight.sqlite`; no cloud database is required. To exercise PostgreSQL locally, set `DATABASE_URL` before starting the server.

## Custom domain

Add a custom domain from the Render service settings. Render provisions and renews TLS automatically; no application code change is required.
