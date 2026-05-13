# Industry screenshot automation

Headless **Chromium** captures for marketing and sales enablement. Scenarios are **data-driven** from `lib/screenshots/industry-scenario-registry.ts` (stable routes; industry-specific *content* comes from the org’s `industry` + demo seed).

## Prereqs

1. **Running app** — e.g. `pnpm dev` on `http://127.0.0.1:3000` (or set `EQUIPIFY_SCREENSHOT_BASE_URL`).
2. **Seeded demo org** for the target vertical — set `organizations.industry` and import sample data (Settings → Sample data or first-signup seed) so surfaces are populated.
3. **Auth** — either:
   - **A)** Export credentials: `EQUIPIFY_SCREENSHOT_EMAIL` + `EQUIPIFY_SCREENSHOT_PASSWORD` (first run generates `e2e/screenshots/.auth/user.json`), or  
   - **B)** Place a trusted `e2e/screenshots/.auth/user.json` (Playwright `storageState`) and omit env vars; the auth setup project is skipped automatically.

## Commands

```bash
pnpm screenshots:install   # one-time Chromium download
pnpm screenshots:industry  # run full Playwright project (auth + captures)
```

## Environment

| Variable | Purpose |
|----------|---------|
| `EQUIPIFY_SCREENSHOT_BASE_URL` | App origin (default `http://127.0.0.1:3000`). |
| `EQUIPIFY_SCREENSHOT_EMAIL` / `EQUIPIFY_SCREENSHOT_PASSWORD` | Email/password login for auth setup. |
| `EQUIPIFY_SCREENSHOT_INDUSTRIES` | Comma-separated `WorkspaceIndustryKey` values; controls **output folders** under `screenshots/output/{industry}/`. Default: `hvac_r,equipment_rental,commercial_equipment,refrigeration_service,material_handling`. |

**Important:** Each industry in `EQUIPIFY_SCREENSHOT_INDUSTRIES` should correspond to a **workspace you have re-seeded** for that vertical (same routes, different demo copy). Re-run sample import after changing `organizations.industry` if you reuse one org.

## Outputs

- `screenshots/output/{industry}/*.png` — raster stills.  
- `screenshots/output/{industry}/*.meta.json` — sidecar metadata (scenario id, category, viewport, timestamps).  
- `screenshots/output/manifest.json` — aggregate index for CI or marketing pipelines.

## Determinism & branding

- URLs append `?equipifyShot=1` → `ScreenshotModeGate` sets `data-equipify-shot` on `<html>`.
- `app/globals.css` hides `[data-screenshot-chrome="hide"]` (AIden launcher, billing strip, impersonation bar) and zeroes CSS motion for calmer pixels.
- `FirstRunWelcomeGate` returns `null` when `equipifyShot=1` so modals do not block captures.
- Playwright uses `reducedMotion`, `colorScheme: light`, `animations: 'disabled'` on screenshot.

## QA

See **QA checklist** in `docs/SCREENSHOT_AUTOMATION.md`.
