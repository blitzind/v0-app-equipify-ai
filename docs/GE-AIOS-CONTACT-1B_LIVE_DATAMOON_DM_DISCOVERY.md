# GE-AIOS-CONTACT-1B — Live DataMoon Decision-Maker Discovery Adapter

**Phase:** GE-AIOS-CONTACT-1B  
**Depends on:** GE-DATAMOON-1B audience workflow, SV1-4 DM orchestration, CONTACT-1A canonical contacts, AUTONOMY-1B wakes

---

## Why the stub remained active

`evaluateAndEnrichDecisionMakerForLead` defaulted to `defaultDatamoonDmDiscoveryAdapter`, which returned `{ records: [], providerCalled: false }` with no HTTP. Draft Factory called enrichment without injecting a live adapter, so production never built or polled a DataMoon audience for per-lead DM discovery.

Bulk audience import (`startDatamoonAudienceImportRun` / `pollDatamoonAudienceImportRun`) already existed for mission sourcing — it was never wired into the SV1-4 discovery adapter interface.

---

## Exact live DataMoon paths reused

| Capability | Path |
|------------|------|
| `buildAudience` | `lib/growth/providers/datamoon/datamoon-client.ts` |
| `fetchAudience` | same |
| Filter mapping | `datamoon-audience-filter-mapping.ts` → `resolveDatamoonProviderFiltersForImport` |
| Build audience ID | `datamoon-audience-import-build-id.ts` |
| Fetch payload | `datamoon-audience-import-fetch-payload.ts` |
| Run persistence | `growth.datamoon_audience_import_runs` via `datamoon-audience-import-repository.ts` |
| Config / enablement | `datamoon-config.ts` |

**No new provider client. No new table.** Lead-scoped DM discovery state is stored on audience import runs:

- `run_name` = `dm-discovery:{org}:{lead}:{fingerprint}`
- `provider_metadata.purpose` = `decision_maker_discovery`
- metadata holds org/lead/idempotency/next_poll/poll attempts/failure codes

---

## Live adapter selection

`resolveDatamoonDmDiscoveryAdapter({ runtime: "production", admin })`:

- **always** returns the live multi-step adapter + legacy bridge
- **throws** if production is given an injected/stub adapter
- cert/test may inject deterministic adapters

`evaluateAndEnrichDecisionMakerForLead` defaults to `useLiveDiscoveryAdapter: true` and resolves production live adapter when none is injected.

---

## Request lifecycle

```
authorize (SV1-1/SV1-2) → fingerprint → reuse in-flight OR buildAudience
→ persist run/audience id → status polling (bounded)
→ fetch records → CONTACT-1A normalize/persist → wake
```

Polling: min interval 30s, exponential backoff, max 40 polls, 24h max age. Resume via AUTONOMY-1B due tick (`pollDueDatamoonDmDiscoveriesForOrganization`) — **no new Vercel cron**.

---

## Draft Factory

`advanceDraftFactoryForLeadLive` actively calls `evaluateAndEnrichDecisionMakerForLead` when DM is missing or DM wakes arrive. Research is not rerun. Growth 5F remains the only draft generator; `pendingHumanApproval` + `transportBlocked` intact.

---

## Events

| Event | Role |
|-------|------|
| `growth.datamoon.person_requested` | Audience build started |
| `growth.datamoon.person_pending` | Awaiting poll |
| `growth.datamoon.person_completed` | DM selected / ready |
| `growth.datamoon.person_failed` | Terminal/retryable failure path |
| `growth.contact.*` | CONTACT-1A channel readiness |

Provenance until schema migration: DM `source=public_web`, `source_detail=datamoon:…`, `provider_name=datamoon`.

---

## Certification

```bash
pnpm test:ge-aios-contact-1b-live-datamoon-dm-discovery
pnpm test:ge-aios-contact-1a-datamoon-email-phone-completion
pnpm test:sv1-4-datamoon-decision-maker-enrichment
pnpm test:sv1-5a-production-durable-draft-factory
pnpm test:ge-aios-autonomy-1b-canonical-wake-wiring
pnpm test:sv1-1-resource-allocation-facade
pnpm test:sv1-2-portfolio-allocation-facade
```

## Remaining gaps

1. Live HTTP still requires `DATAMOON_PROVIDER_ENABLED` + keys + dry-run policy in production env (fail closed otherwise).
2. `lead_decision_makers.source` still lacks `datamoon` enum value (CONTACT-1A workaround retained).
3. Cached records in `provider_metadata` are bounded; large audiences rely on re-fetch by audience id.
4. Full Sales v1 end-to-end recert against live DataMoon credentials not part of this milestone.

**No commit, push, or deployment.**
