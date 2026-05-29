# Equipify Growth Browser Intake (Chrome Extension)

Minimal Manifest V3 extension for sending operator-captured company and contact data into Equipify Growth Engine.

## Install (unpacked)

1. Sign in to [app.equipify.ai](https://app.equipify.ai) as a platform admin in Chrome.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select this folder:
   `extensions/growth-browser-intake`
5. Pin the extension, open a website or LinkedIn page, and click the extension icon.

## Usage

- The popup pre-fills **source URL** and **source platform** from the active tab (URL only — no hidden scraping).
- Enter the company and contact fields you want to capture from the page.
- Submit sends a POST to `/api/platform/growth/browser-intake/contact` using your existing Equipify session cookies.
- On success, use **Open lead in Equipify** to review the created or updated lead.

## Requirements

- `GROWTH_ENGINE_ENABLED=true` on the Equipify deployment.
- Platform admin session in the same Chrome profile.
- Database migration `20270528140000_growth_browser_extension_source_kind.sql` applied.

## Security

- No API keys or secrets are stored in the extension.
- No automatic outreach, messaging, or hidden data extraction.
