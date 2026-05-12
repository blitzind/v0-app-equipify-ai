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

### 3.1 Phase 7A (permissive runtime)

- `lib/billing/blitzpay-entitlements.ts` — `CommercialProductTier`, `BlitzpayCommercialModuleKey`, `isBlitzpayModuleEnabledForTier` (**always `true`** until product enables server gates), `blitzpayModuleWouldBeGatedAtTier` (**packaging preview** derived from the feature catalog), `blitzpayModuleDisabledReason`, `blitzpayCommercialUpgradeHint`.
- `lib/blitzpay/blitzpay-commercial-readiness.ts` — version constant + ordered surface keys (`BlitzpayCommercialSurfaceKey`) for staff vs platform surfaces.

### 3.2 Phase 7A.2 (registry, metadata, soft UI)

- **`lib/billing/blitzpay-commercial-tier.ts`** — canonical `CommercialProductTier`, `BLITZPAY_COMMERCIAL_TIER_RANK`, `normalizeCommercialProductTier`, `tierRank`, `maxCommercialTier`. No Stripe subscription reads.
- **`lib/billing/blitzpay-module-registry.ts`** — `BlitzpayCommercialModuleKey` union + `BLITZPAY_COMMERCIAL_MODULE_KEYS` exhaust list.
- **`lib/billing/blitzpay-feature-catalog.ts`** — typed `BlitzpayFeatureKey` rows (label, module, `minimumPackagingTier`, `moduleClassification`, `commercialLane`, `packagingHint`). `deriveBlitzpayModuleMinimumTiers()` aggregates module mins (max of feature mins).
- **`lib/billing/blitzpay-plan-metadata.ts`** — human positioning per tier (`BLITZPAY_PLAN_METADATA`, `getBlitzpayPlanMetadata`).
- **`lib/billing/blitzpay-commercial-packaging.ts`** — `getBlitzpayCommercialCategory`, `getBlitzpayCommercialLane`, `getBlitzpayUpgradeMetadata`, `getBlitzpayPlanPackagingFootnote`, `blitzpayModuleMaturityStage`, `BLITZPAY_FUTURE_PRICING_MATRIX_PLACEHOLDER` (structure only).
- **Entitlement API (server-safe, permissive default):**
  - `canAccessBlitzpayFeature(plan, feature, { enforceTierGates? })` — returns **`true` by default**; when `enforceTierGates: true`, compares tier ranks to the feature’s `minimumPackagingTier` (for future Route Handler guards / tests).
  - `getBlitzpayPlanFeatures(tier)` — feature keys included at/under a packaging tier.
  - `getBlitzpayRecommendedTier(featureKeys)` — smallest tier covering all listed features.
  - `buildBlitzpayEntitlementAuditSnapshot(plan, options?)` — deterministic audit DTO (modules/features that *would* gate if enforcement were on).
- **Re-exports:** `blitzpay-entitlements.ts` also re-exports selected packaging/plan helpers for discoverability.

### 3.3 Rollout & billing boundaries

- **No** Stripe subscription coupling, **no** paywalls, **no** new org billing enforcement in Phase 7A.2.
- **Soft UI:** `components/blitzpay/blitzpay-plan-awareness-strip.tsx` — subtle footnote + link to Settings → Billing; uses `useBillingAccessOptional` so **platform admin** surfaces stay safe without tenant billing context (platform copy only on `platform_blitzpay_ops`).
- **Future:** flip `enforceTierGates` in server guards only after legal/product sign-off; keep org permission checks as the primary access control.

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
- **Phase 7A.3** adds shared payload shaping/redaction helpers (`lib/blitzpay/blitzpay-payload-sanitization.ts`) for observability lists, claims payout APIs, portal hosted-checkout success JSON, and safer platform rollup errors — see §9.

## 8. Tests

- `pnpm test:blitzpay-phase-7a-hardening` — `scripts/test-blitzpay-phase-7a-hardening.ts` covers nesting skips, entitlement permissive defaults, packaging-preview `blitzpayModuleWouldBeGatedAtTier`, token scan helper, replay auth helper, deterministic ordering, and schema-health script presence.
- `pnpm test:blitzpay-phase-7a2-entitlements` — `scripts/test-blitzpay-phase-7a2-entitlements.ts` covers catalog uniqueness, enforced vs permissive `canAccessBlitzpayFeature`, plan feature sets, recommended tier, upgrade metadata, commercial category labels, platform-admin classification, and audit snapshots.
- `pnpm test:blitzpay-phase-7a3-security-hardening` — `scripts/test-blitzpay-phase-7a3-security-hardening.ts` covers payload shaping (observability, idempotency, claims payouts, portal prepare-pay), replay route wiring assertions, platform rollup safe errors, technician intent filtering, and staff `load_failed` JSON shape.
- `pnpm test:blitzpay-phase-7a4-performance` — `scripts/test-blitzpay-phase-7a4-performance.ts` covers nesting clamp/skip propagation, schema-health probe batching, multi-entity parallel snapshot fetch constant, platform observability rollup caps, FCC duplicate snapshot elimination wiring, and observability list row shaping compactness.

## 9. Phase 7A.3 — security, permissions & sensitive data audit hardening

**Intent:** additive guardrails only — no auth redesign, no RLS rewrite, no broad permission matrix changes, and no removal of money-movement features.

- **Shared helpers:** `lib/blitzpay/blitzpay-payload-sanitization.ts` — `sanitizeBlitzpayObservabilityJsonForApi` (nested key drops for integrity hashes + leaf redaction for Stripe-like ids and raw digests), `shapeBlitzpayObservabilityFinancialEventListItem`, `shapeBlitzpayIdempotencyRecordListItem`, `shapeBlitzpayClaimsPayoutForApi`, `shapePortalBlitzpayPreparePaySuccessResponse` (portal POST success returns **`{ url }` only** so hosted-checkout redirects work without exposing Stripe object ids to the browser JSON).
- **Observability list APIs:** `GET …/blitzpay/observability/events` and `GET …/blitzpay/observability/idempotency` map rows through the shapers above — no full `event_hash` / `request_hash` in JSON; idempotency keys and provider-like references are truncated or redacted; nested `event_payload` / `metadata` are deep-sanitized.
- **Claims payouts:** `GET/POST …/blitzpay/claims/payouts` responses expose `payout_reference_recorded` + short `payout_reference_probe` instead of the full internal hash (staff UI updated accordingly).
- **Platform admin:** `GET /api/platform/blitzpay/observability-rollup` logs failures with `logBlitzpayServerFailure` and returns **`{ error: "load_failed" }`** without echoing `Error.message` (aligns with staff BlitzPay load error discipline).
- **Replay:** `POST …/observability/workflows/[workflowId]/replay` documents append-only `mark_replayed` governance; authorization remains `validateBlitzpayWorkflowReplayAuthorization` (owner/admin/platform allowlist).
- **Reporting recursion:** unchanged caps in `blitzpay-reporting-snapshot-nesting.ts` — tests assert depth-3 forced skips for observability enrichers.
- **Verification script:** `pnpm test:blitzpay-phase-7a3-security-hardening`.

## 10. Phase 7A.4 — performance, scale & reporting efficiency

**Intent:** optimization and audit only — no new BlitzPay modules, no permission changes, no removal of reporting fields, no Redis/workers, no financial math changes.

- **Reporting nesting:** `clampBlitzpayReportingNestingDepth` in `blitzpay-reporting-snapshot-nesting.ts` hard-clamps any caller-supplied depth to `[0, BLITZPAY_REPORTING_SNAPSHOT_MAX_NESTING_DEPTH]`; `fetchBlitzpayOrgReportingSnapshot` documents window-scoped reads and skip/depth behavior (re-exported from `blitzpay-reporting-snapshot.ts`).
- **FCC load:** `fetchBlitzpayOrgFinancialCommandCenter` runs **one** `computeBlitzpayCollectionsReporting` + **one** `fetchBlitzpayOrgReportingSnapshot` (with collections pulse), then passes `precomputedReporting` / `precomputedCollections` into `fetchBlitzpayOrgRevenueIntelligence` — removes a duplicate full snapshot pass versus the prior `Promise.all` pattern.
- **Phase 5A nested orgs:** `buildPhase5aLinkedOrgReportingSlice` fetches member-org snapshots in **batches** of `BLITZPAY_MULTI_ENTITY_SNAPSHOT_FETCH_CONCURRENCY` (still capped by `BLITZPAY_MULTI_ENTITY_MAX_DISTINCT_ORGS`, deterministic org order preserved).
- **Schema health:** `runBlitzpaySchemaHealthCheck` probes `CRITICAL_BLITZPAY_TABLES` in parallel batches of `BLITZPAY_SCHEMA_HEALTH_PROBE_CONCURRENCY` — same table coverage, lower wall-clock versus strictly sequential probes.
- **Platform observability rollup:** row cap and org sample cap are named constants (`BLITZPAY_PLATFORM_OBSERVABILITY_QUEUE_SNAPSHOT_ROW_CAP`, `BLITZPAY_PLATFORM_OBSERVABILITY_MAX_ORGS`) for documentation and tests.
- **FCC UI:** `blitzpay-financial-command-center-panel.tsx` caps rendered checklist lines, risk notes, scorecards, and command-center recommendation bullets to modest fixed maximums (payload unchanged; display-only).
- **SQL migrations:** none in 7A.4 (no new indexes in this pass; large-window ledger scans remain a documented future risk when `sinceIso` is absent).

## 11. Related documents

- [BLITZPAY_ARCHITECTURE.md](./BLITZPAY_ARCHITECTURE.md)
- [SCALE_READINESS_AUDIT.md](./SCALE_READINESS_AUDIT.md) §8.18–§8.20
- [STRIPE_PRODUCTION_READINESS.md](./STRIPE_PRODUCTION_READINESS.md) — BlitzPay Connect supplement
