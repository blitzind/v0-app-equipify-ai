# BUILD-ENV-1 — Remove Local Env Build Dependency

**Date:** 2026-06-25  
**Verdict:** **PASS**

---

## Root cause

1. **Module evaluation:** `lib/supabase/server.ts` reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` at import time and throws if missing. During `next build`, page data collection imports this module — env must be present before Next starts.

2. **Legacy file poisoning:** Next.js automatically loads `.env.production.local` on production builds. Stale local files with empty placeholders (`NEXT_PUBLIC_SUPABASE_URL=""`) were being loaded instead of real Vercel Production values, causing the cryptic `Missing environment variable: NEXT_PUBLIC_SUPABASE_URL` error even when developers believed env was configured.

3. **Vercel encrypted env:** Production Supabase and pepper vars are **Encrypted** on Vercel. `vercel env pull` writes empty placeholders locally; `vercel env run` also materializes length-0 values for encrypted keys in this CLI environment. Local builds therefore require either **Vercel CI** (`VERCEL=1` with platform-injected env) or **explicit non-empty exports in the shell** — not `.env.production.local`.

---

## Correct build commands going forward

### On Vercel (CI / deploy)

No change — platform injects Production env. `pnpm build` runs via `run-production-build.ts`; when `VERCEL=1`, legacy local files are ignored and env comes from Vercel.

### Local production build (recommended)

**Option A — Vercel env run wrapper (hides legacy files):**

```bash
pnpm build:production
```

**Option B — Pull + source (public keys only; encrypted secrets may stay empty):**

```bash
pnpm env:pull:production
set -a && source .env.build && set +a
pnpm build:production:pulled
```

If encrypted vars are empty after pull, export real values into the shell from your team vault before building.

**Option C — Manual export (when pull/run cannot materialize encrypted vars):**

```bash
export NEXT_PUBLIC_SUPABASE_URL="https://<project>.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
export GROWTH_PROVIDER_CREDENTIALS_PEPPER="<production-pepper>"  # required for production guard
pnpm build
```

Legacy `.env.local` / `.env.production.local` are **hidden during local builds** so Next.js cannot load stale placeholders.

---

## Files changed

| File | Change |
|------|--------|
| `lib/build/vercel-build-env.ts` | **New** — legacy env hide/restore, `.env.build` loader, build env audit |
| `scripts/run-production-build.ts` | **New** — build entrypoint; hides legacy env; validates env |
| `scripts/vercel-build-env-pull.ts` | **New** — `vercel env pull .env.build` |
| `scripts/vercel-production-env-run.ts` | Hide all legacy env files (incl. `.env.production.local`) |
| `lib/growth/qa/reply-flow-env-bootstrap.ts` | Canonical sources: `.env.build`, `.env.vercel.production` only |
| `scripts/test-growth-reply-flow-env-bootstrap.ts` | Updated for new source list |
| `scripts/test-build-env-1-foundation.ts` | **New** — BUILD-ENV-1 cert |
| `package.json` | `build`, `build:production`, `build:production:pulled`, `env:pull:production`, `test:build-env-1-foundation` |
| `docs/BUILD-ENV-1_CERTIFICATION.md` | This report |

**Not changed:** `lib/supabase/server.ts` (strict validation preserved), Equipify Core, AI OS behavior, production runtime guards.

---

## Confirmations

| Check | Result |
|-------|--------|
| No dependency on `.env.local` / `.env.production.local` for build workflow | **PASS** — hidden during local builds; bootstrap sources updated |
| Production env validation strict | **PASS** — no fake defaults; `server.ts` throws unchanged; growth runtime guard unchanged |
| Clear failure when env missing | **PASS** — `[build-env]` message instead of opaque module error |
| `pnpm test:build-env-1-foundation` | **PASS** |
| `pnpm test:growth-reply-flow-env-bootstrap` | **PASS** |
| `pnpm build` with Vercel-simulated env | **PASS** (see below) |

---

## Build result (certification run)

```bash
VERCEL=1 \
NEXT_PUBLIC_SUPABASE_URL=https://byyfylkklbxcdofaspye.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<set> \
pnpm build
```

**Result:** **PASS** — full Next.js production build completed (simulates Vercel CI where env is injected).

`pnpm build:production` via `vercel env run` did **not** materialize encrypted Supabase keys locally (expected Vercel CLI limitation); use Vercel CI or shell exports for full local production builds.

---

## Developer cleanup (optional)

You may delete obsolete local files if no longer needed:

- `.env.production.local`
- `.env.local` / `.env.local.active`

Keep `.env.build` gitignored (already covered by `.env*` in `.gitignore`). Regenerate with `pnpm env:pull:production`.
