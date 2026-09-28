# rotless

Smart pantry web app — *"rot less"* (less food waste). Tracks household food batches and expiry dates, warning members via Telegram before food expires.

## Stack

- **Backend:** PHP 8.3 + Laravel (REST API only, `/api/v1/*`)
- **Frontend:** React + TypeScript + Vite (`frontend/`)
- **Database:** PostgreSQL
- **Infra:** Docker Compose (`app`, `db`, `queue`, `scheduler`)
- **Auth:** Laravel Sanctum (token-based)

## Quick start

```bash
docker compose up -d
docker compose exec app composer install
docker compose exec app php artisan migrate
```

## Deploy

Pushes to `main` that pass CI are deployed to the VPS by
`.github/workflows/deploy.yml`, **after a manual approval** of the
`production` environment in GitHub Actions. The job builds the frontend on the
runner and streams it over SSH to `scripts/deploy.sh`, which on the VPS:

1. builds the PHP images in a separate git worktree, one service at a time
   (the 1 GB e2-micro cannot build them in parallel), while the site keeps
   running;
2. dumps the database to `~/rotless-backups/` (newest 10 kept);
3. checks out the commit, runs pending migrations (additive only), recreates
   the containers, publishes the frontend and restarts `queue`/`scheduler`;
4. checks `GET /api/v1/health`, and on failure puts back the previous commit,
   images and frontend (migrations are never rolled back).

It runs detached from the SSH session and logs to `~/.rotless-deploy/logs/`.
The first install of the stack on the VPS (Docker, `.env`, origin
certificate) is done beforehand. After the setup below, update the code only
through deploys: files copied over the checkout by hand (e.g. with rsync) make
it dirty, and the next deploy refuses to run.

### One-time setup

Order: merge this workflow into `main` first. Its first run waits for
approval; do the steps below, then approve it.

**1. GitHub environment** (only you can approve, only `main` deploys):

```bash
gh api -X PUT repos/krosct/rotless/environments/production --input - <<JSON
{"reviewers":[{"type":"User","id":$(gh api user --jq .id)}],
 "deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}
JSON
gh api -X POST repos/krosct/rotless/environments/production/deployment-branch-policies \
  -f name=main -f type=branch
```

**2. Deploy key**, locked to `scripts/deploy.sh` on the VPS (`restrict` +
`command=`: no shell, no forwarding; the key can only deploy the tip of
`main`):

```bash
ssh-keygen -t ed25519 -N '' -C rotless-github-deploy -f ~/.secrets/rotless-deploy
PUB=$(cat ~/.secrets/rotless-deploy.pub)
ssh rotless-vps "printf 'restrict,command=\"%s/rotless/scripts/deploy.sh\" %s\n' \"\$HOME\" '$PUB' >> ~/.ssh/authorized_keys"
```

**3. Secrets** of the `production` environment. `DEPLOY_HOST` is the VPS IP,
not the Cloudflare domain; keeping it a secret keeps the origin IP masked in
the public Actions logs. The host key is read over your already trusted SSH
connection:

```bash
gh secret set DEPLOY_SSH_KEY --env production < ~/.secrets/rotless-deploy
gh secret set DEPLOY_HOST --env production   # prompts: VPS public IP
gh secret set DEPLOY_USER --env production   # prompts: SSH user on the VPS
ssh rotless-vps 'cat /etc/ssh/ssh_host_ed25519_key.pub' \
  | awk -v h="<VPS IP>" '{print h, $1, $2}' \
  | gh secret set DEPLOY_KNOWN_HOSTS --env production
shred -u ~/.secrets/rotless-deploy   # the private key now lives only in GitHub
```

A non-default SSH port goes in the `DEPLOY_PORT` environment variable (and the
known_hosts line becomes `[<VPS IP>]:<port> ...`). GitHub runners use changing
IPs, so the cloud firewall must allow SSH from anywhere; keep password login
disabled.

**4. Turn the VPS copy into a git checkout** (it came from rsync, without
`.git`). Needs `git` on the VPS. Tracked files take the version on `main`;
`.env`, `certs/`, `frontend/dist` and the database are untouched:

```bash
ssh rotless-vps
cd ~/rotless
git init -q -b main
git remote add origin https://github.com/krosct/rotless.git
git fetch origin main
git reset --hard origin/main
git status --short   # leftovers from rsync show as ?? — review them
```

Keep the directory named `rotless`: Docker Compose derives the database
volume name (`rotless_db-data`) from it, and `deploy.sh` refuses to run if
that volume is missing.

### Manual deploy and rollback

```bash
# -n: no stdin, otherwise deploy.sh waits for a frontend tarball on it
ssh -n rotless-vps 'cd ~/rotless && git fetch -q origin main && ./scripts/deploy.sh $(git rev-parse origin/main)'
```

Without the tarball the frontend is built on the VPS (slow). To undo a
release, `git revert` it on `main` and let it deploy.
