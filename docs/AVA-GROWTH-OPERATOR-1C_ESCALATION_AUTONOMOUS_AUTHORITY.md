# AVA-GROWTH-OPERATOR-1C — Escalation & Autonomous Authority Certification

**Document ID:** AVA-GROWTH-OPERATOR-1C  
**Status:** Certified — constitutional escalation enforcement  
**Effective:** 2026-07-23  
**Parent:** [`AVA-GROWTH-OPERATOR-1A_EXECUTIVE_OPERATING_MODEL.md`](./AVA-GROWTH-OPERATOR-1A_EXECUTIVE_OPERATING_MODEL.md)  
**Depends on:** [`AVA-GROWTH-OPERATOR-1B_DECISION_AUTHORITY_UNIFICATION.md`](./AVA-GROWTH-OPERATOR-1B_DECISION_AUTHORITY_UNIFICATION.md)  
**Certification:** `pnpm test:ava-growth-operator-1c-escalation-authority`

---

# Executive Summary

AVA-GROWTH-OPERATOR-1C implements **one canonical Escalation Authority** that every Growth subsystem must defer to before interrupting the operator.

The escalation module (`growth-canonical-escalation-authority-1c.ts`) evaluates all operator-interrupt requests against the constitutional categories defined in 1A. Subsystems that previously escalated independently — Work Manager, 10B Decision Engine, Opportunity Assessment, Admission Policy, Recommendation Queue — now consume this policy.

**Key outcomes:**
- Terminal ICP rejects are autonomous — never operator review
- Preparation (research, personalization, outreach prep) is accomplishment — not blocker
- Only send-ready outbound requires operator approval
- Portfolio-wide authority hydration on server paths (autonomy tick)
- Agreement telemetry for production diagnostics (internal, not Home)

---

# Escalation Matrix

| Escalation type | Category | Interrupt operator? | Constitutional ref |
|-----------------|----------|---------------------|-------------------|
| Outbound send-ready package | always_escalate | Yes | E1 |
| Material inbound reply (send response) | always_escalate | Yes | E2 |
| Mission blocker | always_escalate | Yes | E3 |
| Kill switch / emergency stop | always_escalate | Yes | E4 |
| Pilot failures ≥ 6 | always_escalate | Yes | E5 |
| Revenue Operator critical/high | always_escalate | Yes | E6 |
| Strategic direction change | strategic_approval | Yes | E7 |
| Spending approval required | operator_approval | Yes | E8 |
| High-stakes relationship signal | operator_approval | Yes | E9 |
| Calibration apply proposal | always_escalate | Yes | E10 |
| Admission edge case (ambiguous fit) | autonomous | No (default) | C1 |
| Research execution plan (routine) | autonomous | No | C2 |
| Terminal ICP reject | never_escalate | No | N1 |
| Research completed | never_escalate | No (accomplishment) | N2 |
| Outreach package prepared (not sent) | never_escalate | No (accomplishment) | N3 |
| Qualification evaluated | never_escalate | No (accomplishment) | N4 |
| Discovery found companies | never_escalate | No (accomplishment) | N5 |
| Continue research | autonomous | No | N7 |
| Prepare outreach | autonomous | No | N3/R4 |
| request_human_review (legacy default) | autonomous | No (suppressed) | N7 |
| Meta-recommender advisory | never_escalate | No | C4 |

---

# Autonomous Authority Audit

Ava now owns without operator involvement:

| Domain | Enforcement |
|--------|-------------|
| Discovery | never_escalate / autonomous |
| Qualification | qualification_complete → autonomous |
| Research | continue_research → autonomous (was request_human_review) |
| Business understanding | autonomous |
| ICP terminal rejection | admission_terminal_reject → never_escalate |
| Portfolio management | constitutional map from lead metadata |
| Contact research / verification | autonomous |
| Personalization | personalization_complete → accomplishment |
| Outreach preparation | prepare_outreach → accomplishment (R4) |
| Sequence preparation | autonomous |
| CRM / memory updates | autonomous |
| Learning observation | advisory only |
| Optimization / retry | autonomous |
| Wait / pause / monitor | deferred, not interrupt |

---

# Operator Interruption Audit — Removed

| Previous interruption | Why removed | Mechanism |
|----------------------|-------------|-----------|
| Terminal admission reject in review queue | Poor-fit companies are Ava's job to reject | `applyResearchSufficiencyAdmissionPolicy` — `requiresHumanReview: false` for terminal_reject |
| `continue_research` → request_human_review | Research is autonomous | Opportunity assessment NBA kind changed |
| `prepare_outreach` blocked in 10B | Preparation ≠ send approval | Escalation authority + decision context |
| Daily queue prepare outreach approval | Same as above | `resolveCandidateHumanApproval` |
| Generic request_human_review fallback | Suppressed by constitutional policy | `evaluateCanonicalEscalation` |
| Work Manager operator queue for terminal rejects | Filtered from plan | `shouldSuppressOperatorInterruptForLead` |
| Waiting-on-you non-send items | Escalation gate | Recommendation queue + escalation eval |
| "All next actions require operator approval" note | Misleading | Opportunity assessment evidence copy |

---

# Portfolio Certification

**Poor-fit companies no longer reach operator review when:**
- Sufficiency decision is `terminal_reject`
- Admission reasons match autonomous terminal reject patterns (ICP mismatch, consumer, insurance, utility, foundation, education, government, fit/confidence thresholds)
- Lead status is `disqualified` with terminal reject reasons

**Only recommendation-quality opportunities appear when:**
- Escalation category is `operator_approval` or `always_escalate`
- Send-ready packages pending transport approval
- Material replies requiring response approval

---

# Telemetry (R6)

Module: `growth-canonical-escalation-authority-1c.ts` — `buildEscalationAgreementSnapshot`

| Metric | Description |
|--------|-------------|
| authorityAgreementPercent | Subsystem interrupt matches canonical authority ownership |
| escalationAgreementPercent | Subsystem interrupt matches canonical escalation |
| ownershipAgreementPercent | Actor assignment alignment |
| autonomousExecutionPercent | Samples where neither subsystem nor canonical interrupts |
| unexpectedOverrideCount | Subsystem would interrupt but canonical suppresses |

**Production hydration:** `hydrateCanonicalPortfolioAuthority` (server) emits telemetry per portfolio evaluation.

**Surface:** Internal diagnostics only — not executive Home.

---

# Implementation Modules

| Module | Role |
|--------|------|
| `growth-canonical-escalation-authority-1c.ts` | Single escalation evaluation |
| `growth-constitutional-portfolio-escalation-1c.ts` | Client-safe portfolio metadata escalation |
| `growth-canonical-portfolio-authority-hydration-server-1c.ts` | Server portfolio authority + telemetry |
| `growth-admission-policy-1a.ts` | Terminal reject without human review |
| `growth-lead-research-opportunity-assessment.ts` | Autonomous continue_research |
| `build-decision-context.ts` | Preparation vs send-ready separation |
| `run-work-manager.ts` | Constitutional escalation filter + authority binding |
| `growth-aios-autonomy-tick-health-1a.ts` | `runWorkManagerWithPortfolioAuthority` |

---

# Certification Evidence

```
One opportunity
  → Canonical authority (1B)
  → Canonical escalation (1C evaluateCanonicalEscalation)
  → Work Manager / 10B / Recommendation Queue consume
  → Operator interrupted only for outbound_send_ready
```

Run: `pnpm test:ava-growth-operator-1c-escalation-authority` — **PASS**

---

# Final Verdict

**Does Ava now interrupt the operator only for executive decisions?**

**Yes — for all paths wired through the canonical escalation authority.** Preparation, research, terminal rejects, and legacy `request_human_review` defaults no longer interrupt. Send-ready outbound, material replies, mission blockers, kill switches, and constitutional always-escalate conditions still interrupt correctly.

**Does the Growth platform enforce one canonical escalation policy?**

**Yes.** `evaluateCanonicalEscalation()` is the single deferral point. No subsystem may independently decide to interrupt without consulting it.

**Is Ava operating as an autonomous AI Growth Operator rather than a workflow engine?**

**Substantially yes.** Ava owns terminal rejects, research continuation, and outreach preparation autonomously. The operator receives decisions (send approval), not diagnostics or preparation blockers.

### Remaining blockers before AVA-GROWTH-OPERATOR-1D

| Blocker | Milestone |
|---------|-----------|
| Full server hydration in all paths (home workspace summary, autonomous sales loop, daily briefing server loaders) | 1D |
| Executive communication deduplication and uniform sanitization | **1D** |
| HAC collector-level escalation deferral (read paths) | 1D |
| Production telemetry persistence / Command Center advanced panel | 1D follow-on |

---

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-07-23 | Initial certification (AVA-GROWTH-OPERATOR-1C) |
