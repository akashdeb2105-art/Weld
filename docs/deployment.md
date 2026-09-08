# WELD — Deployment Plan

**Status:** DRAFT — awaiting owner sign-off. Nothing is pushed or deployed until this is approved.
**Target:** first real production deployment. There is currently no live URL, no `netlify.toml`, no `render.yaml`.
**Author:** handoff agent · drafted 2026-09-08

---

## 1. Topology

```
                     ┌────────────────────────────┐
   visitors ───────► │  Netlify (frontend)        │   Next.js 15 SSR
                     │  weld.netlify.app          │   @netlify/plugin-nextjs
                     └──────────────┬─────────────┘
                                    │  server-side fetch only
                                    │  (WELD_API_URL, never in client bundle)
                                    ▼
                     ┌────────────────────────────┐
                     │  Render (backend)          │   FastAPI + uvicorn
                     │  weld-api.onrender.com     │   free web service
                     └──────────────┬─────────────┘
                                    │  DATABASE_URL (psycopg, sslmode=require)
                                    ▼
                     ┌────────────────────────────┐
                     │  Neon (Postgres)           │   free tier, scale-to-zero
                     │  ep-xxx.aws.neon.tech      │
                     └────────────────────────────┘
```

- **Frontend → Netlify.** Next.js App Router, all top-level routes are `force-dynamic` (SSR). The browser never talks to the API directly; `src/lib/api.ts` (reads) and `src/app/actions.ts` (writes) run on the Next server using `WELD_API_URL`.
- **Backend → Render.** Persistent Python process, runs Alembic migrations + serves the API. Cannot go on Netlify (long-running process, background work, migrations).
- **DB → Neon.** Managed Postgres, generous free tier, no card required.

---

## 2. Pre-deploy fixes to land first (on `chore/baseline-cleanup`, before any deploy)

These are small and must be in before wiring hosts, because the deploy config depends on them.

| # | Fix | Why it blocks deploy |
|---|-----|----------------------|
| P1 | **`WELD_SITE_URL` name drift.** `frontend/src/app/layout.tsx` reads `process.env.WELD_SITE_URL` for `metadataBase` (absolute OG image URLs). But `.env.example` and `docker-compose.yml` set `NEXT_PUBLIC_SITE_URL`, which nothing reads. Align both on `WELD_SITE_URL`. | Without it, every production OG share card points at `http://localhost:3000` — the M6 "real OG image" feature is silently broken in prod. |
| P2 | **Add `.nvmrc` = `20`.** No Node version is pinned; CI uses 20, local built on 24, Netlify would pick its own default. | Reproducible Netlify builds. |
| P3 | **Pin Python 3.12 for Render** via `backend/runtime.txt` (`python-3.12.10`). `pyproject.toml` already requires `>=3.12`; the local venv has drifted to 3.14. | Render must build on the version the app is tested against. |
| P4 | **Add `netlify.toml` and `render.yaml`** (§3, §4). | The configs themselves. |
| P5 | *(optional, recommend yes)* **Gitignore `frontend/public/sample-game/`.** Now that the copy script works and Netlify runs the root `npm run build` (which builds the sample game then copies it), the committed copy is a stale-artifact foot-gun — it's what masked the copy-path bug. | Not blocking; removes a class of bug. Owner can veto. |

Low-priority, **not** blocking (track separately): `@app.on_event("startup")` → lifespan handler (deprecation noise only); landing page could be static/ISR instead of `force-dynamic` to cut Netlify function invocations (post-deploy tuning); API CORS allows only `GET`/`POST` (harmless today — all API calls are server-to-server — but would bite a future browser-direct call).

---

## 3. Frontend — Netlify

### 3.1 `netlify.toml` (repo root)

```toml
[build]
  command = "npm run build"
  # @netlify/plugin-nextjs manages the publish directory; do not set `publish`.

[build.environment]
  NODE_VERSION = "20"
  NEXT_TELEMETRY_DISABLED = "1"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

- **Base directory:** repo root (monorepo). Netlify installs all workspaces, then `npm run build` runs `@weld/gamebible` → `@weld/sample-game` → `@weld/web` (the root script order), so the embedded game is built and copied before `next build`.
- **`output: 'standalone'`** is now gated on `DOCKER_BUILD=true` (fixed in `06b0277`), so Netlify gets the default Next output its runtime expects. Nothing to change.
- **Plugin:** Netlify auto-detects Next.js and adds `@netlify/plugin-nextjs`; declaring it in `netlify.toml` pins it explicitly.

### 3.2 Netlify environment variables

Set in **Site settings → Environment variables** (not in `netlify.toml` — keep them out of the repo even though these two aren't secret):

| Variable | Value | Notes |
|----------|-------|-------|
| `WELD_API_URL` | `https://weld-api.onrender.com` | The Render service URL. Server-side only; never exposed to the browser. No trailing slash. |
| `WELD_SITE_URL` | `https://weld.netlify.app` (or the custom domain) | Used for absolute OG/canonical URLs. Update if a custom domain is added. |
| `NODE_VERSION` | `20` | Redundant with `netlify.toml` but explicit. |

No LLM keys on the frontend — the Director runs entirely on the backend.

### 3.3 How deploys trigger

**Chosen model: CI-gated.** Netlify's own GitHub auto-build is **disabled**; the only path to production is the GitHub Actions `deploy` job, which runs *after* `quality` (lint + typecheck + unit + build + e2e) passes on `main`.

- In Netlify: **Site settings → Build & deploy → Continuous deployment → Build settings → "Stop builds"** (or set to "Deploy previews only" and turn off production branch auto-deploy).
- CI calls a **Netlify build hook** (`NETLIFY_BUILD_HOOK`, a repo secret) via `curl -X POST`, or `netlify deploy --prod --build` with `NETLIFY_AUTH_TOKEN` + `NETLIFY_SITE_ID`. Build-hook is simpler; CLI gives deploy output in the CI log. Recommend the **build hook**.
- **Deploy previews on PRs** stay on (they don't publish to prod) so reviewers see the branch live. These count against build minutes — see §6.

---

## 4. Backend — Render

### 4.1 `render.yaml` (repo root — Render Blueprint)

```yaml
services:
  - type: web
    name: weld-api
    runtime: python
    plan: free
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    # Free tier has no pre-deploy hook, so migrations run in the start command.
    # They are idempotent (Alembic tracks alembic_version); on a paid plan move
    # `alembic upgrade head` to `preDeployCommand` and leave start as uvicorn only.
    startCommand: alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /health
    autoDeploy: false          # CI is the only path to prod
    envVars:
      - key: PYTHON_VERSION
        value: 3.12.10
      - key: ENVIRONMENT
        value: production
      - key: LOG_LEVEL
        value: INFO
      - key: CORS_ORIGINS
        sync: false            # set in dashboard: the Netlify origin(s)
      - key: DATABASE_URL
        sync: false            # set in dashboard: the Neon URL (secret)
      - key: DIRECTOR_TIMEOUT_SECONDS
        value: "25"            # was 60; keeps a flaky provider from stalling a request
      - key: FIREWORKS_API_KEY
        sync: false
      - key: GEMINI_API_KEY
        sync: false
      - key: OPENROUTER_API_KEY
        sync: false
```

- **`rootDir: backend`** so `requirements.txt`, `alembic.ini`, and `app/` resolve without path juggling. `backend/requirements.txt` is the single runtime-dep source of truth (added in `5f0dced`).
- **Start command** runs `alembic upgrade head` first. `backend/alembic/env.py` reads `DATABASE_URL` from the environment ("always wins"), so no `alembic.ini` edit is needed. `app/main.py`'s startup `create_all` is a harmless no-op once migrations have run.
- **Health check:** Render pings `/health`; the route returns `{"status":"ok","environment":"production"}`. Render restarts the instance if it stops answering.
- **`autoDeploy: false`:** deploys only via the Render **Deploy Hook** (`RENDER_DEPLOY_HOOK`, a repo secret) called from CI.

### 4.2 First deploy — migration behaviour

1. Neon DB is empty.
2. `alembic upgrade head` applies `0001_projects_game_bibles_jobs` → `0002_bugs` → `0003_publish` and creates `alembic_version`.
3. uvicorn starts; `app/main.py` startup seeds the deterministic `scrap-sprint` sample (idempotent — safe on every boot).
4. `/health` goes green; Render marks the deploy live.

Every subsequent deploy re-runs `alembic upgrade head` (a no-op when there's nothing new). New migrations ship automatically with the deploy that contains them.

### 4.3 Backend environment variables

| Variable | Secret? | Per-env? | Value / example |
|----------|:-------:|:--------:|-----------------|
| `DATABASE_URL` | **yes** | yes | `postgresql+psycopg://USER:PASS@ep-xxx.us-east-1.aws.neon.tech/weld?sslmode=require` |
| `CORS_ORIGINS` | no | yes | `https://weld.netlify.app` (comma-separate if a custom domain is added) |
| `ENVIRONMENT` | no | yes | `production` |
| `LOG_LEVEL` | no | no | `INFO` |
| `DIRECTOR_TIMEOUT_SECONDS` | no | no | `25` |
| `FIREWORKS_API_KEY` | **yes** | yes | *(optional; from owner)* |
| `GEMINI_API_KEY` | **yes** | yes | *(optional; from owner)* |
| `OPENROUTER_API_KEY` | **yes** | yes | *(optional; from owner)* |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | **yes** | yes | *(optional generic OpenAI-compatible override, tried first if set)* |

> **If no LLM key is set, the Director runs its honest deterministic offline composer and labels output `offline_draft`.** That is a legitimate production mode, but it must be a *deliberate* choice — decide with the owner before go-live, don't let prod silently degrade. (Constraint: never invent placeholder keys.)

---

## 5. Database — Neon

### 5.1 Setup

1. Create a Neon project `weld` (region close to the Render region — e.g. both `us-east`).
2. One database, default `neondb` or rename to `weld`.
3. Copy the connection string. Neon gives a **direct** and a **pooled** (`-pooler` host) endpoint.
   - **Use the direct endpoint for `DATABASE_URL`.** SQLAlchemy already pools (size 5, `pool_pre_ping=True` in `backend/app/db.py`), a single Render free instance won't exhaust Neon's connection limit, and the pooler (PgBouncer, transaction mode) can trip up Alembic DDL. Switch to pooled only when scaling past one instance.
4. Prefix the driver and keep SSL: `postgresql+psycopg://…?sslmode=require`. psycopg 3 honours `sslmode` in the URL.
5. Paste it into Render as `DATABASE_URL` (secret).

### 5.2 Free-tier limits (Neon, early 2026)

| Limit | Free value | Impact on WELD |
|-------|-----------|----------------|
| Storage | 0.5 GB | Fine — schema is tiny (projects, bibles, jobs, bugs). Thousands of games fit. |
| Compute | ~191 compute-hours/mo, 0.25 vCPU shared | Fine for low traffic **because compute scales to zero when idle**. A keep-warm pinger would blow this budget (see §6). |
| Autosuspend | after 5 min idle | First query after idle waits ~0.5–3 s for the compute to wake. Stacks with Render's cold start. |
| Projects | 1 | Enough (use branches for staging if needed). |
| Point-in-time restore | 24 h history | The rollback safety net for a bad migration (§9). |

---

## 6. Free-tier constraints — the honest list

| Service | Constraint | Effect on WELD | Cost to remove |
|---------|-----------|----------------|----------------|
| **Render** web service | Spins down after **15 min** of no requests | First request after idle takes **~50 s** (cold boot + `alembic upgrade` no-op + uvicorn start). Feels broken to a first visitor. | **Starter $7/mo** per service → always-on, no spin-down. Also unlocks pre-deploy command. |
| **Render** | 512 MB RAM, 0.1 CPU, 750 instance-hrs/mo | One service fits in the monthly hours. Memory is tight but adequate for this API. Build minutes are limited. | Starter $7 (same RAM, always-on) / Standard $25 (2 GB). |
| **Render** | Logs retained ~7 days, no shell, no disk | No persistent file storage (fine — no local uploads). Debugging is dashboard logs only. | Paid plans add SSH + longer retention. |
| **Neon** | Compute suspends after 5 min idle | ~0.5–3 s extra on the first query after idle. | **Launch $19/mo** → configurable/always-on compute, 10 GB. |
| **Neon** | ~191 compute-hrs/mo | Only a problem if something keeps the DB awake 24/7 (a naive keep-warm cron would). | Launch plan. |
| **Netlify** | 100 GB bandwidth, 300 build-min, 1 concurrent build /mo | Every PR deploy-preview + every prod deploy burns build minutes (~2–4 min each). ~75–100 builds/mo before the cap. | **Pro $19/mo** → 1 TB, 25k build-min, 3 concurrent. |
| **Netlify** | SSR = function invocations, ~125k/mo free | All routes are `force-dynamic`, so **every page view is a function call**. ~125k views/mo ≈ the cap. | Pro raises the cap; or make the landing page static/ISR (code change, ~125k headroom back). |
| **Cold-start combined** | Render 15 min + Neon 5 min | A visitor after a quiet hour waits ~50 s for the API, then the DB wakes. The frontend (Netlify) is always fast; only API-backed pages (Studio, gallery, play) are affected. | See below. |

**Cold-start mitigation on free, without paying:**
- A scheduled GitHub Action (or UptimeRobot) hitting `https://weld-api.onrender.com/health` every ~14 min keeps **Render** warm and stays within Render's 750 hrs.
- **Do not** also keep Neon warm this way — pinging every 14 min ≈ 730 h/mo of Neon compute, ~4× the free budget. The `/health` route does not touch the DB, so pinging it wakes Render but lets Neon sleep. Accept the ~1–3 s DB wake on the first real query, or pay for Neon Launch.
- Net: **$0/mo** gets you a fast frontend, a warm-able API, and an occasionally-cold DB. **$7/mo** (Render Starter) removes the API cold start. **$26/mo** (Render Starter + Neon Launch) removes both.

---

## 7. CI/CD wiring

### 7.1 Current CI (`.github/workflows/ci.yml`)

`quality` job on every push + PR: install → lint → build gamebible → typecheck → unit (TS) → build playtester → pytest → cache → build (sample-game + web) → Playwright e2e. Green today.

### 7.2 Add a gated `deploy` job

```yaml
  deploy:
    needs: quality
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy backend (Render)
        run: curl -fsSL -X POST "${{ secrets.RENDER_DEPLOY_HOOK }}"

      - name: Wait for backend health
        run: |
          for i in $(seq 1 60); do
            curl -fsS https://weld-api.onrender.com/health && exit 0
            sleep 10
          done
          echo "backend did not come healthy" && exit 1

      - name: Deploy frontend (Netlify)
        run: curl -fsSL -X POST "${{ secrets.NETLIFY_BUILD_HOOK }}"

      - name: Smoke test production
        run: |
          curl -fsS https://weld-api.onrender.com/api/v1/projects | grep -q scrap-sprint
          curl -fsS -o /dev/null -w '%{http_code}' https://weld.netlify.app/ | grep -q 200
```

- **`needs: quality`** — no deploy unless every test passed.
- **Backend before frontend** — migrations land first; the health-wait gate ensures the API is actually up before Netlify rebuilds against it.
- **Repo secrets required:** `RENDER_DEPLOY_HOOK`, `NETLIFY_BUILD_HOOK`. (Add `NETLIFY_AUTH_TOKEN` + `NETLIFY_SITE_ID` instead if using the CLI form.)
- Render `autoDeploy: false` and Netlify auto-publish **off**, so this job is the sole route to prod.
- PR deploy previews (Netlify) stay enabled for review; they never publish to the production URL.

---

## 8. Environment variable matrix (consolidated)

| Variable | Frontend (Netlify) | Backend (Render) | CI (GH secrets) | Secret | Per-env |
|----------|:--:|:--:|:--:|:--:|:--:|
| `WELD_API_URL` | ✅ | — | — | no | yes |
| `WELD_SITE_URL` | ✅ | — | — | no | yes |
| `NODE_VERSION` | ✅ | — | — | no | no |
| `DATABASE_URL` | — | ✅ | — | **yes** | yes |
| `CORS_ORIGINS` | — | ✅ | — | no | yes |
| `ENVIRONMENT` | — | ✅ (`production`) | — | no | yes |
| `LOG_LEVEL` | — | ✅ | — | no | no |
| `DIRECTOR_TIMEOUT_SECONDS` | — | ✅ | — | no | no |
| `FIREWORKS_API_KEY` | — | ⬜ optional | — | **yes** | yes |
| `GEMINI_API_KEY` | — | ⬜ optional | — | **yes** | yes |
| `OPENROUTER_API_KEY` | — | ⬜ optional | — | **yes** | yes |
| `RENDER_DEPLOY_HOOK` | — | — | ✅ | **yes** | yes |
| `NETLIFY_BUILD_HOOK` | — | — | ✅ | **yes** | yes |

- **Secrets** live only in the host's secret store (Render env, Netlify env, GitHub repo secrets). Never in the repo, never in a log. `.env` stays gitignored; it has never been committed (verified against full git history).
- **Per-env** vars differ between local `.env` and production. Local dev keeps using the existing `.env` (LLM keys reused per owner's decision); production keys are set in Render — reuse or rotate at go-live is the owner's call.

---

## 9. Pre-deploy checklist

**Accounts & secrets**
- [ ] Neon project created; direct `DATABASE_URL` copied, driver-prefixed, `sslmode=require`.
- [ ] Render service created from `render.yaml`; `DATABASE_URL`, `CORS_ORIGINS`, LLM keys set in dashboard as secrets; `autoDeploy` off.
- [ ] Netlify site created; `WELD_API_URL`, `WELD_SITE_URL` set; production auto-publish off; deploy previews on.
- [ ] GitHub repo secrets: `RENDER_DEPLOY_HOOK`, `NETLIFY_BUILD_HOOK`.
- [ ] Confirm `.env` absent from git history (`git log --all -- .env` → empty ✓).

**Code (pre-deploy fixes P1–P4, on the branch)**
- [ ] `WELD_SITE_URL` aligned in `.env.example` + `docker-compose.yml`.
- [ ] `.nvmrc` (`20`), `backend/runtime.txt` (`python-3.12.10`).
- [ ] `netlify.toml`, `render.yaml` committed.
- [ ] `ci.yml` `deploy` job added.
- [ ] Full suite green on the branch; CI green on the PR.

**DNS / custom domain (optional, skip for v1)**
- [ ] Netlify: add domain, point DNS, set `WELD_SITE_URL` to it, add it to Render `CORS_ORIGINS`.
- [ ] API stays on the `onrender.com` subdomain (server-to-server only; no user-facing need for a custom API domain).

**Monitoring / logging**
- [ ] UptimeRobot (free): monitors on `https://weld.netlify.app/` and `https://weld-api.onrender.com/health`; this also serves as the Render keep-warm ping (14-min interval).
- [ ] Bookmark: Render logs, Netlify deploy + function logs, Neon metrics.
- [ ] *(optional, new scope)* Sentry free tier on frontend + FastAPI for error tracking.

**Rollback plan**
- [ ] **Frontend:** Netlify → Deploys → pick the last-good deploy → "Publish deploy" (instant, no rebuild).
- [ ] **Backend:** Render → Events → "Rollback" to the previous deploy, or re-run the CI deploy job on the last-good commit.
- [ ] **Migrations:** before any deploy that adds a migration, create a **Neon branch** from `main` as a named snapshot (or rely on 24 h PITR). Every migration must have a working `downgrade()`. If a migration breaks prod: roll back the Render deploy, then `alembic downgrade -1` against `DATABASE_URL`, or restore the Neon branch.

**Production smoke tests (run after first deploy — also encoded in the CI `deploy` job)**
1. [ ] `GET https://weld-api.onrender.com/health` → `{"status":"ok","environment":"production"}`
2. [ ] `GET https://weld-api.onrender.com/api/v1/projects` → contains `scrap-sprint`
3. [ ] `GET https://weld.netlify.app/` → 200; hero game boots and accepts input
4. [ ] `/app` → Studio loads; describe → draft → build a game (offline or live per keys)
5. [ ] Break it → playtester runs with real evidence; a failing gate can be recorded as a bug
6. [ ] Publish → gate runs → `/play/<slug>` reachable; OG image renders with the **production** URL (`WELD_SITE_URL`)
7. [ ] `/gallery` lists the published game; remix → new private draft opens in the Studio
8. [ ] Browser console shows **zero errors** on landing, Studio, and play pages (the product's own release gate)

---

## 10. Execution order (runbook, once approved)

1. Land pre-deploy fixes P1–P4 (+ P5 if approved) on `chore/baseline-cleanup`; full suite green.
2. Create Neon project → get `DATABASE_URL`.
3. Create Render service (from `render.yaml`) → set env/secrets → **manual first deploy** → verify `/health` + `/api/v1/projects` + seed.
4. Create Netlify site → set env → **manual first deploy** → verify landing + Studio against the live API.
5. Run the §9 smoke tests by hand against both live URLs.
6. Add the CI `deploy` job; set GitHub secrets; open the PR.
7. **Owner reviews the PR and approves the merge.** (Per the blueprint: never push to `main` / deploy without explicit approval.)
8. Merge → CI runs `quality` → `deploy` → automated smoke test.
9. Update `README.md` status table + `CHANGELOG.md` with the real live URLs and the free-tier constraints in effect.

---

## 11. Open decisions for the owner

1. **LLM keys in production:** reuse the local `.env` keys, issue fresh ones, or launch in honest offline mode? (Offline is a valid launch state; it must be a choice, not a silent default.)
2. **Spend:** stay fully free (accept the ~50 s API cold start after idle), or $7/mo for Render Starter to remove it? Neon Launch ($19) only if the DB cold start also needs to go.
3. **Custom domain** for v1, or ship on `*.netlify.app` / `*.onrender.com` first?
4. **P5** — gitignore the committed `frontend/public/sample-game/` build artifact? (Recommended; low risk now that the copy script is fixed.)
5. **Region** — confirm Render + Neon in the same region (recommend `us-east` unless the audience is elsewhere).
