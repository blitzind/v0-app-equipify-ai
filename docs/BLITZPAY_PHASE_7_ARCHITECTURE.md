# BlitzPay Phase 7A — production hardening, UX cleanup & commercial readiness foundations

Phase 7A is intentionally **not** a feature-expansion release. It hardens operational maturity, tightens reporting safety, introduces **permissive** entitlement hooks, improves staff UX copy/layout, and documents Stripe / scale boundaries — without new money-movement modules, without RLS relaxation, and without speculative automation.

## 1. Goals & non-goals

**Goals**

- Humanize staff-facing BlitzPay labels (snake_case enums → operator language where surfaced).
- Improve mobile overflow safety on dense financial surfaces (min-width, scroll-safe tables, responsive grids).
- Add **bounded** reporting snapshot nesting (`nestingDepth` + max depth) so future call graphs cannot fan out expensive enrichers indefinitely.
- Provide entitlement **definitions** and helpers (`lib/billing/blitzpay-entitlements.ts`) while keeping **all modules enabled** for every tier until product turns gates on.
- Add FCC **operational readiness** strip (additive JSON + UI) summarizing recursion policy, mobile signal score, replay governance, and a short permission-audit note.
- Stripe / Connect **readiness notes** and JSON token scanners for QA (`lib/blitzpay/blitzpay-stripe-readiness-guards.ts`).
- Deterministic **demo metric presets** for believable fixtures (`lib/blitzpay/blitzpay-demo-presets.ts`) — no randomness, no fake PII.

**Non-goals**

- New Stripe products, live-mode automation, Redis/workers, reporting architecture rewrites, marketing pricing pages, or portal expansion of financial internals.

## 2. Reporting snapshot recursion & nesting

- **Module:** `lib/blitzpay/blitzpay-reporting-snapshot-nesting.ts` — exports `BLITZPAY_REPORTING_SNAPSHOT_MAX_NESTING_DEPTH` (3) and `resolveBlitzpayReportingSnapshotNestedSkipState`.
- **Behavior:** When `nestingDepth` reaches the max, Phase **5A / 5B / 5C / 6A / 6B** enrichers are skipped **even if** explicit `skip*` flags were false — a defense-in-depth guard on top of existing Phase 5A `skip*` flags on linked-org member fetches (`lib/blitzpay/blitzpay-multi-entity-finance.ts` passes `nestingDepth: parentDepth + 1`).
- **Public API:** `fetchBlitzpayOrgReportingSnapshot(..., { nestingDepth?: number, skipMultiEntity?: boolean, ... })` — re-exports max depth constant from `blitzpay-reporting-snapshot.ts` for callers that need the number in docs or tests.

## 3. Entitlements & commercial packaging hooks

- `lib/billing/blitzpay-entitlements.ts` — `CommercialProductTier`, `BlitzpayCommercialModuleKey`, `isBlitzpayModuleEnabledForTier` (always `true` in 7A), `blitzpayModuleWouldBeGatedAtTier` (future), `blitzpayModuleDisabledReason`, `blitzpayCommercialUpgradeHint`.
- `lib/blitzpay/blitzpay-commercial-readiness.ts` — version constant + ordered surface keys for future feature matrices.

## 4. Operational readiness strip (FCC)

- **Server:** `lib/blitzpay/blitzpay-operational-readiness.ts` — `computeBlitzpayOperationalReadinessStrip` (deterministic score from bounded reporting tiles).
- **Composer:** `lib/blitzpay/blitzpay-financial-command-center.ts` adds `operationalReadiness` to the payload returned by `GET …/blitzpay/financial-command-center`.
- **UI:** `components/blitzpay/blitzpay-financial-command-center-panel.tsx` renders an additive card when the field is present.

## 5. Mobile layout helpers

- `lib/blitzpay/blitzpay-mobile-layout.ts` — shared class strings (`BLITZPAY_MOBILE_FIN_STACK`, `BLITZPAY_TABLE_SAFE_WRAP`, `BLITZPAY_TOUCH_TARGET`) for staff BlitzPay panels.

## 6. Stripe / Connect validation helpers

- `lib/blitzpay/blitzpay-stripe-readiness-guards.ts` — `scanJsonForStripeLikeTokens` (client/QA JSON leak scan) and `blitzpayConnectWebhookReadinessNotes` checklist strings. Complements `docs/STRIPE_PRODUCTION_READINESS.md`; does not call Stripe.

## 7. Security audit (Phase 7A scope)

- Confirmed pattern: BlitzPay org Route Handlers use `requireAnyOrgPermission` / `requireOrgPermission` + UUID param validation + `blitzpaySchemaGuardNextResponse` where established; observability **replay** adds `validateBlitzpayWorkflowReplayAuthorization` (owner/admin/platform).
- Phase 7A does **not** change RLS policies or permission matrices — documentation only calls out periodic re-audit when new routes ship.

## 8. Tests

- `pnpm test:blitzpay-phase-7a-hardening` — `scripts/test-blitzpay-phase-7a-hardening.ts` covers nesting skips, entitlement defaults, token scan helper, replay auth helper, deterministic ordering, and schema-health script presence.

## 9. Related documents

- [BLITZPAY_ARCHITECTURE.md](./BLITZPAY_ARCHITECTURE.md)
- [SCALE_READINESS_AUDIT.md](./SCALE_READINESS_AUDIT.md) §8.18
- [STRIPE_PRODUCTION_READINESS.md](./STRIPE_PRODUCTION_READINESS.md) — BlitzPay Connect supplement
