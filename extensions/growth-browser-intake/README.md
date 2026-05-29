# Equipify Sales (Chrome Extension)

Manifest V3 Chrome extension for **Equipify Sales** — a compact sales workspace with dark navigation rail, card-based CRM views, and operator-initiated capture tools for Growth Engine.

## Install from Growth Engine UI

Platform admins can find install instructions in Growth Engine:

- `/admin/growth/browser-intake-test`
- `/admin/growth/acquisition`
- `/admin/growth/settings/growth`

The **Equipify Sales** install card shows the local repo path and a ZIP download when packaged.

## Install (unpacked from repo)

1. Sign in to [app.equipify.ai](https://app.equipify.ai) as a platform admin in Chrome.
2. Open `chrome://extensions` → enable **Developer mode**.
3. **Load unpacked** → select `extensions/growth-browser-intake` from this repo.
4. Pin **Equipify Sales**. Use the toolbar popup or open the **side panel** from Chrome’s extension menu.

## Install (ZIP download)

Package the extension for admin download:

```bash
pnpm package:growth-extension
```

This writes `public/downloads/equipify-sales.zip` and `public/downloads/equipify-sales-package-metadata.json`, served at:

- `/downloads/equipify-sales.zip`
- `/downloads/equipify-sales-package-metadata.json`

Each packaged ZIP also includes `package-metadata.json` with extension version, generated timestamp, and git SHA when available.

After download:

1. Unzip the archive (contains an `equipify-sales/` folder).
2. In Chrome, open `chrome://extensions` → **Developer mode** → **Load unpacked**.
3. Select the unzipped `equipify-sales` folder.

## Features

- **Chrome Side Panel** stays open while browsing (popup remains as fallback).
- **LinkedIn CRM context overlay** on profile/company pages — lead status, owner, last activity, next action, score, opportunity, and company contact count.
- **LinkedIn status badges** in the extension popup/side panel (lookup-based, visible metadata only).
- **Recent captures** — last 5 saved leads in the side panel.
- **Post-save next steps** — open lead, view in Recently Captured, email verification status, contact discovery queue status.
- **Extension settings** — production vs local dev API base URL; optional verify-email and queue-discovery defaults.
- **Duplicate match labels** — matched by domain, LinkedIn URL, or company name.
- **Smart company detection** from visible page metadata only (`document.title`, Open Graph, canonical URL, JSON-LD).
- **No hidden scraping**, no LinkedIn API bypass, no secrets stored, no auto-messaging or outreach enrollment.

## API endpoints used

- `GET /api/platform/growth/browser-intake/lookup`
- `POST /api/platform/growth/browser-intake/contact`

Both require an active platform admin session (`credentials: include`).

## Requirements

- `GROWTH_ENGINE_ENABLED=true`
- Migration `20270528140000_growth_browser_extension_source_kind.sql` applied

## Security

- No API keys or secrets are stored in the extension.
- No automatic outreach, messaging, or hidden data extraction.

## Tests

```bash
pnpm check:growth-extension-package
pnpm test:growth-browser-extension-install
pnpm test:growth-browser-intake
```
