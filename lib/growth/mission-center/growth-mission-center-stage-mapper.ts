/** GE-AVA-MISSION-CENTER-1A — Presentation stage mapper (does not alter runtime stages). */

import type { GrowthObjectiveStageId } from "@/lib/growth/objectives/growth-objective-types"
import type { GrowthMissionCenterPresentationStage } from "@/lib/growth/mission-center/growth-mission-center-types"

const RUNTIME_TO_PRESENTATION: Record<GrowthObjectiveStageId, GrowthMissionCenterPresentationStage> = {
  discover: "lead_discovery",
  research: "research",
  enrich: "research",
  buying_committee: "qualification",
  generate_assets: "outreach_preparation",
  launch: "execution",
  monitor: "execution",
  adapt: "learning",
  book: "opportunity",
  complete: "learning",
}

const PRESENTATION_LABELS: Record<GrowthMissionCenterPresentationStage, string> = {
  business_profile: "Business Profile",
  lead_discovery: "Lead Discovery",
  research: "Research",
  qualification: "Qualification",
  opportunity: "Opportunity",
  outreach_preparation: "Outreach Preparation",
  approval: "Approval",
  execution: "Execution",
  learning: "Learning",
}

const AVA_ACTIVITY_BY_STAGE: Record<GrowthMissionCenterPresentationStage, string> = {
  business_profile: "Ava needs to understand your business first.",
  lead_discovery: "Ava is finding companies that match your ideal customer.",
  research: "Ava is researching companies.",
  qualification: "Ava is qualifying the best-fit accounts.",
  opportunity: "Ava is identifying high-confidence opportunities.",
  outreach_preparation: "Ava is preparing outreach.",
  approval: "Ava is waiting for your approval.",
  execution: "Ava is executing approved outreach.",
  learning: "Ava is learning from outcomes and adapting.",
}

export function mapRuntimeStageToPresentationStage(
  stageId: GrowthObjectiveStageId | null | undefined,
): GrowthMissionCenterPresentationStage {
  if (!stageId) return "lead_discovery"
  return RUNTIME_TO_PRESENTATION[stageId] ?? "research"
}

export function presentationStageLabel(stage: GrowthMissionCenterPresentationStage): string {
  return PRESENTATION_LABELS[stage]
}

export function avaActivityForPresentationStage(
  stage: GrowthMissionCenterPresentationStage,
  context?: { companyCount?: number; opportunityCount?: number; importCount?: number },
): string {
  if (stage === "research" && context?.companyCount) {
    return `Ava is researching ${context.companyCount} ${context.companyCount === 1 ? "company" : "companies"}.`
  }
  if (stage === "opportunity" && context?.opportunityCount) {
    return `Ava has identified ${context.opportunityCount} high-confidence ${context.opportunityCount === 1 ? "opportunity" : "opportunities"}.`
  }
  if (stage === "lead_discovery" && context?.importCount) {
    return `Ava recommends importing ${context.importCount} ${context.importCount === 1 ? "company" : "companies"}.`
  }
  return AVA_ACTIVITY_BY_STAGE[stage]
}

export function presentationStageStatusLabel(stage: GrowthMissionCenterPresentationStage): string {
  switch (stage) {
    case "business_profile":
      return "Blocked"
    case "lead_discovery":
      return "Finding leads"
    case "research":
      return "Researching"
    case "qualification":
      return "Qualifying"
    case "opportunity":
      return "Reviewing opportunities"
    case "outreach_preparation":
      return "Preparing outreach"
    case "approval":
      return "Waiting on you"
    case "execution":
      return "Executing"
    case "learning":
      return "Learning"
    default:
      return "In progress"
  }
}
