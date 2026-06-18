# Growth Runtime Feature Registry (Phase 8G)

Phase 8G introduces a centralized runtime feature registry for Growth Engine. This phase is **infrastructure only** — no routes, UI, polling, or API behavior changes until Phase 8H wiring.

Growth Engine is Equipify’s internal autonomous sales system (not a customer-facing product). The registry supports progressive cold storage: hide instead of remove, disable instead of delete, lazy load instead of mount.

---

## Registry location

| Artifact | Path |
| --- | --- |
| Feature registry (types + entries) | `lib/growth/runtime/growth-feature-registry.ts` |
| Runtime profile selectors | `lib/growth/runtime/growth-runtime-profile.ts` |
| Helper utilities | `lib/growth/runtime/growth-feature-helpers.ts` |
| This document | `docs/GROWTH_RUNTIME_FEATURE_REGISTRY_8G.md` |

Version marker: `GROWTH_FEATURE_REGISTRY_VERSION = "8g.1"`.

---

## Feature modes

| Mode | Meaning | Intended future usage |
| --- | --- | --- |
| `active` | Core operator workflow | Always mounted; background jobs and polling allowed |
| `cold_hidden_disabled` | Cold storage | Hidden from default nav; disabled; admin-only visibility optional |
| `lazy_on_demand` | On-demand | Registered and reachable; no prefetch/polling until operator opens surface |

Each entry also carries:

- `enabled` — catalog enable flag (Tier 2 entries are `false` by design)
- `adminOnly` — optional; Tier 2 cold features require admin context when surfaced
- `tier` — packaging tier (1, 2, or 3)
- `label` — human-readable name

---

## Runtime profiles

Profiles describe how tiers behave once enforcement is enabled. Resolved via `resolveGrowthRuntimeProfileId()`.

| Profile | Default when | Purpose |
| --- | --- | --- |
| `operator_minimal` | Vercel **production** | Core workflow only; Tier 2 hidden; Tier 3 lazy |
| `full_admin` | Explicit override | Tier 2 visible to admins but still disabled in registry |
| `development_all` | Non-production default | All tiers reachable for builder QA |

Override with environment variable:

```bash
GROWTH_RUNTIME_PROFILE=full_admin   # operator_minimal | full_admin | development_all
```

**Phase 8G:** profile resolution is active; **enforcement is not**. Helpers default to permissive behavior (`enforceProfile` omitted → no gating).

---

## Tier 1 — Active (`mode: "active"`, `enabled: true`)

Core outbound operator workflow. Always-on in `operator_minimal`.

| Key | Label |
| --- | --- |
| `prospectSearch` | Prospect search |
| `apolloImport` | Apollo import |
| `canonicalCompanies` | Canonical companies |
| `canonicalPersons` | Canonical persons |
| `companyIntelligence` | Company intelligence |
| `buyingCommittee` | Buying committee intelligence |
| `leadResearch` | Lead research |
| `accountPlaybooks` | Account playbooks |
| `personalization` | Personalization |
| `emailGeneration` | Email generation |
| `smsGeneration` | SMS generation |
| `voiceDropGeneration` | Voice drop generation |
| `sequenceExecution` | Sequence execution |
| `scheduler` | Sequence scheduler |
| `unifiedInbox` | Unified inbox |
| `timeline` | Activity timeline |
| `notifications` | Operator notifications |
| `replyIntelligence` | Reply intelligence |
| `engagementScoring` | Engagement scoring |
| `nextBestAction` | Next best action |
| `meetingRecommendations` | Meeting recommendations |
| `humanApprovalEngine` | Human approval engine |

---

## Tier 2 — Hidden + disabled (`mode: "cold_hidden_disabled"`, `enabled: false`, `adminOnly: true`)

Non-essential surfaces targeted for cold storage. Hidden in `operator_minimal`; admin-visible under `full_admin`.

| Key | Label |
| --- | --- |
| `campaignBuilder` | Campaign builder |
| `sequencePreviewStudio` | Sequence preview studio |
| `agentOrchestrationDashboard` | Agent orchestration dashboard |
| `humanInterventionDashboard` | Human intervention dashboard |
| `diagnosticsDashboards` | Diagnostics dashboards |
| `realtimeEventBus` | Realtime event bus |
| `executionGraphs` | Execution graphs |
| `workflowSummaryAutofetch` | Workflow summary autofetch |

---

## Tier 3 — On-demand (`mode: "lazy_on_demand"`, `enabled: true`)

Registered capabilities that should not prefetch or poll until explicitly opened.

| Key | Label |
| --- | --- |
| `conversationalPlaybooks` | Conversational playbooks |
| `smartFollowUpPolicies` | Smart follow-up policies |
| `sequenceExitCandidates` | Sequence exit candidates |
| `revenueCommandCenter` | Revenue command center |
| `forecastEvidence` | Forecast evidence |
| `executionPlans` | Execution plans |
| `bookingIntelligence` | Booking intelligence |
| `opportunityRecommendations` | Opportunity recommendations |

---

## Helper APIs

Import from `lib/growth/runtime/growth-feature-helpers.ts`:

| Helper | Behavior |
| --- | --- |
| `isGrowthFeatureEnabled(key)` | Registry `enabled` flag |
| `isGrowthFeatureActive(key)` | `mode === "active"` |
| `isGrowthFeatureCold(key)` | `mode === "cold_hidden_disabled"` |
| `isGrowthFeatureLazy(key)` | `mode === "lazy_on_demand"` |
| `isGrowthFeatureAdminOnly(key)` | Registry `adminOnly` |
| `isGrowthFeatureEffectiveEnabled(key, options?)` | Permissive (`true`) unless `enforceProfile: true` |
| `getGrowthFeatureEffectiveMode(key, options?)` | Registry mode unless enforcement on |
| `getGrowthFeatureEffectiveConfig(key, options?)` | Merged view for diagnostics |
| `summarizeGrowthFeatureRuntime(options?)` | Profile + enforcement snapshot |

Registry accessors in `growth-feature-registry.ts`:

- `getGrowthFeatureConfig(key)`
- `listGrowthFeaturesByTier(tier)`
- `listGrowthFeaturesByMode(mode)`

Profile accessors in `growth-runtime-profile.ts`:

- `resolveGrowthRuntimeProfileId()`
- `getGrowthRuntimeProfile(id?)`
- `listGrowthRuntimeProfileIds()`

All helpers are server-safe and client-safe (no `server-only` import).

---

## Intended future usage (Phase 8H+)

1. **Navigation** — filter Growth workspace nav using `isGrowthFeatureEffectiveEnabled` with `enforceProfile: true` in production.
2. **Route guards** — API routes for Tier 2 return 404/403 for non-admin when cold.
3. **Lazy panels** — Tier 3 surfaces mount only after operator interaction; suppress dashboard autofetch via `workflowSummaryAutofetch` and related keys.
4. **Cron / polling** — scheduler and background jobs consult profile `tierPolicy.backgroundActive`.
5. **Admin override** — `full_admin` profile + platform role for diagnostics without re-enabling globally.

**No migration in Phase 8G.** Existing kill switches (`GROWTH_ENGINE_ENABLED`, etc.) remain authoritative until 8H integrates with this registry.

---

## Phase 8G acceptance

- [x] Single centralized registry
- [x] All major features registered (38 keys)
- [x] Helper utilities exist
- [x] Runtime profiles exist (`operator_minimal` production default)
- [x] No code removed, disabled, or rewired
- [x] Documentation only — no enforcement migration
