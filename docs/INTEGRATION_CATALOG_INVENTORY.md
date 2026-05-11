# Integration catalog inventory (Phase 61.3)

Single source for **what is real vs roadmap** in the Equipify product. UI copy should match this table; detailed wiring lives in `docs/SETTINGS_WIRING_AUDIT.md`, QuickBooks in `docs/QUICKBOOKS_PRODUCTION_READINESS.md`, future public API in `docs/PUBLIC_API_AND_WEBHOOKS_ARCHITECTURE.md`.

| Integration | Backend / OAuth | Sync direction | Production-ready | Entitlement / permission | Webhooks (tenant) | Marketing `/integrations` | Settings hub |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **QuickBooks Online** | Yes — OAuth, tokens server-side | Export + optional auto-sync; inbound payment compare | Yes (operator-dependent) | `requireOrgIntegrationAdmin` / `canManageIntegrations` for admin UI | N/A (QBO API, not outbound webhooks) | **Live** | **Live** + live connection pill |
| **Stripe** | Yes — platform billing | N/A (Checkout/subscriptions) | Yes | Billing capabilities | Platform Stripe webhook (not tenant) | **Limited** (billing path) | **Limited** → Billing |
| **Fuzor** | No in-app connector | N/A | Partner link only | N/A | No | **Beta** (external link) | Not listed on hub |
| **Gmail** | No | — | No | — | No | **Planned** | **Planned** |
| **Google Calendar** | No | — | No | — | No | **Planned** | **Planned** |
| **Slack** | No | — | No | — | No | Not on marketing grid | **Planned** |
| **Twilio SMS** | No | — | No | — | No | **Planned** (as Twilio) | **Planned** |
| **Salesforce** | No | — | No | — | No | Not on marketing grid | **Planned** |
| **Zapier / Make / n8n** | No | — | No | — | No | **Planned** | Zapier **Planned** on hub |
| **Xero** | No | — | No | — | No | **Planned** | Not on hub |
| **Microsoft 365 / Outlook Calendar** | No | — | No | — | No | **Planned** | Not on hub |
| **DocuSign / PandaDoc** | No | — | No | — | No | **Planned** | DocuSign **Planned** on hub |
| **Google Maps** | Platform keys only (not tenant OAuth) | — | Partial | — | No | **Planned** | Not on hub |
| **Public HTTP API + outbound webhooks** | Not live | — | No | Planned `api_access` + `canManageApiKeys` | Spec only | N/A | `/settings/api` honesty shell |

## Misleading patterns removed (61.3)

- Marketing catalog no longer marks **QuickBooks** or **Stripe billing** as generic “Coming soon”.
- Removed fake KPI **“Automation Ready: 12”**.
- **Interest / request** modals disclose that forms are **not** sent to Equipify servers (preview-only).
- Settings hub **disabled “Connect (coming soon)”** and **disabled “Docs”** stubs replaced with honest **“No in-app setup yet”** and no fake doc buttons.
- **Fuzor** CTA is **Visit Fuzor**, not **Connect**.

## Code references

- Catalog metadata: `lib/integrations/catalog-metadata.ts`
- Marketing page: `app/(dashboard)/integrations/page.tsx`
- Settings hub: `app/(dashboard)/settings/integrations/page.tsx`

## Maintenance (Phase 62.1)

- Integration catalog remains **single-sourced** in `catalog-metadata.ts` — do not reintroduce parallel marketing arrays or duplicate readiness badge maps.
- Roadmap KPI on `/integrations` counts catalog rows with readiness **`planned`** only; reserved readiness values (`coming_soon`, `internal`, `enterprise`) stay in the type union for future rows without affecting KPIs until entries exist.
