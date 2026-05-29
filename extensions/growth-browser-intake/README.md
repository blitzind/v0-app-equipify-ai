# Equipify Growth Browser Intake (Chrome Extension)

Manifest V3 extension with **V2 Smart Capture** for Equipify Growth Engine.

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
4. Pin the extension and open it on a website or LinkedIn page.

## Install (ZIP download)

Package the extension for admin download:

```bash
pnpm package:growth-extension
```

This writes `public/downloads/growth-browser-intake.zip`, served at:

`/downloads/growth-browser-intake.zip`

After download:

1. Unzip the archive (contains a `growth-browser-intake/` folder).
2. In Chrome, open `chrome://extensions` → **Developer mode** → **Load unpacked**.
3. Select the unzipped `growth-browser-intake` folder.

## V2 features

- **Smart company detection** from visible page metadata only (`document.title`, Open Graph, canonical URL, JSON-LD).
- **Existing lead detection** via Growth Engine lookup (domain, LinkedIn URL, company name).
- **Quick Save** mode for fast contact entry (name, email, phone, title).
- **Company-only capture** when no contact fields are provided.
- **Optional contact discovery queue** (non-blocking background enrichment).
- **No hidden scraping**, no LinkedIn API bypass, no secrets stored.

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
pnpm test:growth-browser-extension-install
pnpm test:growth-browser-intake
```
