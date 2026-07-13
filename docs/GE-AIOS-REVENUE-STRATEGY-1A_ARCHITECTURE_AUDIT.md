# GE-AIOS-REVENUE-STRATEGY-1A — Architecture Audit

Pre-implementation audit of autonomous decision systems. **Extend only — no duplicate orchestration, scoring engines, persistence, or agents.**

## Systems audited

| System | Location | Role for 1A |
|--------|----------|-------------|
| SV1-1 Resource Allocation | `lib/growth/resource-allocation/` | **Consume** — capacity gate only; not strategy home |
| SV1-2 Portfolio Allocation | `lib/growth/portfolio-allocation/` | **Consume** — portfolio eligibility; not strategy home |
| Growth Decision Engine (10B) | `lib/growth/decision-engine/` | **Consume** — NBA work ordering; not outreach strategy |
| AI Work-Order Decision Engine (2H) | `lib/growth/aios/ai-decision-engine-*.ts` | **Consume** — WO gates; not outreach strategy |
| Objective Runtime Scheduler | `lib/growth/objectives/growth-objective-runtime-scheduler.ts` | **Do not extend** — host tick only |
| Conversation Intelligence 1A–3A | `lib/growth/aios/growth/growth-outreach-*.ts` | **Extend** — consultant discovery feeds readiness |
| Seller / Prospect Truth | `lib/growth/aios/growth/growth-outreach-seller-truth.ts` | **Reuse** — SoT for seller positioning |
| Buying Committee Intelligence | `lib/growth/buying-committee-intelligence/` | **Consume** — rollup + operator status snapshot |
| Decision Maker Discovery | `lib/growth/decision-maker-repository.ts`, DataMoon DM | **Consume** — entry point candidates |
| Evidence Engine | `lib/growth/evidence-engine/` | **Consume** — via brief evidence + knowledge pack |
| Learning Engine | `lib/growth/aios/learning/` | **Extend** — dimensions on existing outcomes |
| Growth 5F | `growth-autonomous-outreach-preparation-*` | **Extend** — brief + package; never parallel generator |
| Draft Factory | `lib/growth/draft-factory/` | **Unchanged** — transport + approval gates preserved |
| Relationship Intelligence | `lib/growth/relationship/` | **Consume** — relationship tier / temperature on lead |
| Company Intelligence | `lib/growth/company-intelligence/` | **Consume** — via research snapshot |
| Business Profile | `lib/growth/business-profile/` | **Reuse** — seller SoT |
| Communication Engine | `lib/growth/aios/communication/` | **Bridge** — channel recommendation into strategy |
| Opportunity Readiness | `lib/growth/recompute-opportunity-readiness.ts` | **Consume** — lead score/tier |
| Mission Priority (4F) | `lib/growth/aios/growth/growth-mission-priority-engine.ts` | **Unchanged** — separate concern |

## Extension contract (same as CONVERSATION-INTELLIGENCE-3A)

```
buildAutonomousOutreachApprovalPackage
  → buildOutreachSalesStrategyBrief
    → enrichOutreachSalesStrategyBrief
      → buildRevenueStrategyIntelligence   ← NEW (1A)
  → generateOutreachDraftsFromSalesStrategyBrief
  → projectApprovals2AOperatorReviewPacket
```

## What 1A adds

- `GrowthOutreachRevenueStrategyIntelligence` optional block on `GrowthOutreachSalesStrategyBrief`
- Pre-outreach VP-of-Sales judgment: proceed / delay / research / disqualify
- Entry point, timing, channel, sequence, committee, competitive posture — **conclusions only** for operators
- Learning dimensions: `revenueStrategyRecommendation`, `entryPointRole`, `channelStrategy`, `committeeStrategy`

## What 1A must never duplicate

- Resource / portfolio allocation engines
- Draft Factory package generation
- Buying committee discovery orchestrator
- Communication plan generation engine
- Consultant observation / discovery ranking (3A)
- New database tables or persistence stores
- New schedulers or autonomous agents

## Safety invariants preserved

- Growth 5F remains sole package generator
- Draft Factory transport blocks unchanged
- Human approval required before send
- Existing autonomy limits and pilot gates unchanged
- Low-confidence accounts receive **Delay/Research** recommendation — package still prepared for operator review
