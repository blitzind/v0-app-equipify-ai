# GE-AIOS-IMP-0A-1 — Executive Lead Drawer (Presentation Only)

**Document ID:** GE-AIOS-IMP-0A-1  
**Filename:** `GE-AIOS-IMP-0A-1_EXECUTIVE_LEAD_DRAWER.md`  
**Status:** Implementation blueprint — presentation layer only  
**Effective:** 2026-07-11  
**Parent:** [`AI_OS_EXECUTIVE_ARCHITECTURE_CONSOLIDATION.md`](./AI_OS_EXECUTIVE_ARCHITECTURE_CONSOLIDATION.md)  
**Canonical drawer hierarchy:** [`GE-AIOS-25A_AVA_COGNITIVE_WORKSPACE.md`](./GE-AIOS-25A_AVA_COGNITIVE_WORKSPACE.md) (Ava Cognitive Workspace)  
**Upstream:** Executive Constitution · ARCH-1A–4A · AUDIT-EXEC-1A  

**Non-scope:** Schema, APIs, orchestration, scoring, providers, commits, deployments  

> **Hierarchy authority:** Implement the Lead Drawer section order and semantics from **GE-AIOS-25A**. This IMP-0A-1 document remains the **presentation-only / reuse / regression** implementation contract. Where section names differ, prefer 25A naming.
---

## 1. Mission

Change how Ava **communicates**, not how Ava **thinks**.

The backend continues making the exact same decisions.  
This milestone rearranges and rewords existing information so opening a lead feels like:

> Sitting down with a top employee and asking: “Give me an update on this account.”

**From:** AI Dashboard  
**To:** Ava’s Executive Workspace  

Virtually zero regression risk: compose, wrap, reorder, rename. Do not rewrite engines.

---

## 2. Environment constraints

- Vercel Production architecture only  
- Never use `.env.local`  
- No schema / API / backend logic / orchestration / provider changes  
- No commits / deployments in blueprint phase  
- Presentation layer only  

### Explicit DO NOT CHANGE

Research · Decision · Mission · Autonomy · Memory · Evidence · Relationship · Opportunity · Conversation engines · Any API · Any database · Any scoring logic  

---

## 3. Component inventory (current drawer)

**Shell:** `components/growth/growth-lead-drawer.tsx` (~35 child panels, flat vertical stack)

| # | Component | File | Role today |
|---|-----------|------|------------|
| 1 | `GrowthLeadCommandCenter` | `growth-lead-command-center.tsx` | Header, badges, NBA banner, contact actions, assignment |
| 2 | `GrowthLeadDailyWorkQueuePanel` | `growth-lead-daily-work-queue-panel.tsx` | Queue item for this lead |
| 3 | `GrowthLeadAutonomousExecutionGuardrailPanel` | `growth-lead-autonomous-execution-guardrail-panel.tsx` | Autonomy guardrail status |
| 4 | `GrowthReplyWorkflowActionsPanel` | `growth-reply-workflow-actions-panel.tsx` | Reply workflow actions |
| 5 | `GeV15AutomationRuntimeApprovalPanel` | `automation/ge-v1-5-automation-runtime-approval-panel.tsx` | Pending automation approvals |
| 6 | `GrowthExecutiveOperatingIntelligence` | `growth-executive-operating-intelligence.tsx` | Executive operating score/tier |
| 7 | `GrowthOperationalCapacityIntelligence` | `growth-operational-capacity-intelligence.tsx` | Capacity pressure |
| 8 | `GrowthRevenueForecast` | `growth-revenue-forecast.tsx` | Forecast |
| 9 | `GrowthRevenueForecastEvidencePanel` | `growth-revenue-forecast-evidence-panel.tsx` | Forecast evidence |
| 10 | `GrowthRevenueReadinessPanel` | `growth-revenue-readiness-panel.tsx` | Revenue readiness |
| 11 | `GrowthSalesExecutionPlanPanel` | `growth-sales-execution-plan-panel.tsx` | Sales execution plan steps |
| 12 | `GrowthRevenueTimelinePanel` | `growth-revenue-timeline-panel.tsx` | Revenue timeline |
| 13 | `GrowthRevenueWorkflowWorkspacePanel` | `growth-revenue-workflow-workspace-panel.tsx` | Workflow workspace |
| 14 | `GrowthVoiceRevenueIntelligencePassiveCard` | `growth-voice-revenue-intelligence-passive-card.tsx` | Voice revenue passive |
| 15 | `GrowthVoiceRetentionIntelligencePassiveCard` | `growth-voice-retention-intelligence-passive-card.tsx` | Voice retention passive |
| 16 | `GrowthOpportunityReadiness` | `growth-opportunity-readiness.tsx` | Opportunity readiness |
| 17 | `GrowthLeadOpportunityIntelligencePanel` | `growth-lead-opportunity-intelligence-panel.tsx` | Opportunity detail |
| 18 | `GrowthLeadBookingIntelligencePanel` | `growth-lead-booking-intelligence-panel.tsx` | Booking |
| 19 | `GrowthLeadRelationshipMemoryPanel` | `growth-lead-relationship-memory-panel.tsx` | Relationship memory |
| 20 | `GrowthLeadMultichannelTimelinePanel` | `growth-lead-multichannel-timeline-panel.tsx` | Multichannel timeline |
| 21 | `GrowthRelationshipIntelligence` | `growth-relationship-intelligence.tsx` | Relationship strength |
| 22 | `GrowthConversationIntelligence` | `growth-conversation-intelligence.tsx` | Conversations |
| 23 | `GrowthLeadMeetingIntelligence` | `growth-lead-meeting-intelligence.tsx` | Meetings |
| 24 | `GrowthLeadMeetingOutcomeIntelligence` | `growth-lead-meeting-outcome-intelligence.tsx` | Meeting outcomes |
| 25 | `GrowthSequenceIntelligence` | `growth-sequence-intelligence.tsx` | Sequences |
| 26 | `GrowthLeadCadencePanel` | `growth-lead-cadence-panel.tsx` | Cadence |
| 27 | `GrowthLeadExecutionReadiness` | `growth-lead-execution-readiness.tsx` | Execution readiness |
| 28 | `GrowthLeadCustomerLifecyclePanel` | `growth-lead-customer-lifecycle-panel.tsx` | Lifecycle |
| 29 | `GrowthLeadEngagement` | `growth-lead-engagement.tsx` | Engagement |
| 30 | `GrowthLeadCompliance` | `growth-lead-compliance.tsx` | Compliance |
| 31 | `GrowthCallCopilot` | `growth-call-copilot.tsx` | Call assist |
| 32 | `GrowthPersonalizationEmbeddedPanel` | `personalization/embedded/...` | Personalization |
| 33 | `GrowthRealtimeCallIntelligence` | `growth-realtime-call-intelligence.tsx` | Live call intel |
| 34 | `GrowthAiCopilot` | `growth-ai-copilot.tsx` | Copilot chat |
| 35 | `GrowthDecisionMakersPanel` | `growth-decision-makers-panel.tsx` | Decision makers |
| 36 | `GrowthCompanyIntelligenceSnapshot` | `growth-company-intelligence-snapshot.tsx` | Company snapshot |
| 37 | `GrowthLeadResearchPanel` | `growth-lead-research-panel.tsx` | Research (+ Prospect Intelligence card) |
| 38 | `GrowthOutboundPanel` | `growth-outbound-panel.tsx` | Outbound |
| 39 | `GrowthOperationalIntelligence` | `growth-operational-intelligence.tsx` | Ops intel |
| 40 | `GrowthLeadActivityStream` | `growth-lead-activity-stream.tsx` | Activity stream |
| 41 | `GrowthLeadTimelinePanel` | `growth-lead-timeline-panel.tsx` | Timeline |

**Already fetched in drawer (reuse, no new API):**

- `nativeDecision` / `nativeCommunicationStrategy` / `relationship_recommendation` via existing `communication-strategy` GET  
- Research run props via `GrowthLeadResearchPanel` callbacks  
- Lead fields: `status`, `nextBestAction`, `nextBestActionReason`, momentum, engagement, opportunity, etc.  

**Nested reusable:** `GrowthNextBestActionBanner`, `GrowthProspectIntelligenceCard`, `GrowthRevenueReadinessBadge`, `GrowthLeadAssignmentPanel`, call action sheet / dialer.

---

## 4. Existing components being reused (as-is internals)

Reuse **internally** without rewriting business logic:

| Reuse as-is | Use in executive section |
|-------------|--------------------------|
| `GrowthNextBestActionBanner` + `nativeDecision` | Ava’s Decision (reasons, confidence, action) |
| `GrowthSalesExecutionPlanPanel` | Current Plan |
| `GrowthLeadDailyWorkQueuePanel` | Current Objective / Plan (queue projection) |
| `GeV15AutomationRuntimeApprovalPanel` | Awaiting My Approval |
| `GrowthReplyWorkflowActionsPanel` | Awaiting My Approval (when reply needs action) |
| `GrowthCompanyIntelligenceSnapshot` | My Assessment (conclusions) |
| `GrowthProspectIntelligenceCard` (inside research panel) | My Assessment summary + Supporting Evidence detail |
| `GrowthLeadResearchPanel` | Supporting Evidence (collapsed) |
| `GrowthDecisionMakersPanel` | Assessment / Plan context (DM locate) |
| `GrowthLeadTimelinePanel` + `GrowthLeadActivityStream` | Recent Work (with copy wrappers) |
| `GrowthLeadCommandCenter` contact/actions strip | Keep operator actions; demote engine badges |
| Opportunity / relationship / conversation / meeting / sequence / engagement panels | Supporting Evidence or hide-if-empty |
| Call/personalization/copilot tools | Collapsed “Tools” or Supporting Evidence — not above fold |

---

## 5. Components requiring wrappers (preferred)

Thin presentational wrappers only — props in, existing child out, new titles/copy:

| Wrapper (proposed) | Wraps | Purpose |
|--------------------|-------|---------|
| `AvaExecutiveBriefingSection` | Synthesize from lead + nativeDecision + research props **client-side** | First-person manager briefing (deterministic template, no LLM, no new API) |
| `AvaAccountStatusBadge` | `lead.status` + opportunity/lifecycle/conversation signals already on lead or child empties | Map to executive status labels |
| `AvaDecisionSection` | `GrowthNextBestActionBanner` / `nativeDecision` | Decision · Reason · Confidence · Impact (business labels) |
| `AvaCurrentObjectiveSection` | Daily work queue item + NBA + execution plan current step | “What I’m trying to accomplish” |
| `AvaCurrentPlanSection` | `GrowthSalesExecutionPlanPanel` (+ optional queue next steps) | Next planned actions |
| `AvaApprovalSection` | Automation approval + reply workflow | Show approvals OR “doesn’t need anything” |
| `AvaAssessmentSection` | Company snapshot + prospect intelligence conclusions | “My Assessment” |
| `AvaSupportingEvidenceSection` | Collapsible shell around research + detailed intel panels | Below fold, collapsed by default |
| `AvaRecentWorkSection` | Timeline + activity stream | First-person event copy map |
| `GrowthLeadExecutiveWorkspace` | Reorders children of drawer | Single composition root |

**No new data fetching** beyond what the drawer already performs.

---

## 6. Components requiring light refactoring

| Component | Light change only |
|-----------|-------------------|
| `growth-lead-drawer.tsx` | Replace flat stack with `GrowthLeadExecutiveWorkspace` composition order; preserve providers/effects |
| `growth-lead-command-center.tsx` | Soften titles; move NBA into Decision section; hide engine-y badges above fold or rename |
| `growth-prospect-intelligence-card.tsx` | Title → assessment-friendly copy; “intelligence” → business language (presentation strings) |
| `growth-ui-utils` `GrowthEngineCard` / `GrowthCollapsibleEngineCard` usage in drawer children | Prefer collapsible + business titles where touched; **do not** rename shared util globally in this milestone if risky |
| Timeline / activity label maps | Add display formatter map (event type → Ava voice); do not change event payloads |
| Panels that always render empty shells | Add `return null` when no data (if not already) — presentation-only empty hide |

**Avoid** deep refactors of research panel, opportunity engines, or command-center action handlers.

---

## 7. Proposed new drawer hierarchy

```text
DetailDrawer (company title — keep)
└── GrowthCallWorkflowProvider (keep)
    └── GrowthLeadExecutiveWorkspace
        ├── [Sticky] Contact / primary actions strip
        │     (from Command Center — Call, Email, Edit, Research action)
        │
        ├── 1. Executive Briefing          (NEW wrapper — template from existing data)
        ├── 2. Account Status              (NEW badge map)
        ├── 3. Ava’s Decision              (wrap NBA / nativeDecision)
        ├── 4. Current Objective           (wrap queue / NBA / plan step)
        ├── 5. Current Plan                (wrap Sales Execution Plan)
        ├── 6. Awaiting My Approval        (wrap approvals OR idle message)
        ├── 7. My Assessment               (wrap company snapshot + research conclusions)
        ├── 8. Supporting Evidence         (COLLAPSED — research + all detailed intel)
        │     └── Decision makers, research, outbound, opportunity, relationship,
        │         conversation, meetings, sequences, engagement, compliance,
        │         forecast, readiness, capacity, voice cards, operational intel, …
        ├── 9. Recent Work                 (timeline + activity — Ava voice labels)
        └── 10. Tools (optional, collapsed) Call copilot, personalization, AI copilot
```

**Hide when empty:** meetings, opportunity, relationship, conversations, booking, forecast evidence, voice cards, automation approvals (when none — show idle message instead of empty list), guardrails if feature off (already returns null).

---

## 8. Mapping: old UI → new executive UI

| Old (visible today) | New section | Presentation change |
|---------------------|-------------|---------------------|
| Command Center badges (status, readiness, momentum, workflow health) | Account Status + demoted details in Evidence | One executive status; engine scores not primary |
| `GrowthNextBestActionBanner` | Ava’s Decision | Labels: Proceed / Monitor / Disqualify / Escalate / Pause / Archive mapped from NBA + qualification |
| Native `action_label`, `reasons`, `confidence`, `blockers` | Ava’s Decision fields | Rename “execution_readiness” → business impact language in UI only |
| Daily Work Queue panel | Current Objective | “I’m working on…” |
| Sales Execution Plan | Current Plan | Keep checklist; title “Current Plan” |
| Automation approval + reply actions | Awaiting My Approval | Idle copy when empty |
| Company snapshot + Prospect Intelligence headlines | My Assessment | Conclusions first |
| Research panel, readiness, forecast, capacity, opportunity, relationship, etc. | Supporting Evidence | Collapsed accordion |
| Activity stream + Timeline | Recent Work | Reword event titles |
| Executive / Operational / Revenue “Intelligence” titles | Assessment or Evidence | Drop “Intelligence/Engine/Readiness” from labels |
| Flat 35-panel scroll | Ordered hierarchy | Reorder only |

### Account Status mapping (presentation projection — no new backend state)

| Executive label | Map from existing (examples) |
|-----------------|------------------------------|
| Active Pursuit | `in_outreach`, `call_ready`, `qualified` + active plan |
| Monitoring | `enriched` / NBA monitor / wait_follow_up |
| Awaiting Approval | Pending automation approvals or human-review NBA |
| In Conversation | `replied` / open conversation intel |
| Opportunity Active | Opportunity panel has opportunity / high readiness with open opp |
| Customer | `converted` / lifecycle customer |
| Closed Lost | `disqualified` |
| Archived | `archived` |
| Researching | `new` / `researching` |

Exact precedence rules live in a pure client mapper (`mapLeadToAvaAccountStatus`) — deterministic, testable, no persistence.

### Ava’s Decision mapping (presentation)

| Executive decision | Map from |
|--------------------|----------|
| Proceed | NBA outreach/call/enroll-ready; qualification strong |
| Monitor | `monitor_buying_signals` / wait_follow_up |
| Disqualify | `disqualify` / `review_disqualified` |
| Escalate | manual_review / blockers requiring manager |
| Pause | compliance / stop / guardrail block |
| Archive | `archived` status |

Reason / confidence / impact ← `nativeDecision.reasons`, `.confidence`, blockers/warnings or `lead.nextBestActionReason`.

### Executive Briefing (deterministic template)

Inputs only from already-available drawer data:

- Research completeness (`hasUsableLeadResearch`, prospect run status)  
- Qualification / NBA / nativeDecision  
- Decision-maker presence  
- Pending approvals count  
- Account status projection  

Output: 3–5 first-person sentences. **No LLM. No invented facts.** If data missing, omit that sentence.

---

## 9. Regression risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `drawerFocus` scroll targets break | Medium | Preserve `id`s / `data-command-focus` on moved sections; update focus map if needed |
| Empty-hide hides rare but needed actions | Medium | Never hide approval/reply when pending; never hide contact actions |
| Command Center action handlers regress | Medium | Keep action strip component intact; move only surrounding chrome |
| Feature-flagged panels (queue, guardrails, native decision) | Low | Preserve existing `return null` / enable checks |
| Collapsed Evidence hides research rebuild | Low | Keep Research primary action in sticky strip; Evidence contains full panel |
| Timeline copy map misses event types | Low | Fallback to original label |
| QA markers / e2e selectors | Medium | Keep `data-qa-marker` on wrapped children; add new workspace marker |
| Auto-queue research on open | None if untouched | Do not change drawer `useEffect` enqueue |

**Out of scope / non-risks:** scoring, APIs, autonomy allow/deny — unchanged.

---

## 10. Implementation plan (when coding begins)

| Step | Work | Risk |
|------|------|------|
| 1 | Add pure mappers: account status, decision label, briefing template, timeline copy | None |
| 2 | Add section wrappers + `GrowthLeadExecutiveWorkspace` | Low |
| 3 | Rewire `growth-lead-drawer.tsx` to workspace order; keep all effects/providers | Low |
| 4 | Soften Command Center chrome; relocate NBA into Decision section | Low–Med |
| 5 | Collapsible Supporting Evidence; hide-empty guards on moved panels | Low |
| 6 | Static cert script: hierarchy order, no API/schema imports changed, mappers deterministic | Low |
| 7 | Manual UX pass on Block Imaging / sample leads | — |

**Success criteria**

- Same APIs called as today  
- Same decisions/scores  
- Operator sees Ava-first hierarchy  
- Empty sections hidden  
- Architecture jargon removed from primary labels  
- Virtually zero backend regression surface  

---

## 11. Deliverable summary

1. **Inventory:** 41 panels in flat drawer (table above).  
2. **Reuse:** NBA, nativeDecision, execution plan, approvals, research, snapshot, timeline, command actions.  
3. **Wrappers:** Briefing, Status, Decision, Objective, Plan, Approval, Assessment, Evidence, Recent Work, Workspace root.  
4. **Light refactor:** Drawer composition, command-center chrome, title strings, empty hides, timeline labels.  
5. **Hierarchy:** Briefing → Status → Decision → Objective → Plan → Approval → Assessment → Evidence (collapsed) → Recent Work → Tools.  
6. **Mapping:** Old panels → new sections (table §8).  
7. **Risks:** Focus scroll, selectors, accidental hide of actions — mitigated by preserving IDs/actions.  
8. **Plan:** Mappers → wrappers → rewire drawer → cert — **no code in this document phase.**  

---

## 12. Version history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-11 | Initial presentation-only blueprint (GE-AIOS-IMP-0A-1) |

---

*Equipify AI OS — IMP-0A-1 Executive Lead Drawer. Presentation only. Backend decisions unchanged.*
