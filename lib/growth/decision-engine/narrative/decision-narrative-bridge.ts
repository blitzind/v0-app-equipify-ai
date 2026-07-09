/** GE-AIOS-10B — Bridge decision engine ranking into narrative story priority. */

import type { AvaPrioritizedStory, AvaStoryKind } from "@/lib/growth/ava-home/narrative/narrative-types"
import type { DecisionActionKind, NextBestAction } from "@/lib/growth/decision-engine/types"

const DECISION_TO_STORY_KIND: Record<DecisionActionKind, AvaStoryKind> = {
  review_approval: "approval",
  review_reply: "reply",
  meeting_prep: "meeting",
  prepare_outreach: "opportunity",
  continue_qualification: "discovery",
  research_company: "research",
  continue_mission: "mission",
  request_business_clarification: "risk",
  refresh_bi: "risk",
  wait: "general",
}

export function mapDecisionKindToStoryKind(kind: DecisionActionKind): AvaStoryKind {
  return DECISION_TO_STORY_KIND[kind] ?? "general"
}

export function mapDecisionActionsToStoryPriority(actions: NextBestAction[]): AvaPrioritizedStory[] {
  return actions
    .filter((action) => action.kind !== "wait")
    .map((action) => ({
      kind: mapDecisionKindToStoryKind(action.kind),
      priority: action.overall_score,
      factId: action.source_id,
    }))
}

export function buildTodayPrioritiesFromDecisionEngine(actions: NextBestAction[]): string[] {
  return actions
    .filter((action) => action.kind !== "wait" && action.kind !== "review_approval")
    .slice(0, 4)
    .map((action) => {
      const company = action.company_name?.trim()
      if (!company) return action.title.replace(/\.$/, "")
      if (/qualif/i.test(action.title)) return `Finish qualifying ${company}`
      if (/outreach|prepare|draft/i.test(action.title)) return `Prepare outreach for ${company}`
      if (/research/i.test(action.title)) return `Continue researching ${company}`
      return action.title.replace(/\.$/, "")
    })
}
