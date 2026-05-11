# QuickBooks Online — production readiness (Phase 61.1)

This document summarizes how Equipify connects to **QuickBooks Online (QBO)**, what is **production-ready**, what is **sandbox-only**, and what operators must configure in **Intuit Developer**. It complements code in `lib/integrations/quickbooks/` and `app/api/integrations/quickbooks/`.

## Architecture (what is live)

| Area | Location | Notes |
|------|----------|--------|
| OAuth start | `GET /api/integrations/quickbooks/authorize` | Requires `organizationId`; `requireOrgIntegrationAdmin`; signed `state` via `INTEGRATION_OAUTH_STATE_SECRET`. |
| OAuth callback | `GET /api/integrations/quickbooks/callback` | Exchanges code server-side; persists tokens with **service role**; redirects to `/settings/integrations/quickbooks` with query flags (no tokens in URL). |
| State signing | `lib/integrations/oauth-state.ts` | HMAC-SHA256 over payload `{ organizationId, userId, ts }`; **timing-safe** compare; **15 min** max age in callback. |
| Token storage | `organization_integration_oauth_tokens` | **Server-only**; never returned from member APIs. |
| Integration row | `organization_integrations` | `connection_status`: `disconnected` \| `connected` \| `error` \| `revoked`. |
| Connection + refresh | `lib/integrations/quickbooks/connection.ts` | Refreshes access token when near expiry; on refresh failure sets `connection_status: error` and **sanitized** `last_sync_error`. |
| QBO REST | `lib/integrations/quickbooks/api.ts` | JSON API with `minorversion=65`; 401 retry via caller `onUnauthorized`; 429 single retry. |
| Sync orchestration | `lib/integrations/quickbooks/sync-runner.ts` | Inserts `quickbooks_sync_logs` (`started` → final); updates integration health + **structured server logs** (`quickbooks_integration` JSON lines). |
| Customer / catalog / invoice export | `customer-sync.ts`, `catalog-sync.ts`, `invoice-sync.ts` | Uses `external_sync_mappings` for idempotency + duplicate handling. |
| Payment status import | `invoice-inbound-reconcile.ts`, `POST .../integrations/quickbooks` `kind: payments` | Read-only comparison; apply-paid is a separate guarded route. |
| Settings UI | `/settings/integrations/quickbooks` | Connection badge, **no realm ID** in browser; API environment pill; financial detail gated by permissions. |
| Invoice drawer | `GET .../invoices/[id]/quickbooks-sync` | Returns `connectionNeedsAttention` when `connection_status === error` so the UI does not imply a healthy connection. |

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `QUICKBOOKS_CLIENT_ID` | Yes (OAuth) | Intuit app Client ID. |
| `QUICKBOOKS_CLIENT_SECRET` | Yes (OAuth) | Server-only secret; never log or expose. |
| `QUICKBOOKS_REDIRECT_URI` | Yes (OAuth) | **Must exactly match** a redirect URI in the Intuit app (e.g. `https://your-domain.com/api/integrations/quickbooks/callback`). |
| `INTEGRATION_OAUTH_STATE_SECRET` | Yes (OAuth) | Min **16** characters; signs OAuth `state`. |
| `QUICKBOOKS_API_BASE_URL` | Optional | Default `https://quickbooks.api.intuit.com`. For **sandbox**, set to Intuit’s sandbox accounting API host (must contain `sandbox` for the app to label env as **sandbox** in UI). |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (callback) | Callback uses service role to write tokens and integration rows. |

Public callback path (for Intuit console): **`/api/integrations/quickbooks/callback`** (full URL = origin + path).

## Production vs sandbox

- **OAuth endpoints** (`appcenter.intuit.com`, `oauth.platform.intuit.com`) are shared; **company data** is partitioned by **realm** and by whether the Intuit app / company is in **sandbox** vs **production**.
- Deployments should use a **sandbox** Intuit app + sandbox company for non-prod, and a **production** app for prod, with matching **`QUICKBOOKS_REDIRECT_URI`** and API base URL.
- The Settings UI shows **API: production** or **API: sandbox** based on `getQuickBooksApiEnvironment()` (`lib/integrations/quickbooks-env.ts`) — derived from `QUICKBOOKS_API_BASE_URL`, not from secrets.

## Intuit app checklist (manual)

1. Create / select app in [Intuit Developer](https://developer.intuit.com/).
2. Add **Redirect URI**: `https://<production-host>/api/integrations/quickbooks/callback` (and staging URL if needed).
3. Enable **QuickBooks Online** and scope **`com.intuit.quickbooks.accounting`** (matches `quickbooks-oauth.ts`).
4. Use **production keys** only in production vault; rotate if leaked.
5. Confirm **sandbox vs production** company matches `QUICKBOOKS_API_BASE_URL`.

## OAuth / token behavior (validated)

- **State**: signed + timestamped; verified with constant-time compare; user id must match session on callback.
- **Tokens**: only stored server-side; disconnect **deletes** token rows and clears integration fields (see `DELETE .../integrations/quickbooks`).
- **Refresh failure**: integration moves to **`error`**; sync APIs return **`connection_error`** (HTTP 409) with a clear message — does not crash the process.
- **Realm ID**: stored in DB for API calls; **stripped from JSON** sent to the browser (`formatQuickBooksIntegrationForClient`); UI shows **“QuickBooks company linked”** only.

## Sync logging & safety

- **DB**: `quickbooks_sync_logs` holds `status`, counts, `error_message`, and `detail` (phase summary + per-row messages).
- **Sanitization**: `sanitizeQuickBooksClientMessage` redacts JWT-like fragments and `Bearer` tokens before persisting integration errors and some log fields.
- **stdout**: `logQuickBooksIntegrationEvent` emits one JSON line per sync lifecycle event (`sync_export_started`, `sync_export_completed`, `token_refresh_failed`, etc.) — **no** raw QBO bodies, **no** OAuth tokens, **no** realm id.

## Mapping & duplicate prevention (summary)

- **Customers**: `external_sync_mappings` (`entity_type: customer`); pre-link by **DisplayName** and **PrimaryEmailAddr** query; duplicate create attempts retry with **`(Equipify)`** suffix; updates use sparse PATCH.
- **Catalog**: mapping by **SKU** then **Name**; requires a resolvable **Income** account (`accounts.ts`).
- **Invoices**: mapped per invoice row; payment entities tracked separately for inbound reconciliation.
- **sync_status**: `pending` \| `synced` \| `error` \| `stale` (stale when source updated after last sync — see `markMappingStaleIfUpdatedSinceSync`).

No schema migration was required for 61.1.

## Known limitations

- **Partial sync**: multi-phase export can end `partial`; integration `sync_health` becomes `degraded`.
- **No automatic retry queue** beyond API 429 single retry and 401 refresh path.
- **Marketing** `/integrations` catalog: QuickBooks is **Live** (Phase 61.3); workspace truth remains **`/settings/integrations`** + `docs/INTEGRATION_CATALOG_INVENTORY.md`.

## Manual test checklist

- [ ] **Env**: all required vars set; Intuit redirect URI matches exactly.
- [ ] **Connect**: authorize flow completes; Settings shows **Connected** and **API** pill matches environment.
- [ ] **Disconnect**: tokens removed; UI **Not connected**; no secrets in network tab responses.
- [ ] **Customer sync**: mappings created; duplicate name handled without duplicate QBO customer where possible.
- [ ] **Catalog sync**: items created/updated; income account resolution works or surfaces a clear error.
- [ ] **Invoice sync** (financial role): exports as expected; errors visible in **Recent sync activity** without raw payloads.
- [ ] **Token failure**: simulate invalid refresh (e.g. revoke in Intuit); next sync shows **Needs attention** / `connection_error`; invoice drawer shows **connectionNeedsAttention**.
- [ ] **Logs**: server logs contain `quickbooks_integration` events without tokens; DB `last_sync_error` has no bearer strings.

## Related files

- `lib/integrations/quickbooks-env.ts` — env helpers + API environment label.
- `lib/integrations/quickbooks/safe-log.ts` — sanitization + structured logging.
- `lib/integrations/quickbooks/connection.ts` — refresh + `connection_status` error handling.
- `docs/PLAN_ENTITLEMENT_ENFORCEMENT_AUDIT.md` — plan vs permission notes for integrations (permission-first).
