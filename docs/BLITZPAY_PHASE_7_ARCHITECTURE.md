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

## 8. Tests

- `pnpm test:blitzpay-phase-7a-hardening` — `scripts/test-blitzpay-phase-7a-hardening.ts` covers nesting skips, entitlement permissive defaults, packaging-preview `blitzpayModuleWouldBeGatedAtTier`, token scan helper, replay auth helper, deterministic ordering, and schema-health script presence.
- `pnpm test:blitzpay-phase-7a2-entitlements` — `scripts/test-blitzpay-phase-7a2-entitlements.ts` covers catalog uniqueness, enforced vs permissive `canAccessBlitzpayFeature`, plan feature sets, recommended tier, upgrade metadata, commercial category labels, platform-admin classification, and audit snapshots.

## 9. Related documents

- [BLITZPAY_ARCHITECTURE.md](./BLITZPAY_ARCHITECTURE.md)
- [SCALE_READINESS_AUDIT.md](./SCALE_READINESS_AUDIT.md) §8.18
- [STRIPE_PRODUCTION_READINESS.md](./STRIPE_PRODUCTION_READINESS.md) — BlitzPay Connect supplement
