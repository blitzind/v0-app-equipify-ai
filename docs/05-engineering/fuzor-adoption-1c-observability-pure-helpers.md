# Fuzor Adoption 1C — Observability Pure Helper Delegation

**Milestone ID:** FUZOR-ADOPTION-1C  
**Status:** Complete (local delegation)  
**Effective:** 2026-07-22  
**Scope:** Equipify pure observability helper delegation only

---

## Source audit

| Candidate | Classification | Decision |
|-----------|----------------|----------|
| `lib/blitzpay/blitzpay-schema-health-detect.ts` → `looksLikePostgrestMissingSchemaError` | Identical shared helper | **Delegated** |
| `lib/growth/schema-health/growth-schema-health-types.ts` → summarize/merge/warning/format | Identical shared helper | **Delegated** |
| `lib/growth/schema-health/growth-postgrest-table-probe.ts` | Networked runtime + local cache | **Deferred** (1C boundary) |
| `@fuzor/observability` → `isPlatformPostgrestMissingTableError`, `probePlatformSchemaObjects` | Networked runtime | **Deferred** |
| `@fuzor/observability` → diagnostic issue helpers | No active shared Equipify module | **Deferred** (provider-local diagnostics remain) |
| `@fuzor/observability` → correlation helpers | Event Bus ownership / cycle risk | **Deferred** (Event Bus milestone) |
| `@fuzor/observability` → legacy `{ ready }` probe | Capability-local adapters in AI OS packages | **Deferred** |
| Inline `42P01`/`PGRST205` checks in SMS/notification repos | Behaviorally different domain helpers | **Retained locally** |
| Capability schema catalogs (table lists, QA markers per feature) | Capability-owned | **Retained locally** |

### Selected scope

**Scope B — Error detection plus pure schema-health aggregation**

Diagnostic issue helpers (Scope C) excluded: Equipify has per-provider diagnostic types (e.g. PDL) without a shared ordering module equivalent to `@fuzor/observability/diagnostic-issue`.

---

## Prior / new authority

| Layer | Prior | After 1C |
|-------|-------|----------|
| PostgREST missing-schema heuristics | Local in `blitzpay-schema-health-detect.ts` | `@fuzor/observability` (`looksLikePostgrestMissingSchemaError`) |
| Pure schema-health aggregation | Local in `growth-schema-health-types.ts` | `@fuzor/observability` (platform summarize/merge/warning/format) |
| Equipify compatibility | Same module paths | Thin aliases/wrappers preserving Growth/BlitzPay export names |
| PostgREST table probes | `growth-postgrest-table-probe.ts` | Unchanged (local) |
| Health vocabularies (`ready`/`verified`/capability enums) | Per capability | Unchanged |

---

## Package consumption

```json
"@fuzor/observability": "file:../../fuzor/packages/observability"
```

| Check | Result |
|-------|--------|
| ESM resolution | Pass (`pnpm install`, parity script, Next.js build) |
| TypeScript declarations | Pass (via package `types` + `dist/*.d.ts`) |
| Next.js resolution | Pass (`next build` compile-only) |
| Fuzor → Equipify imports | None |
| Import-time env/network for delegated helpers | None (pure functions; env read only inside aggregation when building hints) |
| Production portability | **Blocked** (sibling `file:` dependency; Vercel cannot access) |

### Fuzor packaging correction (behavior-neutral)

Added `default` export condition to `packages/observability/package.json` (same pattern as `@fuzor/identity` for tsx/Node resolution).

Root barrel used; no subpath export required. Barrel re-exports networked modules but named-import tree-shaking limits bundled surface; no import-time probe side effects confirmed.

---

## Compatibility surfaces

### `lib/blitzpay/blitzpay-schema-health-detect.ts`

| Preserved export | Fuzor import | Pattern |
|------------------|--------------|---------|
| `BLITZPAY_SCHEMA_DRIFT_PUBLIC_MESSAGE` | — | Local constant (same string value) |
| `looksLikePostgrestMissingSchemaError` | `looksLikePostgrestMissingSchemaError` | Reference alias |

### `lib/growth/schema-health/growth-schema-health-types.ts`

| Preserved export | Fuzor import | Pattern |
|------------------|--------------|---------|
| `GROWTH_PROSPECT_SEARCH_INTELLIGENCE_SCHEMA_QA_MARKER` | — | Local QA marker |
| `GrowthSchemaHealthSummary` etc. | `PlatformSchema*` types | Type alias |
| `shouldShowGrowthSchemaHealthWarning` | `shouldShowPlatformSchemaHealthWarning` | Wrapper |
| `formatGrowthSchemaHealthNotice` | `formatPlatformSchemaHealthNotice` | Wrapper |
| `summarizeGrowthSchemaProbeResults` | `summarizePlatformSchemaProbeResults` | Wrapper |
| `mergeGrowthSchemaHealthSummaries` | `mergePlatformSchemaHealthSummaries` | Wrapper |

Consumers unchanged — all existing `@/lib/blitzpay/...` and `@/lib/growth/schema-health/...` import paths stable.

---

## Behavioral parity

**Behavioral differences:** None.

Verified for adopted groups:

- Error codes `42P01`, `42703`, `PGRST205`
- Schema-cache-stale and missing relation/column messages
- Non-schema errors (network, permission, generic)
- Invalid inputs (`null`, `undefined`, number, array) — both throw identically
- Aggregation: empty/all-detected/missing/uncertain/merge precedence/warning and env-hint ordering
- Reference identity: `looksLikePostgrestMissingSchemaError === platformLooksLikePostgrestMissingSchemaError`

---

## Client / server boundary

| Finding | Detail |
|---------|--------|
| Import path | `@fuzor/observability` root (named pure-helper imports only) |
| Subpath required? | **No** |
| Network probe modules | Not imported by compatibility modules |
| Supabase init from pure imports | **No** |
| Tracked-import rule | **Not changed** |

---

## Duplicate authority scan (post-delegation)

| Match | Classification |
|-------|----------------|
| `blitzpay-schema-health-detect.ts` | Equipify compatibility alias → Fuzor |
| `growth-schema-health-types.ts` | Equipify compatibility wrappers → Fuzor |
| `growth-postgrest-table-probe.ts` local classifiers | Behaviorally aligned but networked — legitimate specialization (deferred) |
| SMS / notification inline error codes | Domain-specific duplicate — retained |
| PDL provider diagnostics | Product-specific — retained |

---

## Tests and build

| Script | Result |
|--------|--------|
| `pnpm test:fuzor-adoption-1c-observability-helper-parity` | Pass |
| `pnpm test:fuzor-adoption-1b-identity-actor-catalog` | Pass |
| `pnpm test:blitzpay-schema-health` | Pass |
| `pnpm test:growth-native-dialer-schema-health` | Pass |
| `pnpm test:ge-aios-2b-ai-event-foundation` | Pass |
| Fuzor workspace tests | **154 pass** (unchanged total) |
| `pnpm check:tracked-imports` | Pass |
| `pnpm exec next build` (dummy public env) | Pass (compile-only; not production env gate) |
| `pnpm exec tsc --noEmit` | Not used — OOM in this environment; compile validated via `next build` |
| `.env.local` | Not used |

---

## Rollback (1C only)

1. Restore prior implementations in `lib/blitzpay/blitzpay-schema-health-detect.ts` and `lib/growth/schema-health/growth-schema-health-types.ts`.
2. Remove `@fuzor/observability` from `package.json` and restore `pnpm-lock.yaml`.
3. Remove `scripts/test-fuzor-adoption-1c-observability-helper-parity.ts` and package script.
4. Revert `packages/observability/package.json` `default` export if desired.
5. Run schema-health tests and `next build` compile validation.
6. Do **not** roll back 1A/1B Identity adoption.

---

## Next milestone

**FUZOR-ADOPTION-1D — Configuration Constants Delegation** may begin locally. No blockers from 1C beyond the existing production portability limitation.

Recommended batch commit: 1A + 1B + 1C (+ optional 1D) in one scoped Equipify commit.

---

## Inventory recommendation (do not auto-update)

| Capability | Recommended status |
|------------|-------------------|
| `@fuzor/observability` | Extracted |
| Equipify Observability pure helpers | Adopted locally |
| Equipify capability health probes | Planned |
| Platform health aggregation | Planned |
| Product diagnostics | Planned |
| Logging / metrics / tracing / alerting | Planned |
| Production validation | Not Validated |
| Equipify compatibility modules | Not Retired |

If lifecycle governance requires production validation before Adopted, classify Equipify pure helpers as **Planned** with the same local-delegation interpretation.
