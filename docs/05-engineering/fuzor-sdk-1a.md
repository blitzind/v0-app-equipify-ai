# FUZOR-SDK-1A — Stable Platform SDK

**Milestone ID:** FUZOR-SDK-1A  
**Status:** Complete (local validation)  
**Effective:** 2026-07-22  
**Platform prerequisite:** Production Certified (FUZOR-PRODUCTION-CERTIFICATION-1A)  
**Scope:** First stable public SDK (`@fuzor/sdk`) for the production-certified platform

---

## Executive summary

| Item | Result |
|------|--------|
| SDK package | `@fuzor/sdk@0.1.0` |
| Architecture change | **None** — delegation only |
| Business logic in SDK | **None** |
| Platform ownership | **Unchanged** |
| Production rollout | Separate milestone |

**Lifecycle:** **Designed** · **Implemented** · **Validated (local)**

---

## SDK philosophy

The SDK is the **official public entry point** for products integrating with Fuzor. It:

- Re-exports intentional public APIs from `@fuzor/*` packages
- Organizes exports under stable namespaces
- Excludes test-only symbols (`*ForTests`)
- Does **not** implement persistence, workflows, or business policy

Products may migrate imports incrementally. Full codebase migration is **not** required for SDK-1A.

---

## Namespace design

```typescript
import {
  Identity,
  Configuration,
  Knowledge,
  Memory,
  Context,
  DecisionRecords,
  EventBus,
  Observability,
  Decisions,  // alias → DecisionRecords
  Events,     // alias → EventBus
} from "@fuzor/sdk"
```

| Namespace | Underlying package |
|-----------|-------------------|
| `Identity` | `@fuzor/identity` |
| `Configuration` | `@fuzor/configuration` |
| `Knowledge` | `@fuzor/knowledge` |
| `Memory` | `@fuzor/memory` |
| `Context` | `@fuzor/context` |
| `DecisionRecords` | `@fuzor/decision-records` |
| `EventBus` | `@fuzor/event-bus` |
| `Observability` | `@fuzor/observability` |

Subpath imports supported: `@fuzor/sdk/identity`, etc.

---

## Public API audit

### Included (public)

- All production service, repository, and type exports from platform package indexes
- QA markers, persistence contracts, schema health probes
- Registry catalogs and normalization helpers

### Excluded (internal / test-only)

| Symbol pattern | Reason |
|----------------|--------|
| `*ForTests` | Test harness only |
| `set*EnvReaderForTests` | Test injection |
| `clear*ForTests` | Test cleanup |
| `reset*ProbeCacheForTests` | Test cache reset |

Namespaces using `export *` (Identity, Context, DecisionRecords) contain no test-only exports in underlying packages.

---

## Export map

```
@fuzor/sdk
├── FUZOR_SDK_PHASE / FUZOR_SDK_VERSION / FUZOR_SDK_QA_MARKER
├── Identity          → @fuzor/identity
├── Configuration     → @fuzor/configuration (filtered)
├── Knowledge         → @fuzor/knowledge (filtered)
├── Memory            → @fuzor/memory (filtered)
├── Context           → @fuzor/context
├── DecisionRecords   → @fuzor/decision-records
├── Decisions         → alias
├── EventBus          → @fuzor/event-bus (filtered)
├── Events            → alias
└── Observability     → @fuzor/observability (filtered)
```

---

## Migration guidance

**Before (direct package import):**

```typescript
import { PLATFORM_ACTOR_AGENTS } from "@fuzor/identity"
import { publishPlatformEvent } from "@fuzor/event-bus"
```

**After (SDK namespace):**

```typescript
import { Identity, EventBus } from "@fuzor/sdk"

Identity.PLATFORM_ACTOR_AGENTS
EventBus.publishPlatformEvent(...)
```

Equipify compatibility wrappers remain valid — SDK adoption is incremental.

---

## Compatibility guarantees

1. SDK re-exports preserve reference equality with underlying packages
2. No wrapper logic unless required for export filtering
3. Semver applies to `@fuzor/sdk` as the stable surface
4. Internal `@fuzor/*` packages remain independently versioned
5. New platform packages can add namespaces without breaking existing consumers

---

## Versioning strategy

| Package | Role |
|---------|------|
| `@fuzor/sdk` | Stable public semver surface |
| `@fuzor/*` | Internal platform packages (0.1.0 during SDK-1A) |

Breaking changes to public SDK exports require `@fuzor/sdk` major version bump.

---

## Product validation

Representative sample: `lib/growth/qa/fuzor-sdk-1a-sample-consumer.ts`

| Product | Validation |
|---------|------------|
| Equipify | Identity catalog, runtime profile, knowledge search |
| Insideify | Memory org gate, decision registry |
| Future product | Event routing, context checksum, observability correlation |

Tenant isolation validated via SDK Knowledge namespace (ORG_A vs ORG_B).

---

## Validation

| Check | Result |
|-------|--------|
| `@fuzor/sdk` unit tests | PASS |
| `test:fuzor-sdk-1a-validation` | PASS |
| `test:fuzor-production-certification-1a-integrated-platform` | PASS |
| Fuzor monorepo build + typecheck | PASS |

---

## Lifecycle

| Stage | Status |
|-------|--------|
| Designed | Complete |
| Implemented | Complete |
| Validated (local) | Complete |
| Production rollout | Not started |
