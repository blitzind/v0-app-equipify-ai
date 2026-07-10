# GE-AIOS-LIVE-1 — Autonomous Production Operations

**Status:** Operational milestone (not a feature milestone)  
**QA marker:** `ge-aios-live-1-autonomous-production-operations-v1`

---

## Executive Summary

LIVE-1 transitions Equipify AI OS from **built** to **operated**. Ava should run Equipify's own sales organization using production systems only — no new engines, no architecture redesign.

**Current state (pre-deploy):** Code for GE-AIOS-21C, 21C-4, 22, and 23 is complete locally but **not yet deployed** to Vercel Production. Production pool still shows legacy leads without admission metadata or `companyEvidence_v22`.

**First action:** Deploy the bundled milestone, then run production validation gates.

---

## Phase 1 — Production Deployment Checklist

Deploy together as **one production milestone**:

| Milestone | What it enables |
|-----------|-----------------|
| **21C** | Lead admission gate (identity + ICP) |
| **21C-4** | Production drift analysis + dry-run cleanup |
| **22** | Company evidence before inference |
| **23** | Canonical research routing |

### After deploy — run validations (Vercel Production only)

```bash
# Unified LIVE-1 gate (post-deploy)
pnpm validate:ge-aios-live-1-production-operations

# Individual regression gates
pnpm validate:ge-aios-21c-lead-admission-production
pnpm validate:ge-aios-21b-deep-research-production
pnpm validate:ge-aios-23-runtime-canonicalization-production
pnpm validate:ge-aios-18b-autonomous-sales-loop-production-activation

# Pre-deploy baseline (expected blockers)
pnpm validate:ge-aios-live-1-production-operations -- --pre-deploy
```

### Healthy deployment signals

- [ ] `deploymentMarkerPresent: true` in admission analysis
- [ ] New research runs include `companyEvidence_v22` in `signals`
- [ ] Rebuild + legacy POST routes use `routeCanonicalProspectResearch`
- [ ] Invalid/rejected leads blocked from auto-research

---

## Phase 2 — Populate the Pipeline

Using **approved Company Profile** ICPs:

- Manufacturing, industrial, medical device, precision machining
- Prefer Datamoon approved audiences or CSV import with real domains
- Avoid synthetic test companies when possible

**Do not bypass admission** — let Ava reject poor fits.

Optional dry-run cleanup before import:

```bash
pnpm report:ge-aios-21c-admission-drift-production
pnpm cleanup:ge-aios-21c-legacy-leads-production   # dry-run default
```

---

## Phase 3 — Daily Operations

### Ava operates (production AI OS)

- Lead discovery → admission → research → evidence → qualification
- Revenue Queue → Work Manager recommendations
- Outreach/meeting **preparation** (approval-gated send)

### Operator operates (human)

- Review recommendations in Home + AI OS Command Center
- Approve outbound via Human Approval Center
- Record observations in bug backlog (below)
- **Do not** manually bypass Ava unless blocked

### Daily script

```bash
pnpm report:ge-aios-live-1-daily-ava-operations
pnpm report:ge-aios-live-1-daily-ava-operations -- --json   # for logging
```

---

## Phase 4 — Operational Review Rubric

For each Ava recommendation classify:

| Rating | Meaning |
|--------|---------|
| **Correct** | Would trust without change |
| **Minor issue** | Right direction, polish needed |
| **Needs improvement** | Wrong priority or weak reasoning |
| **Incorrect** | Wrong decision |
| **Blocker** | Cannot operate safely |

Questions:

1. Was this the right decision?
2. Was reasoning grounded in evidence?
3. Would a human SDR agree?
4. Would I approve this outbound?

---

## Phase 5 — Customer Journey Checkpoints

Validate end-to-end for 3–5 real prospects:

```text
Discovery → Admission → Research → Evidence → Qualification
→ Revenue Queue → NBA → Personalization → Approval → Outbound
→ Reply → Meeting → Opportunity → Follow-up → Closed
```

Document any: hesitation, loops, repeated work, missing context, confusing output.

---

## Phase 6 — Daily Ava Report Fields

Morning report includes:

- Research completed (24h)
- New / rejected / review leads
- High-priority accounts
- Pipeline risks
- Recommended actions
- Operator approvals waiting

End-of-day (operator-authored):

- Completed work
- Operator decisions
- Pipeline changes
- Lessons learned

---

## Phase 7 — Production Metrics

Track weekly in LIVE-1:

| Metric | Source |
|--------|--------|
| Admission accuracy | Operational review + drift report |
| Research accuracy | Evidence vs manual spot-check |
| Evidence quality | `companyEvidence_v22` confidence scores |
| Recommendation quality | Phase 4 rubric |
| Operator approval rate | Human Approval Center |
| Duplicate research | LIVE-1 metrics `duplicateActiveResearchRuns` |
| Queue latency | Revenue Queue + research run timestamps |
| Operator intervention | Bug backlog frequency |

---

## Phase 8 — Live Bug Backlog

**File:** update this section during LIVE-1. Do not build new systems until classified.

| ID | Severity | Freq | Impact | Root cause | Architecture | Status | Suggested fix |
|----|----------|------|--------|------------|--------------|--------|---------------|
| LIVE-1-001 | blocker | always | Cannot trust admission until deploy | configuration | 21C admission | open | Deploy 21C bundle; verify metadata writes |
| LIVE-1-002 | needs_improvement | always | Research lacks evidence on historical runs | data_quality | 22 evidence | open | Re-research leads post-22 deploy |
| LIVE-1-003 | needs_improvement | always | 24 legacy leads missing admission metadata | data_quality | 21C | open | Dry-run cleanup plan; operator approve writes |
| LIVE-1-004 | minor | intermittent | `autonomy_enabled` off by default | configuration | 18A sales loop | watching | Enable via Growth Autonomy settings when ready |
| LIVE-1-005 | minor | always | No approved profile returned for cert org fallback | configuration | Business Profile | watching | Confirm prod org has approved profile |

### Classification rules

- **configuration** — env, kill switches, missing profile
- **data_quality** — legacy pool, bad imports
- **ux** — confusing operator output
- **production_bug** — code defect in deployed behavior
- **architectural_gap** — only if real usage proves missing capability (rare)

---

## Go / No-Go for BETA-1

| Criterion | Pre-deploy | Post-deploy target |
|-----------|------------|-------------------|
| Admission metadata written | NO | YES |
| companyEvidence_v22 generated | NO | YES on new research |
| Canonical research routing | code ready | verified in prod |
| Operator trust (daily use) | n/a | 5+ days without blockers |
| Architectural redesign required | NO | NO |

**Current recommendation: NO-GO for BETA-1** until bundled deploy completes and LIVE-1 gates pass without blockers.

**Conditional GO for internal LIVE-1** after deploy + 3 business days of operator review with ≤1 blocker-class issue open.

---

## Commands Reference

```bash
# Cert (local)
pnpm test:ge-aios-21c-lead-admission-gate
pnpm test:ge-aios-22-company-evidence
pnpm test:ge-aios-23-runtime-canonicalization

# Production (via vercel-production-env-run)
pnpm validate:ge-aios-live-1-production-operations
pnpm report:ge-aios-live-1-daily-ava-operations
pnpm report:ge-aios-21c-admission-drift-production
```

---

## Safe Deploy Reminder

Deploy and commit manually via Terminal. Suggested commit bundles 21C + 22 + 23 together (see prior milestone deliverables for `git add` scope).

Do **not** run production cleanup writes until operator reviews dry-run output.
