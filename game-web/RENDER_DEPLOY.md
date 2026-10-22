# Deploy Pen Fight on Render

Pen Fight runs as one Render Node web service. The same process serves the built website, account API, SQLite leaderboard, and WebSocket match rooms.

## Before deploying

- Push this repository to GitHub, GitLab, or Bitbucket.
- Use a paid Render web-service plan. Render does not support persistent disks on the free plan.
- Keep the service at one instance. SQLite and active match rooms are local to that instance.

## Create the service

1. In Render, select **New → Blueprint**.
2. Connect the repository containing the root `render.yaml` file.
3. Confirm the `pen-fight` web service and `pen-fight-data` disk.
4. Apply the Blueprint and wait for the build and health check to pass.

The Blueprint configures:

- Root directory: `game-web`
- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm start`
- Health check: `/health`
- Node.js: `24.21.0`
- Persistent SQLite directory: `/var/data`
- Same-origin secure WebSocket rooms (`wss://YOUR-SERVICE.onrender.com/ws`)
- One service instance

Render supplies `PORT` automatically and terminates public HTTPS before forwarding traffic to the Node server. The app still issues `Secure`, `HttpOnly`, `SameSite=Lax` account cookies.

## Verify the deployment

1. Open `https://YOUR-SERVICE.onrender.com/health`. It should return `{"ok":true}`.
2. Open the main URL and create an account.
3. Confirm the account appears in **Class Ranking**.
4. Trigger a manual restart or deploy, sign in again, and confirm the account and ranking remain available.
5. Create an online friend room and open the invite from another browser or phone.

## Persistent data and backups

Accounts and leaderboard data are stored at `/var/data/pen-fight.sqlite`. Only that mounted path survives deploys and restarts. Render takes daily persistent-disk snapshots, but exporting periodic SQLite backups is still recommended before major releases.

The persistent disk disables Render's zero-downtime deploys. A deploy or restart can briefly interrupt the site and ends any match rooms that are currently in memory; saved accounts and leaderboard entries remain intact.

Do not remove the disk or change `DATA_DIR` after players have registered. Do not set `ALLOW_INSECURE_COOKIES=true` on the public deployment.

## Custom domain

Add a custom domain from the Render service settings. Render provisions and renews TLS automatically; no application code change is required.
