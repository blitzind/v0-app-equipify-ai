/**
 * GE-AIOS-MISSION-ORCHESTRATION-1A — Mission type + phase mapping from Decision Engine (client-safe).
 */

import type { GrowthCanonicalPrimaryAction } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"
import type {
  GrowthCanonicalMissionPhase,
  GrowthCanonicalMissionProgressStage,
  GrowthCanonicalMissionType,
} from "@/lib/growth/aios/missions/growth-canonical-mission-1a-types"

const MISSION_TYPE_LABELS: Record<GrowthCanonicalMissionType, string> = {
  research_prospect: "Research Prospect",
  acquire_customer: "Acquire Customer",
  continue_discovery: "Continue Discovery",
  prepare_proposal: "Prepare Proposal",
  negotiate: "Negotiate",
  await_decision: "Await Decision",
  onboard: "Onboard",
  expand_account: "Expand Account",
  recover_relationship: "Recover Relationship",
  renew_contract: "Renew Contract",
}

const PHASE_LABELS: Record<GrowthCanonicalMissionPhase, string> = {
  research: "Research",
  outreach: "Outreach",
  meeting: "Meeting",
  proposal: "Proposal",
  closed_won: "Closed Won",
}

export function resolveMissionTypeFromPrimaryAction(
  action: GrowthCanonicalPrimaryAction | null | undefined,
): GrowthCanonicalMissionType {
  switch (action) {
    case "research":
    case "contact":
      return "research_prospect"
    case "reply":
    case "send_promised_information":
    case "schedule_meeting":
    case "prepare_meeting":
    case "request_introduction":
    case "multi_thread":
      return "acquire_customer"
    case "prepare_pricing":
    case "prepare_proposal":
      return "prepare_proposal"
    case "wait":
      return "await_decision"
    case "pause":
      return "recover_relationship"
    case "disqualify":
    case "no_action":
      return "continue_discovery"
    default:
      return "acquire_customer"
  }
}

export function resolveMissionPhaseFromPrimaryAction(
  action: GrowthCanonicalPrimaryAction | null | undefined,
): GrowthCanonicalMissionPhase {
  switch (action) {
    case "research":
    case "contact":
    case "multi_thread":
    case "request_introduction":
      return "research"
    case "reply":
    case "send_promised_information":
      return "outreach"
    case "schedule_meeting":
    case "prepare_meeting":
      return "meeting"
    case "prepare_pricing":
    case "prepare_proposal":
      return "proposal"
    case "wait":
    case "pause":
    case "disqualify":
    case "no_action":
      return "research"
    default:
      return "research"
  }
}

export function buildMissionTitle(companyName: string, missionType: GrowthCanonicalMissionType): string {
  const label = MISSION_TYPE_LABELS[missionType]
  if (missionType === "acquire_customer") return `Acquire ${companyName}`
  if (missionType === "research_prospect") return `Research ${companyName}`
  return `${label} — ${companyName}`
}

export function buildMissionProgressStages(
  activePhase: GrowthCanonicalMissionPhase,
): GrowthCanonicalMissionProgressStage[] {
  const order: GrowthCanonicalMissionPhase[] = [
    "research",
    "outreach",
    "meeting",
    "proposal",
    "closed_won",
  ]
  const activeIndex = order.indexOf(activePhase)

  return order.map((phase, index) => {
    let filled = 0
    if (index < activeIndex) filled = 3
    else if (index === activeIndex) filled = 2
    return {
      phase,
      label: PHASE_LABELS[phase],
      filledSegments: filled,
      totalSegments: 3,
    }
  })
}

export function formatMissionPhaseLabel(phase: GrowthCanonicalMissionPhase): string {
  return PHASE_LABELS[phase]
}
