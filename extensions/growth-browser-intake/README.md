# Equipify Growth Browser Intake (Chrome Extension)

Manifest V3 extension with **V2 Smart Capture** for Equipify Growth Engine.

## Install (unpacked)

1. Sign in to [app.equipify.ai](https://app.equipify.ai) as a platform admin in Chrome.
2. Open `chrome://extensions` → enable **Developer mode**.
3. **Load unpacked** → select `extensions/growth-browser-intake`.
4. Pin the extension and open it on a website or LinkedIn page.

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
