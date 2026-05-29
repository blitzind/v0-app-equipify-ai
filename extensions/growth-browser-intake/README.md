# Equipify Growth Browser Intake (Chrome Extension)

Manifest V3 extension with **V3 Side Panel + Capture History** for Equipify Growth Engine.

## Install from Growth Engine UI

Platform admins can find install instructions in Growth Engine:

- `/admin/growth/browser-intake-test`
- `/admin/growth/acquisition`
- `/admin/growth/settings/growth`

The **Chrome Extension** card shows the local repo path and a ZIP download when packaged.

## Install (unpacked from repo)

1. Sign in to [app.equipify.ai](https://app.equipify.ai) as a platform admin in Chrome.
2. Open `chrome://extensions` → enable **Developer mode**.
3. **Load unpacked** → select `extensions/growth-browser-intake` from this repo.
4. Pin the extension. Use the toolbar popup or open the **side panel** from Chrome’s extension menu for prospecting.

## Install (ZIP download)

Package the extension for admin download:

```bash
pnpm package:growth-extension
```

This writes `public/downloads/growth-browser-intake.zip` and `public/downloads/growth-browser-intake-package-metadata.json`, served at:

- `/downloads/growth-browser-intake.zip`
- `/downloads/growth-browser-intake-package-metadata.json`

Each packaged ZIP also includes `package-metadata.json` with extension version, generated timestamp, and git SHA when available.

After download:

1. Unzip the archive (contains a `growth-browser-intake/` folder).
2. In Chrome, open `chrome://extensions` → **Developer mode** → **Load unpacked**.
3. Select the unzipped `growth-browser-intake` folder.

## V3 features

- **Chrome Side Panel** stays open while browsing (popup remains as fallback).
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
