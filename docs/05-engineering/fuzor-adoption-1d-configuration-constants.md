# Fuzor Adoption 1D — Configuration Constants Delegation

**Milestone ID:** FUZOR-ADOPTION-1D  
**Status:** Complete (local delegation)  
**Effective:** 2026-07-22  
**Scope:** Equipify static configuration contract delegation only

---

## Source audit

| Candidate | Classification | Decision |
|-----------|----------------|----------|
| `growth-runtime-guardrail-config.ts` | Identical static shared contract | **Delegated** |
| `growth-adaptive-calibration-config-registry.ts` | Identical static registry | **Delegated** |
| `growth-adaptive-calibration-config-resolver.ts` | Pure deterministic resolver (no DB/env) | **Delegated** |
| `growth-feature-registry.ts` | Identical static registry | **Delegated** |
| `growth-runtime-profile.ts` | Runtime env profile resolver | **Deferred** |
| `growth-adaptive-calibration-apply-types.ts` (product types/events) | Product-specific projection | **Retained locally** |
| `growth-runtime-kill-switch-service.ts` | Database-backed runtime service | **Deferred** |
| `platform-enablement` env resolvers | Runtime environment resolver | **Deferred** |
| Pure env parsers | No shared Equipify parser module found | **Not adopted** |
| Autonomy / approval / outbound authorization | Product policy | **Retained locally** |

### Selected scope

**Scope C+ — Guardrails, calibration contracts, and feature registry**

Includes calibration resolver helpers (deterministic merge/weight resolution with test-only in-memory overrides). Excludes runtime profile selection, kill-switch persistence, and environment enablement resolution.

---

## Prior / new authority

| Layer | Prior | After 1D |
|-------|-------|----------|
| Runtime guardrail limits, budgets, kill-switch defaults | Local constants in `growth-runtime-guardrail-config.ts` | `@fuzor/configuration` |
| Calibration default registry | Local in `growth-adaptive-calibration-config-registry.ts` | `@fuzor/configuration` |
| Calibration effective-config resolution | Local in `growth-adaptive-calibration-config-resolver.ts` | `@fuzor/configuration` |
| Feature registry (Phase 8G) | Local in `growth-feature-registry.ts` | `@fuzor/configuration` |
| Kill-switch service / persistence | Equipify local | Unchanged |
| Runtime profile env resolution | Equipify local | Unchanged |
| Policy / authorization | Equipify local | Unchanged |

---

## Package consumption

```json
"@fuzor/configuration": "file:../../fuzor/packages/configuration"
```

| Check | Result |
|-------|--------|
| ESM resolution | Pass |
| TypeScript declarations | Pass |
| Next.js compile validation | Pass (`next build` with dummy public env) |
| Fuzor → Equipify imports | None |
| Import-time DB/env for delegated exports | None |
| Production portability | **Blocked** (sibling `file:` dependency) |

### Fuzor packaging correction (behavior-neutral)

Added `default` export condition to `packages/configuration/package.json` (tsx/Node resolution parity with Identity/Observability).

Root barrel used; no subpath export required.

---

## Compatibility surfaces

### `lib/growth/runtime-guardrails/growth-runtime-guardrail-config.ts`

All guardrail constants, budget cap tables, kill-switch default map, and pure helpers (`getBudgetCapForResource`, `getUserBudgetCapForResource`, `truncateSearchResults`) delegate via reference aliases or thin wrappers. Growth-prefixed export names preserved.

### `lib/growth/aios/learning/growth-adaptive-calibration-config-registry.ts`

`GROWTH_CALIBRATION_DEFAULT_CONFIG`, `getDefaultCalibrationConfig`, `resolveCalibrationConfigKey` delegate to Fuzor registry exports.

### `lib/growth/aios/learning/growth-adaptive-calibration-config-resolver.ts`

All resolver helpers delegate to Fuzor (`resolveEffectiveCalibrationConfig`, weight/engine helpers, test memory hooks).

### `lib/growth/runtime/growth-feature-registry.ts`

Registry object, keys, version, and list/get helpers delegate to Fuzor feature registry exports.

---

## Behavioral parity

**Behavioral differences:** None.

Verified via adoption parity test and existing guardrail/calibration certification scripts.

---

## Policy and runtime boundaries

| Boundary | Status |
|----------|--------|
| Approval / authorization | Not moved |
| Kill-switch persistence service | Not moved |
| Runtime profile env resolver | Not moved |
| Outbound / autonomy behavior | Unchanged |
| Organization entitlements | Not moved |

---

## Client / server boundary

Delegated imports are client-safe static contracts and pure functions. Kill-switch service and env resolvers are not imported by compatibility modules.

---

## Tests and build

| Script | Result |
|--------|--------|
| `pnpm test:fuzor-adoption-1d-configuration-constant-parity` | Pass |
| `pnpm test:fuzor-adoption-1c-observability-helper-parity` | Pass |
| `pnpm test:fuzor-adoption-1b-identity-actor-catalog` | Pass |
| `pnpm test:growth-runtime-guardrails` | Pass (updated to assert exported keys, not source literals) |
| `pnpm test:ge-ai-3d-prod-3-controlled-adaptive-calibration-apply` | Pass |
| Fuzor workspace tests | 154 pass |
| `pnpm check:tracked-imports` | Pass |
| `next build` (compile-only) | Pass |
| `.env.local` | Not used |

---

## Rollback (1D only)

1. Restore prior implementations in the four compatibility modules.
2. Remove `@fuzor/configuration` from `package.json` and restore lockfile.
3. Remove 1D parity test/script and documentation.
4. Revert guardrails regression test if desired.
5. Revert Fuzor `default` export if desired.
6. Do **not** roll back 1A–1C.

---

## Next milestone

**FUZOR-ADOPTION-1E — Knowledge Center Service Delegation** requires a fresh prompt. Blockers: runtime service coupling, persistence, organization resolution, server/client boundaries, production portability.

Recommend committing 1A–1D as one local batch before starting 1E.

---

## Inventory recommendation (do not auto-update)

| Capability | Recommended status |
|------------|-------------------|
| `@fuzor/configuration` | Extracted |
| Equipify static configuration contracts | Adopted locally |
| Runtime configuration resolution | Planned |
| Kill-switch service | Planned |
| Organization enablement | Planned |
| Authorization and entitlements | Planned |
| Production validation | Not Validated |
| Equipify compatibility modules | Not Retired |
