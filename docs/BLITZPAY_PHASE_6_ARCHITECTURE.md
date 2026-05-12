# BlitzPay Phase 6A — Native mobile financial ops foundations

Phase **6A** adds **org-scoped** tables and **staff** APIs for **mobile-first field finance capture**. It is **infrastructure only**: intents, signature authorization **hashes**, payroll approval queue rows, field-safe treasury snapshot bands, sync batch metadata, and an **append-only** mobile audit log.

## Boundaries (non-goals)

- **No autonomous payment collection** from these tables or APIs.
- **No offline money movement**, balance changes, GL posting, AP/vendor pay, or financing execution.
- **No payroll / financing / claims / vendor payment authority** from offline capture alone — server validation and existing finance flows remain authoritative.
- **No raw payment credentials** (PAN, bank numbers, Stripe secret data) in mobile payloads or persisted metadata; metadata keys matching provider prefixes are stripped from API responses and sanitized on insert.
- **No raw signature images** in the database or list APIs — only **SHA-256 hashes** of a deterministic string (pepper + typed fields + opaque client reference).
- **No raw Stripe / Connect ids** in mobile list payloads; avoid embedding provider identifiers in `metadata` for mobile rows.

## Server validation model

1. **Capture:** Technicians and authorized staff create **intents** (`draft` / `queued`, optional `captured_offline`) and **signature authorization** rows (`authorization_status=captured`).
2. **Sync:** `POST …/blitzpay/mobile/sync` marks intents `synced` when the server’s `updated_at` is not newer than the client’s last-known timestamp (**conflict detection** skips overwrite and logs `conflict_detected` audit rows).
3. **Review:** Finance roles use existing operational processes; Phase **6A** does not auto-promote intents to paid invoices or ledger lines.

## RLS vs service-role APIs

Tables include **RLS** for authenticated reads (finance vs technician scoping). Org routes use the **service role** after session permission checks and **re-apply** technician scoping in code (service role bypasses RLS).

## Reporting snapshot + FCC

`fetchBlitzpayOrgReportingSnapshot` adds eight bounded Phase **6A** fields. Nested reporting-style fetches pass `skipMobilePhase6a: true` to avoid redundant mobile aggregation where parent snapshots already compose other phases.

## Optional environment variables

- `BLITZPAY_MOBILE_AUDIT_PEPPER` — audit `immutable_hash` pepper (defaults to a dev-only string if unset).
- `BLITZPAY_MOBILE_SIGNATURE_PEPPER` — signature authorization hash pepper (defaults to a dev-only string if unset).

## Tests

- `pnpm test:blitzpay-phase-6a-mobile-financial-ops`
