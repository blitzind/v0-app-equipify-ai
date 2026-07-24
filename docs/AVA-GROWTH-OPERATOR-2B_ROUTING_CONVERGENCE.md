# AVA-GROWTH-OPERATOR-2B — Executive Approval Routing Convergence

Routing-only milestone. No redesign of the Executive Approval Package, no new approval surface, no changes to decision/escalation logic.

## Root cause

The Executive Approval Package (1D/2A) was implemented and certified, but **Operator UX-1A routing** sent operators to the CRM Lead Drawer whenever a `leadId` was known. Home, HAC, missions, and recommendations all used `resolveOperatorPackageReviewHref()` which preferred `/growth/leads/crm?open={leadId}` over `/growth/review?tab=packages&item={packageId}`.

## Canonical destination

```
/growth/review?tab=packages&item={packageId}
```

`leadId` is preserved as metadata on the approval snapshot — not as the navigation target.

## Before / after

### Before

```
Home → Review Package → CRM Lead Drawer → Cognitive Workspace
```

### After

```
Home → Review Package → Executive Approval Package → Approve / Edit / Reject
                                              ↓ (optional)
                                         View Lead → CRM
```

## Files changed

| File | Change |
|------|--------|
| `lib/growth/workspace/ux-1a/review/growth-review-routes.ts` | Package-first `resolveOperatorPackageReviewHref`, 2B legacy remap |
| `lib/growth/workspace/ux-2b/review/growth-executive-approval-routing-2b.ts` | QA marker module |
| `lib/growth/aios/missions/growth-canonical-mission-1a.ts` | Pending approval → executive package href |
| `lib/growth/home/growth-home-canonical-startup-experience-18d.ts` | Runtime trust approvals path |
| `lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts` | Hero href normalization |
| `lib/growth/mission-center/growth-mission-center-synthesizer.ts` | Review Approvals href |
| `lib/growth/mission-center/growth-mission-center-detail-sections.ts` | Pipeline approval section href |
| `lib/growth/mission-center/growth-mission-ava-launch-run-*.ts` | Launch result approvals href |
| `lib/growth/aios/platform/growth-platform-consolidation-1f.ts` | Registry entry |
| `scripts/test-ava-growth-operator-2b-routing-convergence.ts` | Certification |
| Updated legacy cert scripts | CRM → executive package assertions |

## Remaining CRM entry points (intentional)

- **View Lead** link inside `GrowthAvaCompletedOutreachPackageCard`
- Browsing `/growth/leads/crm` directly
- Lead operational workflows (research, calls, relationship history)
- Mission workspace href when **no** pending executive approval

## Validation

```bash
pnpm test:ava-growth-operator-2b-routing-convergence   # PASS
pnpm test:ava-growth-operator-2a-executive-experience   # PASS
pnpm test:ava-growth-operator-1f-platform-consolidation # PASS
pnpm build
```

## Production validation

1. Home → **Review package** → opens `/growth/review?tab=packages&item=…` with executive package drawer
2. **What I need from you** item → same destination
3. **Continue** on Current Recommendation → same destination
4. **Open mission** (pending approval) → executive package, not CRM drawer
5. HAC / Runtime Trust review links → review queue or specific package
6. **View Lead** inside package → CRM drawer opens
7. Approve / Request Changes / Reject actions unchanged
