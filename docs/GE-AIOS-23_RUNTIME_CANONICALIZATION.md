# GE-AIOS-23 — Production Canonicalization & Runtime Consolidation

**Status:** Complete (consolidation milestone)  
**QA marker:** `ge-aios-23-runtime-canonicalization-v1`

---

## Executive summary

GE-AIOS-23 establishes **one production execution path** per major capability. Future milestones must extend these owners — not introduce parallel engines, routes, or repositories.

---

## Canonical ownership matrix

| Capability | Canonical owner | Public interface | Deprecated |
|------------|-----------------|------------------|------------|
| Prospect research | `growth-lead-research-execution-service.ts` → `executeGrowthLeadProspectResearch` | `routeCanonicalProspectResearch`, `/research/run`, `/research/rebuild` | `runGrowthLeadResearch`, direct `runProspectResearch` from routes |
| Research persistence | `lib/growth/research/research-repository.ts` (`growth.research_runs`) | `finishProspectResearchRun`, `loadProspectIntelligenceBundle` | `lib/growth/research-repository.ts` writes (`growth.lead_research_runs`) |
| Lead admission | `evaluate-growth-lead-admission.ts` | `evaluateGrowthLeadAdmission` | Inline ICP rules in sources |
| Suppression read | `growth-canonical-suppression-read.ts` | `evaluateCanonicalRecipientSuppression`, `evaluatePreSendAllowed` | Direct dual checks outside pre-send |
| Suppression write | `compliance/suppression-engine.ts` + dual-write bridge | `applyDeliverySuppression`, `upsertGrowthSuppressionEntry` | Legacy-only writes without mirror |
| Mission runtime | `growth-objective-runtime-service.ts` | Objective cron scheduler | Mission framework for production ticks |
| Mission context | `loadGrowthLeadAdmissionContext` + `buildDecisionContext` | Admission + profile loaders | — |
| Decision engine | `run-decision-engine.ts` | Home workspace summary chain | `buildPrimaryDecisionFromDecisionEngine` (unused) |
| Work manager | `run-work-manager.ts` | Home daily plan | — |
| Revenue queue | `revenue-queue-projection.ts` | Leads hub projection | — |
| Command center | `ai-os-command-center-service.ts` | `GET /api/platform/growth/ai-os/command-center` | Duplicate admin/engagement shells (sections only) |
| Company evidence | `company-evidence-collector.ts` | `signals.companyEvidence_v22` | Separate crawl engines |
| Personalization context | `context-packet-builder.ts` | Reads prospect evidence bundle | — |

---

## Runtime routing diagram

```text
HTTP / Cron / Sales Loop / Ava Queue
        ↓
routeCanonicalProspectResearch (23)
        ↓
executeGrowthLeadProspectResearch (21A)
        ↓ admission gate + readiness
runProspectResearch (orchestrator)
        ↓
collectProspectCompanyEvidence (22)
        ↓
growth.research_runs.signals (canonical persistence)
        ↓
Revenue Queue / Personalization / Workflow bridge
```

---

## Allowed extension points

- Add fields to `GrowthResearchSignals.companyEvidence_v22`
- Add triggers to `GrowthLeadResearchTrigger`
- Add sections to AI OS Command Center read model
- Add objective stages to objectives runtime

## Do not extend by creating

- New research orchestrators
- New qualification engines
- New suppression tables without migration plan
- New command center APIs
- New mission runtime tick owners
