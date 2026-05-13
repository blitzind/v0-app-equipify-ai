# Industry screenshot & media automation

This document describes the **automated, industry-aware screenshot pipeline** for Equipify (marketing-safe, deterministic enough for CI and future asset pipelines).

## Architecture

| Layer | Role |
|-------|------|
| **`lib/screenshots/industry-scenario-registry.ts`** | Canonical list of **surfaces** (dashboard, work orders, equipment, PM, dispatch, invoices, reports, AI Ops) × **industry output folders**. Same routes for every vertical; seeded org content provides realism. |
| **`lib/screenshots/build-screenshot-url.ts`** | Appends `equipifyShot=1` for capture mode. |
| **`lib/screenshots/scenario-types.ts`** | Type definitions + `SCREENSHOT_QUERY_FLAG`. |
| **Playwright** (`playwright.config.ts`, `e2e/screenshots/*`) | Chromium automation: optional auth setup, navigation, `networkidle` settle, PNG + `.meta.json` + root `manifest.json`. |
| **App chrome** | `ScreenshotModeGate`, `[data-screenshot-chrome="hide"]`, welcome gate bypass — see below. |

## App integration (deterministic chrome)

1. **`components/screenshot-mode-gate.tsx`** — reads `?equipifyShot=1`, sets `document.documentElement` attribute `data-equipify-shot="1"`.
2. **`app/globals.css`** — when the attribute is present, hides elements marked `data-screenshot-chrome="hide"` and disables CSS animations for stable stills.
3. **Tagged chrome** — `AidenChatLauncher`, `BillingWarningBanner`, `ImpersonationBanner` carry `data-screenshot-chrome="hide"`.
4. **`FirstRunWelcomeGate`** — returns `null` when `equipifyShot=1` so first-run modal never blocks frames.

## Routes / scripts

| Path | Description |
|------|-------------|
| `playwright.config.ts` | Playwright entry: Desktop Chrome, serial workers, optional `storageState`. |
| `e2e/screenshots/auth.setup.ts` | Logs in with env credentials; writes `e2e/screenshots/.auth/user.json`. |
| `e2e/screenshots/industry-assets.spec.ts` | Iterates scenarios × industries; writes PNG + metadata + manifest. |
| `package.json` scripts | `screenshots:install`, `screenshots:industry`. |

There is **no public HTTP route** for screenshots (avoids unauthenticated capture endpoints). Automation is **CLI-only** via Playwright.

## Industry scenarios (surfaces)

For each industry key in `EQUIPIFY_SCREENSHOT_INDUSTRIES`, the runner captures:

1. **Executive dashboard** — `/`  
2. **Work orders** — `/work-orders`  
3. **Equipment** — `/equipment`  
4. **Service schedule** — `/service-schedule`  
5. **Maintenance plans** — `/maintenance-plans`  
6. **Dispatch** — `/dispatch`  
7. **Invoices** — `/invoices`  
8. **Reports** — `/reports`  
9. **AI Operations** — `/ai-ops`  

File naming: `{industry}/{NN-slug}.png` (ordered slugs for stable diffs).

## Marketing automation (future)

- Consume `screenshots/output/manifest.json` in a CMS or static site generator.  
- `registryVersion` (`SCREENSHOT_REGISTRY_VERSION`) bumps when scenario sets change.  
- `.meta.json` per frame carries `category` for taxonomy (dashboard, financial, ai_insights, …).

## QA checklist

1. **Auth:** With env credentials, `e2e/screenshots/.auth/user.json` is created; second run can delete env if file committed (not recommended for real passwords).  
2. **Server:** App reachable at `EQUIPIFY_SCREENSHOT_BASE_URL`; no mixed-content warnings.  
3. **Data:** Target org has **succeeded** demo seed for the industry you are capturing; re-import after changing `organizations.industry`.  
4. **Chrome hidden:** PNGs show **no** floating AIden button, **no** billing warning strip, **no** welcome dialog (when using `equipifyShot=1`).  
5. **RBAC:** Screenshot user can open all listed routes (owner/admin recommended).  
6. **AI Ops / Reports:** If plan gates hide pages, expect redirects or empty states — adjust user/plan or scenario list.  
7. **Manifest:** `manifest.json` row count = `industries.length × scenarioCount`.  
8. **Review:** Spot-check one PNG per industry for PII — demo data should use synthetic labels only.

## Security

- **Never** commit live `user.json` with production sessions to public repos.  
- Auth setup requires explicit env vars or a deliberately generated storage file on a secure machine.  
- Output directory `screenshots/output/` is **gitignored**.
