# GE-AIOS-2H — Infrastructure Audit

**Phase:** GE-AIOS-2H — Decision Engine Foundation  
**Date:** 2026-06-25

---

## Existing systems audited

| System | Location | Relationship |
|--------|----------|--------------|
| Next Best Action | `lib/growth/next-best-action.ts` | **Not modified** — legacy lead NBA |
| Unified NBA resolver | `lib/growth/operator-assist/nba-resolver.ts` | **Not modified** |
| Inbox recommendation orchestrator | `lib/growth/inbox/inbox-recommendation-orchestrator.ts` | **Not modified** |
| Deal / call score engines | `deal-score-engine.ts`, `call-score-engine.ts` | Pattern reference for confidence bands only |
| Runtime guardrails | `lib/growth/runtime-guardrails/*` | **Not modified** |
| Decision Records (2D) | `ai-decision-record-service.ts` | **Reused** for immutable record creation |
| Memory Registry (2F) | `ai-memory-registry-repository.ts` | **Reused** for evidence via memory refs |
| Decision Gate (2E) | `ai-decision-gate-service.ts` | Unchanged — still enforced at execute |

---

## Reuse strategy

- **Decision key registry (2D)** — owner agent + canonical keys
- **createAiDecisionRecord** — immutable record + WO linkage + events
- **Memory Registry fetch** — evidence from `memory_refs` without duplicating stores
- **Constitutional confidence bands (§13.2)** — deterministic rule labels, not LLM scores

---

## Evaluation model (infrastructure)

1. Resolve decision key from Work Order type binding
2. Collect evidence from WO payload + Memory Registry refs (rule-based collector)
3. Calculate confidence, risk, cost (deterministic calculators)
4. Build recommendation (proceed / defer)
5. Create Decision Record (including `insufficient_evidence` when below threshold)
6. Append request audit row + update engine runtime counters

---

## Explicitly not in scope

- Meta-Recommender supremacy / conflict resolution (GE-AI-2F ledger scope)
- LLM or provider enrichment
- Work Order execution or Executive Brain delegation
- Legacy NBA write path replacement

---

## Degraded mode (§11.6)

- Org-level `ai_decision_engine_runtime.degraded` flag
- Auto-degrade after 5 insufficient-evidence evaluations
- Publishes `decision.engine_degraded`
