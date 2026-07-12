import {
  AI_TEAMMATE_DEFAULT_NAME,
  resolveAiTeammatePresentation,
  type AiTeammatePresentation,
} from "@/lib/workspace/ai-teammate-identity"
/** GROWTH-WORKSPACE-DASHBOARD-REFINEMENT-2A — executive hero UX copy (client-safe). */

export const GROWTH_WORKSPACE_DASHBOARD_REFINEMENT_2A_QA_MARKER =
  "growth-workspace-dashboard-refinement-2a-v1" as const

export function growthHomeHeroRecommends(teammate: AiTeammatePresentation): string {
  return `${teammate.name} recommends`
}
export const GROWTH_HOME_HERO_AVA_RECOMMENDS =
  growthHomeHeroRecommends(resolveAiTeammatePresentation(AI_TEAMMATE_DEFAULT_NAME))
export const GROWTH_HOME_HERO_KPI_CONFIDENCE = "Confidence" as const
export function growthHomeHeroTasksCompleted(teammate: AiTeammatePresentation): string {
  return `Tasks ${teammate.name} completed`
}
export const GROWTH_HOME_HERO_KPI_TASKS_COMPLETED =
  growthHomeHeroTasksCompleted(resolveAiTeammatePresentation(AI_TEAMMATE_DEFAULT_NAME))
export const GROWTH_HOME_HERO_KPI_NEEDS_APPROVAL = "Needs approval" as const
export const GROWTH_HOME_HERO_KPI_REVENUE_INFLUENCED = "Revenue influenced" as const
export const GROWTH_HOME_HERO_OPPORTUNITY_LABEL = "Biggest opportunity" as const
export const GROWTH_HOME_HERO_RISK_LABEL = "Biggest risk" as const

export const GROWTH_DASHBOARD_REFINEMENT_2A_SURFACES = [
  "lib/growth/workspace/executive-briefing/growth-home-dashboard-refinement-2a.ts",
  "components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-executive-briefing-dashboard.tsx",
  "components/growth/objectives/growth-objectives-dashboard.tsx",
  "lib/growth/objectives/growth-objective-types.ts",
] as const
