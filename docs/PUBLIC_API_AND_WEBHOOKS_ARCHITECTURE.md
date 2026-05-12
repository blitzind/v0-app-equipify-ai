# Public API & outbound webhooks — architecture (Phase 61.2)

This document is **design-only**. It describes a recommended foundation for a **future** Equipify **public HTTP API** and **org-scoped outbound webhooks**. It is **not** a live product specification and does **not** imply that keys, public routes, or webhook delivery exist in production.

**Distinction — what exists today**

| Layer | What it is | Auth / scope |
|-------|------------|----------------|
| **Dashboard Route Handlers** | `app/api/organizations/[organizationId]/...`, portal, cron, Stripe webhook | Session cookies, org membership, `requireOrgPermission`, service role only where explicitly scoped — **internal app backends**, not a third-party developer API. |
| **Stripe webhook** | `POST /api/stripe/webhook` | Stripe signatures — **platform billing**, not tenant “integration webhooks”. |
| **AI Ops digest Slack/Teams** | Internal operator webhooks | Staff-configured URLs; not a general event bus. |
| **Usage table** | `organization_api_usage_monthly` | Intended for **future** metering; **not** reliably incremented for all traffic today — see `docs/USAGE_METERING_ENFORCEMENT.md`. |

---

## 1. Recommended public API key model

1. **Org-scoped keys** — Each key belongs to exactly one `organization_id`. No cross-tenant keys.
2. **Store hashed secrets** — Persist only a **strong hash** (e.g. Argon2id or bcrypt) of the secret material; show the raw key **once** at creation. Store prefix/suffix for admin identification (e.g. `eq_live_abc…xyz`).
3. **Key id + secret** — Public clients send `Authorization: Bearer <secret>` or `X-Equipify-Key: <secret>`; server resolves to `key_id` → org → permissions scope.
4. **Rotation** — Support multiple active keys per org with labels; revoke marks key invalid immediately; optional grace period is a product choice.
5. **Scopes** — Fine-grained strings (e.g. `customers:read`, `invoices:write`) stored on the key row; enforced on every public route.
6. **Plan gate** — Require `canUseFeature(planId, "api_access", trial)` (today **Scale**-family; trials map per `lib/billing/entitlements.ts`) **before** issuing keys and optionally on each request.
7. **Permission alignment** — Key creation UI should require an org capability such as **`canManageApiKeys`** (already reserved in nav). Individual key scopes must not exceed what the creating user could do via dashboard (policy decision).
8. **Platform admin** — Support operations (revoke all keys for org, read audit) via existing platform-admin patterns; never bypass org scoping for **customer** data without audit.
9. **Rate limiting** — Per-key and per-org limits; align counts with **`organization_api_usage_monthly`** (or successor) once increments are trustworthy.
10. **Audit** — Log key create/revoke/rotate, IP (if available), actor user id; never log raw secret or full bearer token.

---

## 2. Org scoping & RLS

- Public API handlers must **resolve org from the key** (or from a path that is **verified** against the key’s org), never trust a client-supplied `organizationId` alone.
- **Do not bypass RLS** for tenant data: prefer **service role** only in narrow workers with explicit checks, or **member-scoped** queries using a security definer pattern that still enforces `organization_id` = key’s org.
- Internal routes under `/api/organizations/[organizationId]/...` remain **unchanged**; a future public API might live under e.g. `/api/v1/...` with separate middleware.

---

## 3. Usage metering hooks

- Successful authenticated public API requests should increment a **durable counter** (monthly partition per org) compatible with `PLAN_LIMITS.apiCallsMonthly` / Scale trial behavior.
- **Until** increment points are wired, billing UI should remain **honest** (display-only or partial) — already documented in usage metering doc.
- Deny or soft-limit when over quota **after** metering is reliable (fail-open during transition is a product risk).

---

## 4. Outbound webhooks (recommended product shape)

**Goal:** Equipify **pushes** signed HTTP POSTs to customer-owned HTTPS endpoints when domain events occur.

### 4.1 Data model (conceptual)

- **`webhook_endpoints`**: `id`, `organization_id`, `url` (HTTPS only), `enabled`, `description`, `created_at`, `revoked_at`.
- **`webhook_endpoint_secrets`**: signing secret per endpoint (hashed at rest optional; HMAC needs raw secret in worker — store in vault/KMS in production).
- **`webhook_subscriptions`**: `endpoint_id`, `event_types[]` (subset of catalog).
- **`webhook_deliveries`**: `id`, `endpoint_id`, `event_type`, `payload_version`, `status` (pending/sent/failed/dead), `attempt_count`, `next_attempt_at`, `last_error` (sanitized), `http_status`, `created_at`, `completed_at`.
- **Idempotency:** `event_id` (UUID) per logical emission so retries do not double-apply downstream.

### 4.2 Signing

- Header e.g. `X-Equipify-Signature: t=<unix>,v1=<hmac_sha256_hex>` over `t + "." + raw_body`.
- Customer verifies with the **endpoint signing secret** shown once at registration (same pattern as Stripe).

### 4.3 Retry / backoff

- Exponential backoff with jitter; max attempts; dead-letter state; **no** unbounded retry.
- **Test delivery** action sends a synthetic `ping` event (no PII).

### 4.4 Security

- HTTPS only; optional IP allowlist (enterprise); no secrets in query strings; truncate error messages in logs; payload **minimal** (ids, types, timestamps) — avoid full financial payloads by default.

### 4.5 Plan / permission gating

- **Planned:** Gate subscription management behind Growth+ or a dedicated “integrations advanced” flag; require `canManageApiKeys` or a new `canManageWebhooks` capability.
- **Internal** Slack/Teams digests remain separate from this product.

### 4.6 Event catalog (future)

Canonical names should align with `lib/api/future-webhook-event-types.ts` (documentation scaffolding only — **not emitted** today). Examples:

- `customer.created`, `customer.updated`
- `equipment.created`, `equipment.updated`
- `work_order.created`, `work_order.updated`, `work_order.status_changed`
- `invoice.created`, `invoice.updated`, `invoice.paid`
- `quote.created`, `quote.accepted`, `quote.declined`
- `certificate.released`
- `portal.document.viewed`
- `inventory.low_stock`
- `integration.quickbooks.sync_completed`

---

## 5. What is safe to expose later

- OpenAPI / JSON Schema **after** routes are stable.
- **Sandbox** keys for test orgs only.
- Developer docs **inside** the app or authenticated help center — not as if the API were GA until security review passes.

---

## 6. What must not ship casually

- Bearer tokens in URLs or logs.
- Public routes without rate limits and org resolution.
- Webhook registration without HTTPS and signing.
- “Soft launch” API that shares internal Route Handler code paths without a dedicated auth layer.

---

## Related documents

- `docs/SETTINGS_WIRING_AUDIT.md` — `/settings/api` status (Phase 65.0 developer shell: gated UI, no live keys).
- `docs/USAGE_METERING_ENFORCEMENT.md` — API monthly counter honesty.
- `docs/PLAN_ENTITLEMENT_ENFORCEMENT_AUDIT.md` — `api_access` feature.
- `docs/QUICKBOOKS_PRODUCTION_READINESS.md` — example of a **live** integration (contrast with this **planned** surface).
