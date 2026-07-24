/** GE-AVA-MISSION-CENTER-1A — Mission detail sections (read-only aggregation). */

import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import type { GrowthMissionCenterDetailSection } from "@/lib/growth/mission-center/growth-mission-center-types"
import {
  buildLeadDiscoveryAdvancedItems,
  buildLeadDiscoveryDetailItems,
  formatMissionFindLeadsMonitoringStatus,
} from "@/lib/growth/mission-center/growth-mission-find-leads-binding-display"
import { GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER } from "@/lib/growth/mission-center/growth-mission-runtime-types"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import { buildAiOsMissionPlanningHref, GROWTH_AI_OS_PUBLIC_BASE_PATH } from "@/lib/growth/aios/ai-os-public-routes"
import { buildGrowthReviewHref } from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"

function artifactItems(objective: GrowthObjective, resourceTypes: string[]): string[] {
  const items: string[] = []
  for (const stage of Object.values(objective.executionContext?.stages ?? {})) {
    for (const artifact of stage.artifacts ?? []) {
      if (resourceTypes.includes(artifact.resourceType)) {
        items.push(artifact.label || `${artifact.resourceType} · ${artifact.resourceId.slice(0, 8)}`)
      }
    }
  }
  return [...new Set(items)].slice(0, 6)
}

function resolveFindLeadsBinding(objective: GrowthObjective) {
  const runtime = objective.executionContext?.missionRuntime
  if (runtime?.qa_marker !== GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER) return null
  return runtime.datamoon?.importRequestJson ? runtime.datamoon : null
}

export function buildMissionDetailSections(input: {
  objective: GrowthObjective
  businessProfileApproved: boolean
  pendingApprovalCount: number
  highConfidenceOpportunityCount?: number
  teammateName?: string | null
}): GrowthMissionCenterDetailSection[] {
  const teammate = resolveAiTeammatePresentation(input.teammateName)
  const planningHref = buildAiOsMissionPlanningHref(input.objective.id) ?? `${GROWTH_WORKSPACE_BASE_PATH}/objectives`
  const approvalsHref = buildGrowthReviewHref({ tab: "packages" })
  const findLeadsBinding = resolveFindLeadsBinding(input.objective)
  const leadDiscoveryItems = [
    ...buildLeadDiscoveryDetailItems(findLeadsBinding),
    ...artifactItems(input.objective, ["saved_search", "audience"]),
  ]
  const leadDiscoveryAdvanced = buildLeadDiscoveryAdvancedItems(findLeadsBinding)

  return [
    {
      id: "business_profile",
      title: "Business Profile",
      status: input.businessProfileApproved ? "ready" : "blocked",
      summary: input.businessProfileApproved
        ? `${teammate.name} is using your approved business profile.`
        : `${teammate.name} needs to understand your business first.`,
      items: input.businessProfileApproved ? ["Approved profile active"] : [],
      href: GROWTH_WORKSPACE_BASE_PATH,
    },
    {
      id: "lead_discovery",
      title: "Lead Discovery",
      status: findLeadsBinding || artifactItems(input.objective, ["saved_search", "audience"]).length > 0 ? "ready" : "not_started",
      summary: findLeadsBinding
        ? formatMissionFindLeadsMonitoringStatus(findLeadsBinding)
        : artifactItems(input.objective, ["saved_search", "audience"]).length > 0
          ? `${teammate.name} has active audiences and saved searches.`
          : `${teammate.name} recommends starting a lead search.`,
      items: leadDiscoveryItems.length > 0 ? leadDiscoveryItems : [],
      advancedItems: leadDiscoveryAdvanced.length > 0 ? leadDiscoveryAdvanced : undefined,
      href: GROWTH_WORKSPACE_BASE_PATH,
    },
    {
      id: "research",
      title: "Research",
      status: artifactItems(input.objective, ["research_run"]).length > 0 ? "in_progress" : "not_started",
      summary: artifactItems(input.objective, ["research_run"]).length > 0
        ? `${teammate.name} is researching companies.`
        : "Research will begin after leads are discovered.",
      items: artifactItems(input.objective, ["research_run", "enrichment_run"]),
      href: planningHref,
    },
    {
      id: "qualification",
      title: "Qualification",
      status: input.objective.runtime?.currentStageId === "buying_committee" ? "in_progress" : "not_started",
      summary: "Qualification uses existing workflow signals and research outcomes.",
      items: input.objective.plan?.researchRequirements?.slice(0, 4) ?? [],
      href: planningHref,
    },
    {
      id: "opportunity",
      title: "Opportunity",
      status: (input.highConfidenceOpportunityCount ?? 0) > 0 ? "ready" : "not_started",
      summary:
        (input.highConfidenceOpportunityCount ?? 0) > 0
          ? `${teammate.name} has identified ${input.highConfidenceOpportunityCount} high-confidence opportunities.`
          : "Opportunities appear after research and qualification.",
      items:
        (input.highConfidenceOpportunityCount ?? 0) > 0
          ? [`${input.highConfidenceOpportunityCount} opportunities ready to review`]
          : [],
      href: GROWTH_WORKSPACE_BASE_PATH,
    },
    {
      id: "outreach_preparation",
      title: "Outreach Preparation",
      status: artifactItems(input.objective, ["sequence"]).length > 0 ? "in_progress" : "not_started",
      summary: artifactItems(input.objective, ["sequence", "landing_page", "video_page"]).length > 0
        ? `${teammate.name} is preparing outreach.`
        : "Outreach drafts appear after qualification.",
      items: artifactItems(input.objective, ["sequence", "landing_page", "video_page"]),
      href: planningHref,
    },
    {
      id: "approval",
      title: "Approval",
      status: input.pendingApprovalCount > 0 ? "waiting" : "not_started",
      summary:
        input.pendingApprovalCount > 0
          ? `${teammate.name} is waiting for your approval.`
          : "No approvals pending right now.",
      items: input.pendingApprovalCount > 0 ? [`${input.pendingApprovalCount} items waiting for review`] : [],
      href: approvalsHref,
    },
    {
      id: "execution",
      title: "Execution",
      status: input.objective.runtime?.currentStageId === "launch" ? "in_progress" : "not_started",
      summary: "Execution runs only after explicit approval.",
      items: artifactItems(input.objective, ["campaign"]),
      href: planningHref,
    },
    {
      id: "learning",
      title: "Learning",
      status: input.objective.recommendations.length > 0 ? "in_progress" : "not_started",
      summary: input.objective.recommendations.length > 0
        ? `${teammate.name} has adaptive recommendations to review.`
        : "Learning insights accumulate as the mission progresses.",
      items: input.objective.recommendations.slice(0, 4).map((rec) => rec.recommendation),
      href: planningHref,
    },
  ]
}
