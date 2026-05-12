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
- Deterministic **demo metric presets** for believable fixtures (`lib/blitzpay/blitzpay-demo-presets.ts`) — no randomness, no fake PII; **Phase 7A.5** expands archetypes, FCC showcase snapshots, activity feeds, and bounded coherence checks for sales-ready narratives (still in-memory; no seed bloat). **Phase 7A.6** expands **Stripe live readiness** helpers in `blitzpay-stripe-readiness-guards.ts`, adds an additive **Stripe live readiness** strip on the FCC payload, and tightens **platform BlitzPay Ops** summaries (bounded counts + safe load errors) — **no autonomous remediation**.

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
- **`lib/billing/blitzpay-plan-metadata.ts`** — human positioning per tier (`BLITZPAY_PLAN_METADATA`, `getBlitzpayPlanMetadata`). **Phase 7A.7** extends rows with **best-for tags**, **operational sophistication**, **setup complexity**, **onboarding readiness bands**, **commonly enabled together** hints, and **visible module** lists for collateral-weighted histograms.
- **`lib/billing/blitzpay-commercial-packaging.ts`** — `getBlitzpayCommercialCategory`, `getBlitzpayCommercialLane`, `getBlitzpayUpgradeMetadata`, `getBlitzpayPlanPackagingFootnote`, `blitzpayModuleMaturityStage`, `BLITZPAY_FUTURE_PRICING_MATRIX_PLACEHOLDER` (structure only). **Phase 7A.7** adds **commercial module packaging categories** (`MODULE_COMMERCIAL_CATEGORY`, ordered labels), **tier operational posture** (`blitzpayCommercialTierOperationalPosture`), **bounded histogram helpers** (`summarizeBlitzpayCommercialPlanSample`, onboarding band + maturity posture samples, collateral-weighted packaging skew, `buildBlitzpayPlatformCommercialPackagingHistogram`), **positioning snippets** (`buildBlitzpayCommercialAwarenessSnippet`, `buildBlitzpayCommercialPositioningHint`, `buildBlitzpayUpgradeRecommendationSummary`), and **`listBlitzpayCommercialModuleTriadsForSales`** — all display/reference only.
- **Entitlement API (server-safe, permissive default):**
  - `canAccessBlitzpayFeature(plan, feature, { enforceTierGates? })` — returns **`true` by default**; when `enforceTierGates: true`, compares tier ranks to the feature’s `minimumPackagingTier` (for future Route Handler guards / tests).
  - `getBlitzpayPlanFeatures(tier)` — feature keys included at/under a packaging tier.
  - `getBlitzpayRecommendedTier(featureKeys)` — smallest tier covering all listed features.
  - `buildBlitzpayEntitlementAuditSnapshot(plan, options?)` — deterministic audit DTO (modules/features that *would* gate if enforcement were on).
- **Re-exports:** `blitzpay-entitlements.ts` also re-exports selected packaging/plan helpers for discoverability.

### 3.3 Rollout & billing boundaries

- **No** Stripe subscription coupling, **no** paywalls, **no** new org billing enforcement in Phase 7A.2.
- **Soft UI:** `components/blitzpay/blitzpay-plan-awareness-strip.tsx` — subtle footnote + link to Settings → Billing; uses `useBillingAccessOptional` so **platform admin** surfaces stay safe without tenant billing context (platform copy only on `platform_blitzpay_ops`). **Phase 7A.7:** additive **secondary positioning line** (`buildBlitzpayCommercialPositioningHint`) — still informational, not a paywall.
- **Future:** flip `enforceTierGates` in server guards only after legal/product sign-off; keep org permission checks as the primary access control.

## 4. Operational readiness strip (FCC)

- **Server:** `lib/blitzpay/blitzpay-operational-readiness.ts` — `computeBlitzpayOperationalReadinessStrip` (deterministic score from bounded reporting tiles).
- **Composer:** `lib/blitzpay/blitzpay-financial-command-center.ts` adds `operationalReadiness` to the payload returned by `GET …/blitzpay/financial-command-center`.
- **UI:** `components/blitzpay/blitzpay-financial-command-center-panel.tsx` renders an additive card when the field is present.

## 5. Mobile layout helpers

- `lib/blitzpay/blitzpay-mobile-layout.ts` — shared class strings (`BLITZPAY_MOBILE_FIN_STACK`, `BLITZPAY_TABLE_SAFE_WRAP`, `BLITZPAY_TOUCH_TARGET`) for staff BlitzPay panels.

## 6. Stripe / Connect validation helpers

- `lib/blitzpay/blitzpay-stripe-readiness-guards.ts` — `scanJsonForStripeLikeTokens` (client/QA JSON leak scan), `blitzpayConnectWebhookReadinessNotes`, **Phase 7A.6** helpers (`parseStripeSecretKeyMode`, `parseStripePublishableKeyMode`, `isLikelyStripeWebhookEventId`, `blitzpayWebhookDuplicateDeliveryBody`, `inferStripeWebhookLivemodeAlignment`, `sanitizeBlitzpayOperationalLogDetail`, `buildBlitzpayStripeLiveReadinessStrip`, `summarizeBlitzpayWebhookOperationalStatus`). Complements `docs/STRIPE_PRODUCTION_READINESS.md`; does not call Stripe.

## 7. Security audit (Phase 7A scope)

- Confirmed pattern: BlitzPay org Route Handlers use `requireAnyOrgPermission` / `requireOrgPermission` + UUID param validation + `blitzpaySchemaGuardNextResponse` where established; observability **replay** adds `validateBlitzpayWorkflowReplayAuthorization` (owner/admin/platform).
- Phase 7A does **not** change RLS policies or permission matrices — documentation only calls out periodic re-audit when new routes ship.
- **Phase 7A.3** adds shared payload shaping/redaction helpers (`lib/blitzpay/blitzpay-payload-sanitization.ts`) for observability lists, claims payout APIs, portal hosted-checkout success JSON, and safer platform rollup errors — see §9.

## 8. Tests

- `pnpm test:blitzpay-phase-7a-hardening` — `scripts/test-blitzpay-phase-7a-hardening.ts` covers nesting skips, entitlement permissive defaults, packaging-preview `blitzpayModuleWouldBeGatedAtTier`, token scan helper, replay auth helper, deterministic ordering, and schema-health script presence.
- `pnpm test:blitzpay-phase-7a2-entitlements` — `scripts/test-blitzpay-phase-7a2-entitlements.ts` covers catalog uniqueness, enforced vs permissive `canAccessBlitzpayFeature`, plan feature sets, recommended tier, upgrade metadata, commercial category labels, platform-admin classification, and audit snapshots.
- `pnpm test:blitzpay-phase-7a3-security-hardening` — `scripts/test-blitzpay-phase-7a3-security-hardening.ts` covers payload shaping (observability, idempotency, claims payouts, portal prepare-pay), replay route wiring assertions, platform rollup safe errors, technician intent filtering, and staff `load_failed` JSON shape.
- `pnpm test:blitzpay-phase-7a4-performance` — `scripts/test-blitzpay-phase-7a4-performance.ts` covers nesting clamp/skip propagation, schema-health probe batching, multi-entity parallel snapshot fetch constant, platform observability rollup caps, FCC duplicate snapshot elimination wiring, and observability list row shaping compactness.
- `pnpm test:blitzpay-phase-7a5-demo-data` — `scripts/test-blitzpay-phase-7a5-demo-data.ts` covers deterministic demo presets, bounded activity feeds, showcase metric human labels, fixture coherence rules, mixed operational-readiness inputs, and module health tone diversity.
- `pnpm test:blitzpay-phase-7a6-stripe-live-readiness` — `scripts/test-blitzpay-phase-7a6-stripe-live-readiness.ts` covers Stripe key-mode parsing, webhook id shape checks, duplicate-delivery contract, livemode alignment hints, log sanitization, deterministic `buildBlitzpayStripeLiveReadinessStrip`, platform webhook narrative helper, and FCC/platform wiring strings.
- `pnpm test:blitzpay-phase-7a7-commercialization` — `scripts/test-blitzpay-phase-7a7-commercialization.ts` covers deterministic plan metadata, module packaging category coverage, upgrade recommendation ordering, maturity progression helpers, onboarding readiness histograms, and permissive entitlements (no hard-lock drift).

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

## 11. Phase 7A.5 — demo data, showcase environment & sales readiness

**Intent:** strengthen **sales and demo** storytelling with **deterministic**, **bounded** sample narratives across BlitzPay modules — **without** weakening tenant isolation, **without** fake production PII, **without** uncontrolled randomness, **without** hidden demo-only business logic, **without** changing financial calculations, permissions, or RLS, and **without** giant DB seed payloads.

**Module:** `lib/blitzpay/blitzpay-demo-presets.ts`

- **Org archetypes:** `small_contractor`, `growing_field_service`, `mature_multi_department`, `franchise_style_network` — each maps to a **coherent** operational + FCC-style metric bundle (treasury, AP, payroll signals, mobile and observability rates, procurement and claims exposure, AI and revenue-optimization scores).
- **Human copy:** `describeBlitzpayDemoOrgArchetype`, `getBlitzpayDemoScenarioCard`, `getBlitzpayDemoActivityFeedLines` — operator language only on exported strings (showcase labels map internal keys through `getBlitzpayDemoShowcaseMetricLabel` and never echo raw key text).
- **FCC showcase snapshot:** `buildBlitzpayDemoFccShowcaseSnapshot` plus `validateBlitzpayDemoFixtureCoherence` — enforces modest **claims versus AP**, bounded **reference day offsets**, and **integer non-negative** currency fields for believable screenshots.
- **Operational readiness demo inputs:** `buildBlitzpayDemoOperationalReadinessInputs` feeds the existing `computeBlitzpayOperationalReadinessStrip` for **mixed** comfort scores (not uniformly “green”).
- **Module health tags:** `getBlitzpayDemoModuleHealthTags` returns a **mix** of `healthy`, `attention`, and `elevated` tones for narrative balance.

**Performance safety:** fixed maxima (`BLITZPAY_DEMO_MAX_ACTIVITY_FEED_LINES`, `BLITZPAY_DEMO_MAX_SCENARIO_BULLETS`, `BLITZPAY_DEMO_MAX_REFERENCE_DAY_OFFSETS`); no UUID generation; no bulk writes — presets are **in-memory** fixtures until an explicit product seed path opts in.

**UI polish (bounded):** clearer **empty-state** copy on mobile financial ops and enterprise observability panels where lists are legitimately empty — still honest about **bounded windows**, not placeholder lorem.

**Regression test:** `pnpm test:blitzpay-phase-7a5-demo-data`.

## 12. Phase 7A.6 — Stripe live readiness, webhook safety & production verification

**Intent:** operational **safety and visibility** for real-world Connect payments — **without** new Stripe products, **without** autonomous remediation, **without** background worker infrastructure, and **without** weakening idempotent webhook protections.

**Guards module:** `lib/blitzpay/blitzpay-stripe-readiness-guards.ts`

- **Webhook safety helpers:** `isLikelyStripeWebhookEventId`, `blitzpayWebhookDuplicateDeliveryBody`, `inferStripeWebhookLivemodeAlignment` (advisory), `sanitizeBlitzpayOperationalLogDetail` (redacts `whsec_`, `sk_*`, `pk_*`, `rk_*` substrings; truncates), expanded `blitzpayConnectWebhookReadinessNotes`.
- **FCC additive strip:** `buildBlitzpayStripeLiveReadinessStrip` — deterministic, **no secrets**, surfaces host API mode vs publishable key mode, webhook signing presence, Connect onboarding headline, bounded payout/dispute/ACH advisory lines, and webhook dedupe narrative. Composed in `fetchBlitzpayOrgFinancialCommandCenter` and rendered in `BlitzpayFinancialCommandCenterPanel`.
- **Platform BlitzPay Ops:** `fetchBlitzpayPlatformOperationsSummary` adds bounded counts (webhook inbox **pending**, orgs with **charges on / payouts off**, Connect **onboarding attention** states), host `STRIPE_SECRET_KEY` **mode label only**, BlitzPay webhook secret presence, `summarizeBlitzpayWebhookOperationalStatus`, critical alerts when **live policy** conflicts with **test keys** or **missing** `STRIPE_BLITZPAY_WEBHOOK_SECRET` under live keys; `GET /api/platform/blitzpay/operations` returns stable JSON on load failure (no raw exception text).

**Regression test:** `pnpm test:blitzpay-phase-7a6-stripe-live-readiness`.

## 13. Phase 7A.7 — commercial packaging, upgrade readiness & positioning infrastructure

**Intent:** make BlitzPay **packageable and explainable** as a contractor financial operating system with clear **maturity levels** — **without** Stripe subscription products for BlitzPay modules, **without** hard feature lockout, **without** checkout flows, **without** navigation redesigns, and **without** noisy upsell banners.

**Plan & onboarding metadata:** `lib/billing/blitzpay-plan-metadata.ts` — per-tier **best-for** tags, **operational sophistication** labels, **setup complexity** labels, **onboarding readiness bands** (quick → enterprise program), **commonly enabled together** hints, **upgrade path summaries**, and **visible module** lists used for collateral-weighted packaging skew.

**Commercial packaging module:** `lib/billing/blitzpay-commercial-packaging.ts`

- **Module packaging categories:** deterministic `MODULE_COMMERCIAL_CATEGORY` map + ordered `BLITZPAY_COMMERCIAL_MODULE_PACKAGING_CATEGORY_ORDER` + human labels (`getBlitzpayModulePackagingCategoryLabel`, `describeBlitzpayCommercialModulePackagingCategory`).
- **Upgrade & sales helpers:** `getBlitzpayNextPackagingTier`, `buildBlitzpayUpgradeRecommendationSummary`, `getBlitzpayUpgradeMetadata` (includes **module packaging category** label for future comparison tables), `listBlitzpayCommercialModuleTriadsForSales`, `assertBlitzpayModulePackagingCategoryCoverage` (test hook).
- **Onboarding & maturity samples:** `summarizeBlitzpayOnboardingReadinessBandSample`, `summarizeBlitzpayOperationalMaturityPostureSample` (tier-derived **launch → govern** posture, distinct from `blitzpayModuleMaturityStage` on module classification), `summarizeBlitzpayModulePackagingCategorySkewSample`, `buildBlitzpayPlatformCommercialPackagingHistogram` — all **bounded** inputs, **aggregate-only** outputs.
- **Staff surfaces:** `buildBlitzpayCommercialAwarenessSnippet` powers `BlitzpayPlanAwarenessStrip` (primary footnote + subtle secondary line).

**Platform ops:** `lib/blitzpay/blitzpay-platform-operations.ts` — `fetchBlitzpayPlatformOperationsSummary` attaches `commercialPackagingHistogram` built from up to **800** `organization_subscriptions.plan_id` rows (`active` / `trialing` only) — **no org ids** in the DTO. `components/admin/blitzpay-operations-content.tsx` renders a compact **Commercial packaging sample** card.

**Versioning:** `lib/blitzpay/blitzpay-commercial-readiness.ts` (`BLITZPAY_COMMERCIAL_METADATA_VERSION`) and `lib/billing/blitzpay-entitlements.ts` (`BLITZPAY_ENTITLEMENTS_FOUNDATION_VERSION`) advance to **`7a.7`** so audit strips and future matrices align.

**Regression test:** `pnpm test:blitzpay-phase-7a7-commercialization`.

## 14. Related documents

- [BLITZPAY_ARCHITECTURE.md](./BLITZPAY_ARCHITECTURE.md)
- [SCALE_READINESS_AUDIT.md](./SCALE_READINESS_AUDIT.md) §8.18–§8.22
- [STRIPE_PRODUCTION_READINESS.md](./STRIPE_PRODUCTION_READINESS.md) — BlitzPay Connect supplement
