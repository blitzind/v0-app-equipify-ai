# GE-AI-2H — L3 Human Approval Center

**Status:** Complete (local certification, not committed)  
**Date:** 2026-06-25  
**Certification:** `pnpm test:ge-ai-2h-human-approval-center`

---

## Objective

Unified read-only operator inbox for AI-recommended or AI-prepared actions requiring human approval. Consolidates scattered approval visibility without replacing existing enforcement.

---

## Approval source audit matrix

| Approval Source | File(s) / Route(s) | Action Type | Existing Enforcement | Existing UI | Reuse Strategy |
| --------------- | ------------------ | ----------- | -------------------- | ----------- | -------------- |
| AI Work Orders | `ai-work-order-*`, CC `approvalWorkOrders` | Work order review | Status machine + decision gate | Mission Planning Review | **Collector — authoritative** |
| Execution plan review | `growth-lead-research-execution-plan-review-*` | `approve_execution_plan` | Event-sourced review actions | Lead research / diagnostics | **Collector** |
| GeV15 automation inbox | `ge-v1-5-automation-runtime-approval-inbox.ts` | email/sms/voice prepare | `assertGeV15NoApprovalBypass` | Automation inbox panels | **Collector — SMS parity** |
| Growth automation flow | `growth-automation-approval-service.ts` | send_email/send_sms | Enrollment metadata gate | Automation approval queue | **Collector** |
| Sequence execution jobs | `sequence-job-repository.ts` | send_email/send_sms/voice_drop | `sequence-approval-gate` | Sequence safe execution | **Collector — SMS parity** |
| AI voice outbound | `voice-ai-outbound-repository.ts` | `start_ai_voice_session` | Approval workflow | Voice settings panel | **Collector** |
| Human execution | `human-execution-repository.ts` | send_email/send_sms/call | Approval gate | Human execution dashboard | **Collector** |
| Outreach prep packages | `growth-autonomous-outreach-preparation-pilot-*` | `approve_outreach_package` | Draft-only, transport blocked | Lead research pilot | **Collector** |
| Meeting prep packages | `growth-autonomous-meeting-pilot-*` | `approve_meeting_prep` | Calendar/booking blocked | Meeting pilot telemetry | **Collector** |
| Revenue Operator | `growth-revenue-operator-orchestration-*` | `review_recommendation` | Recommendation-only 4B | RO section | **Collector** |
| Meta-Recommender | `growth-meta-recommender-engine.ts` | review/send_* advisory | Read-only policy flags | Meta-Recommender section | **Advisory collector** |
| Priority Binding | `growth-priority-engine-binding-engine.ts` | `review_blocker` | Read-only projection | Priority Binding section | **Advisory collector** |
| Command center attention | `needsAttention` approval_required | review | Attention synthesizer | Operations dashboard | **Collector** |

---

## Canonical model

Types: `lib/growth/aios/approvals/growth-human-approval-center-types.ts`

- `GrowthHumanApprovalItem` — normalized approval with channel, risk, policy.enforcementSource, route
- `GrowthHumanApprovalCenterReadModel` — ranked items, filter counts, summary (SMS/email/voice pending)

---

## SMS parity

SMS is first-class across:

- GeV15 `prepare_sms` → `channel: "sms"`, `actionType: "send_sms"`
- Sequence jobs with `channel: "sms"` → `source: "sms_sequence"`
- Automation flow `send_sms` approvals
- Human execution SMS channel items
- Filter counts include `byChannel.sms`
- Routes deep-link to `/growth/campaigns/sequences` (existing approval surface)
- **No SMS send triggered** — read-only aggregation only

---

## Read-only boundaries

- No approve/reject/send buttons in Approval Center UI
- GET-only API: `/api/platform/growth/ai-os/approvals`
- Existing approval services remain authoritative for mutations
- Growth Autonomy policy plane unchanged

---

## Implementation

| File | Role |
| ---- | ---- |
| `lib/growth/aios/approvals/growth-human-approval-center-types.ts` | Types |
| `lib/growth/aios/approvals/growth-human-approval-center-engine.ts` | 13 collectors + ranking |
| `lib/growth/aios/approvals/growth-human-approval-center-service.ts` | Server fetch + CC mount |
| `app/api/platform/growth/ai-os/approvals/route.ts` | GET API |
| `app/(growth)/growth/os/approvals/page.tsx` | Full workspace page |
| `components/growth/ai-os/command-center/growth-ai-os-human-approval-center-section.tsx` | AI Ops summary |

---

## Known limitations

- Voice drop campaigns and Apollo-specific queues not yet direct collectors (sequence + GeV15 cover many cases)
- Dedupe is heuristic — same lead/channel may collapse advisory + authoritative items
- No approve/reject mutations in this phase (by design)
- External source fetch failures recorded in `sourcesFailed` without crashing read model

---

## Next recommended phase

**GE-AI-2I L4 Supervised Outbound** — after approval center is committed and operators validate inbox completeness.

---

## Tests

```bash
pnpm test:ge-ai-2h-human-approval-center
```

Regressions: GE-AI-2E, GE-AI-2F, PROD-REGRESSION-6, GE-AIOS-5C.

---

*No commit. No deploy.*
