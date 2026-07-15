/**
 * GE-AIOS-MISSION-ORCHESTRATION-1A — Home active missions projection from cached workspace summary.
 */

import type { GrowthCanonicalDecisionResolution } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import {
  buildCanonicalActiveMissionsProjection,
  buildCanonicalMission,
  buildCanonicalMissionsFromApprovalSnapshot,
} from "@/lib/growth/aios/missions/growth-canonical-mission-1a"
import type { GrowthCanonicalActiveMissionsProjection } from "@/lib/growth/aios/missions/growth-canonical-mission-1a-types"
import type {
  GrowthCanonicalOperatorApprovalSnapshot,
  GrowthCanonicalOperatorTask,
} from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-types"

export function projectCanonicalActiveMissionsForHome(input: {
  organizationId: string | null
  canonicalOperatorApproval: GrowthCanonicalOperatorApprovalSnapshot | null
  canonicalHeroDecision: GrowthCanonicalDecisionResolution | null
  canonicalOperatorTask: GrowthCanonicalOperatorTask | null
  heroLeadCompanyName?: string | null
}): GrowthCanonicalActiveMissionsProjection | null {
  if (!input.organizationId) return null

  const missions = buildCanonicalMissionsFromApprovalSnapshot({
    organizationId: input.organizationId,
    approvalSnapshot:
      input.canonicalOperatorApproval ?? {
        qaMarker: "ge-aios-operator-experience-1a-v1",
        outreachPackageCount: 0,
        outreachDraftCount: 0,
        pendingApprovalCount: 0,
        waitingForOperator: false,
        packages: [],
        topPackage: null,
      },
    decisionByLeadId: input.canonicalHeroDecision
      ? new Map([[input.canonicalHeroDecision.leadId, input.canonicalHeroDecision]])
      : undefined,
    operatorTaskByLeadId: input.canonicalOperatorTask?.leadId
      ? new Map([[input.canonicalOperatorTask.leadId, input.canonicalOperatorTask]])
      : undefined,
  })

  if (input.canonicalHeroDecision) {
    const heroLeadId = input.canonicalHeroDecision.leadId
    const alreadyIncluded = missions.some((row) => row.leadId === heroLeadId)
    if (!alreadyIncluded) {
      missions.push(
        buildCanonicalMission({
          organizationId: input.organizationId,
          leadId: heroLeadId,
          companyName:
            input.canonicalHeroDecision.companyName ??
            input.heroLeadCompanyName ??
            "Account",
          decisionResolution: input.canonicalHeroDecision,
          approvalSnapshot: input.canonicalOperatorApproval ?? undefined,
          operatorTask: input.canonicalOperatorTask ?? undefined,
          priorityScore: input.canonicalHeroDecision.decision.confidence,
        }),
      )
    }
  }

  return buildCanonicalActiveMissionsProjection({
    organizationId: input.organizationId,
    missions,
  })
}
