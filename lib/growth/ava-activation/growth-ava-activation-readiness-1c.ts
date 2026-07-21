/** GE-AIOS-LAUNCH-1C — Server: evaluate activation readiness from existing setup gates. */

import "server-only"

import { areStartupAutonomyGuardrailsConfigured } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import {
  GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
  type GrowthAvaActivationReadiness,
  type GrowthAvaActivationReadinessBlocker,
} from "@/lib/growth/ava-activation/growth-ava-activation-types-1c"
import type { GrowthAutonomyApprovalPolicies } from "@/lib/growth/autonomy/growth-autonomy-types"
import {
  hasLeadSearchBound,
  resolveAcquisitionMission,
  type GrowthHomeLaunchMissionSetupInput,
} from "@/lib/growth/workspace/executive-briefing/growth-home-launch-mission-setup-synthesizer"

export function evaluateGrowthAvaActivationReadiness(input: {
  businessProfileApproved: boolean
  objectives: GrowthHomeLaunchMissionSetupInput["objectives"]
  mailboxWarnings: number
  expiredMailboxes: number
  connectedMailboxes: number
  aiTeammateOnboardingCompleted: boolean
  approvalPolicies: Partial<GrowthAutonomyApprovalPolicies>
}): GrowthAvaActivationReadiness {
  const blockers: GrowthAvaActivationReadinessBlocker[] = []
  const mission = resolveAcquisitionMission(input.objectives)
  const leadSearchBound = hasLeadSearchBound(mission)
  const hasConnectedMailbox = input.connectedMailboxes > 0
  const mailboxBlocksLaunch = input.expiredMailboxes > 0 || input.mailboxWarnings > 0
  const autonomyConfigured = areStartupAutonomyGuardrailsConfigured({
    approvalPolicies: input.approvalPolicies,
  })

  if (!input.aiTeammateOnboardingCompleted) {
    blockers.push({
      id: "meet_ava",
      label: "Meet Ava",
      summary: "Complete your AI teammate introduction first.",
    })
  }
  if (!input.businessProfileApproved) {
    blockers.push({
      id: "growth_profile",
      label: "Growth Profile",
      summary: "Approve your Growth Profile so I know who to pursue.",
    })
  }
  if (!mission) {
    blockers.push({
      id: "mission",
      label: "Sales mission",
      summary: "Create an acquisition mission so I know what to work toward.",
    })
  } else if (!leadSearchBound) {
    blockers.push({
      id: "lead_source",
      label: "Lead source",
      summary: "Connect a lead source to your mission so I can discover companies.",
    })
  }
  if (!hasConnectedMailbox) {
    blockers.push({
      id: "mailbox",
      label: "Mailbox",
      summary: "Connect a mailbox so I can prepare outreach for your review.",
    })
  } else if (mailboxBlocksLaunch) {
    blockers.push({
      id: "mailbox_health",
      label: "Mailbox health",
      summary: "Resolve mailbox connection issues before I begin working.",
    })
  }
  if (!autonomyConfigured) {
    blockers.push({
      id: "approval_guardrails",
      label: "Approval guardrails",
      summary: "Confirm I will always require your approval before sending outreach.",
    })
  }

  return {
    qaMarker: GROWTH_AVA_ACTIVATION_1C_QA_MARKER,
    ready: blockers.length === 0,
    blockers,
  }
}
