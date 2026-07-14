# GE-AIOS-PRODUCTION-VALIDATION-1A

Production validation for the batched AI OS milestone train (Channels 1A through First Meeting Workflow 1A).

**Environment:** Vercel Production only. Never `.env.local`.

**Data:** Real production records only. Block Imaging lead `6d9220f0-2960-468c-b4be-5d7595d292c3`.

**Mutations:** None during automated validation. Operator walkthrough gates are read-only unless explicitly approved.

---

## Automated harness

```bash
pnpm validate:ge-aios-production-validation-1a
```

Runs through `scripts/vercel-production-env-run.ts` (hides legacy local env files).

Optional overrides:

```bash
PROD_VAL_1A_DEPLOYED_SHA=<full-sha> \
PROD_VAL_1A_DEPLOYMENT_ID=dpl_... \
pnpm validate:ge-aios-production-validation-1a
```

---

## Phase 1 — Canonical runtime path trace

Verify deployed code and production reads use the canonical chain:

| Step | Canonical entry | Legacy must not win |
|------|-----------------|---------------------|
| Home | `buildGrowthHomeWorkspaceSummary` → `resolveGrowthCanonicalDecisionForLead` (hero) | No direct legacy decision cards |
| Lead Workspace | `buildLeadOperatorWorkspacePayloadFromGrowthLead` → `resolveGrowthCanonicalDecisionForLead` | No orphan revenue-queue-only decision |
| Growth 5F | `resolveCanonicalOutreachPackageForLead` → pilot runs `approval_package` | No stale draft-factory-only send copy |
| HAC | `loadApprovals2AOperatorReviewPacket` → memory + decision resolvers | No package-only memory snapshot without refresh |
| Meeting Intelligence | `resolveGrowthCanonicalMeetingBriefForMeeting` | No orphan `ai-meeting-prep` without strategy brief |
| Call Workspace | `resolveCallWorkspaceAiosLiveReasoning` → meeting brief + package | `resolveSayThisNext` must prefer AI OS when present |
| Reply Intelligence | `buildReplyCopilotAssist` + Channels 1A parity | No auto-send paths |
| Decision Engine | `resolveGrowthCanonicalDecisionForLead` + 1C cache | No revenue-director override |
| Transport | `evaluateCanonicalTransportBoundary` + Send Plane 1B assets | No signature materialization in package body |

---

## Phase 2 — Block Imaging consistency gates

Read-only checks on lead `6d9220f0-2960-468c-b4be-5d7595d292c3`:

1. Company display name is exactly **Block Imaging**
2. No degraded capitalization in operator projections
3. No AI signatures, em dashes, or mailbox signatures in Send Plane bodies
4. Decision fingerprint identical across Home (if hero), Lead Workspace, HAC, Meeting Prep
5. Meeting Brief aligns with Sales Strategy Brief themes
6. Call Workspace live reasoning QA marker present when resolvable
7. HAC memory rows match canonical memory resolver bundle
8. Institutional learning affects confidence/advisory only (not primary action drift)
9. Relationship strategy essentials align with decision supporting actions
10. Send Plane resolves operator-approved transport assets

---

## Phase 3 — Operator polish walkthrough

Manual UI pass after automated harness passes:

- Home executive briefing
- Block Imaging lead workspace
- Human Approval Center package review
- Meeting prep / battle plan
- Call Workspace Operate + Overview
- Reply copilot (if reply exists)

Flag: capitalization, AI phrasing, duplicate panels, raw QA markers, Growth Engine terminology, debug labels.

---

## Phase 4 — Performance budgets (automated)

| Surface | Budget (warm) |
|---------|---------------|
| Home summary | ≤ 8s |
| Lead workspace | ≤ 4s |
| HAC packet | ≤ 5s |
| Meeting brief | ≤ 4s |
| Decision resolver (cached repeat) | second call ≤ 50% first |
| Memory resolver | ≤ 3s |
| Live reasoning (no session) | ≤ 3s skip acceptable |

---

## Phase 5 — Controlled operator validation sequence

### Gate 1 — Deployment identity
- Vercel alias `app.equipify.ai`
- Deployment ID + SHA includes batch commits `f75d4c85` / `61d5787a`

### Gate 2 — UI recovery (read-only)
- Home, Lead Workspace, HAC, Meeting Prep, Call Workspace surfaces load

### Gate 3 — Cross-surface consistency (read-only)
- Decision card, memory review, meeting brief, call guide, package assets
- Confirm no outbound execution

### Gate 4 — Metadata preview (optional)
- Post-call closure preview (`finalize=false`) only if needed

### Gate 5 — Operator walkthrough
- Review Block Imaging end-to-end; do not approve or send

### Gate 6 — Live call (explicit approval)
- Internal/test number only; validate Say This Next latency

---

## Blocker severity

| Level | Meaning |
|-------|---------|
| Critical | Wrong deployment, missing canonical wiring, production unreachable |
| High | Fingerprint drift, wrong company identity, legacy path active, memory mismatch |
| Medium | Polish defects, performance regression, exposed internal labels |
| Low | Minor copy awkwardness, non-hero fingerprint N/A |
