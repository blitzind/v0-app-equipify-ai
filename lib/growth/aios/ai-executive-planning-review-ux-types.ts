/** GE-AIOS-5B — Executive Planning Review UX (client-safe). */

import type { GrowthObjectiveStageId } from "@/lib/growth/objectives/growth-objective-types"

export const GROWTH_AIOS_5B_PHASE = "GE-AIOS-5B" as const

export const GROWTH_AI_EXECUTIVE_PLANNING_REVIEW_UX_QA_MARKER =
  "growth-aios-5b-executive-planning-review-ux-v1" as const

/** Executive funnel labels shown on Mission Planning Review (maps constitutional stages). */
export type AiOsExecutiveMissionFunnelStepId =
  | "discover"
  | "research"
  | "outreach"
  | "engagement"
  | "meeting"
  | "opportunity"
  | "closed_won"

export type AiOsExecutiveMissionFunnelStep = {
  id: AiOsExecutiveMissionFunnelStepId
  label: string
  constitutionalStages: readonly GrowthObjectiveStageId[]
}

export const AI_OS_EXECUTIVE_MISSION_FUNNEL: readonly AiOsExecutiveMissionFunnelStep[] = [
  { id: "discover", label: "Discover", constitutionalStages: ["discover"] },
  {
    id: "research",
    label: "Research",
    constitutionalStages: ["research", "enrich", "buying_committee"],
  },
  { id: "outreach", label: "Outreach", constitutionalStages: ["generate_assets", "launch"] },
  { id: "engagement", label: "Engagement", constitutionalStages: ["monitor", "adapt"] },
  { id: "meeting", label: "Meeting", constitutionalStages: ["book"] },
  { id: "opportunity", label: "Opportunity", constitutionalStages: ["book"] },
  { id: "closed_won", label: "Closed Won", constitutionalStages: ["complete"] },
] as const

export const AI_OS_EXECUTIVE_PLANNING_REVIEW_UX_RULE =
  "Mission Planning Review UX presents executive intelligence and operator approval — it never changes planning logic, APIs, or autonomous execution." as const
