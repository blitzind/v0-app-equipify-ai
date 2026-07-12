/** GE-AVA-LAUNCH-MISSION-SETUP-1A / GE-AIOS-18D — Start Ava guided launch copy & constants (client-safe). */

import {
  GROWTH_HOME_GET_AVA_READY_COMPLETE_COPY,
  GROWTH_HOME_GET_AVA_READY_DESCRIPTION,
  GROWTH_HOME_GET_AVA_READY_TITLE,
} from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import {
  HOME_LIVING_GET_AVA_READY_COMPLETE_COPY,
  HOME_LIVING_GET_AVA_READY_DESCRIPTION,
  HOME_LIVING_GET_AVA_READY_TITLE,
} from "@/lib/growth/home/growth-home-living-experience-18e"
import {
  AI_TEAMMATE_DEFAULT_NAME,
  resolveAiTeammatePresentation,
  type AiTeammatePresentation,
} from "@/lib/workspace/ai-teammate-identity"
import { launchTeammate, meetTeammate } from "@/lib/workspace/ai-teammate-voice"

export const GROWTH_AVA_LAUNCH_MISSION_SETUP_1A_QA_MARKER = "ge-ava-launch-mission-setup-1a-v1" as const

export const GROWTH_AVA_LAUNCH_MISSION_SETUP_RULE =
  "Start Ava setup reuses Growth Profile, Mission Center, Find Leads binding, mailbox onboarding, autonomy settings, setup health, and Human Approval guardrails — no new runtime engine or scheduler." as const

export const GROWTH_AVA_LAUNCH_MISSION_SETUP_TITLE = HOME_LIVING_GET_AVA_READY_TITLE

export const GROWTH_AVA_LAUNCH_MISSION_SETUP_DESCRIPTION = HOME_LIVING_GET_AVA_READY_DESCRIPTION

export const GROWTH_AVA_LAUNCH_MISSION_SETUP_CTA = "Continue setup" as const

export const GROWTH_AVA_LAUNCH_MISSION_SETUP_COMPLETE_COPY = HOME_LIVING_GET_AVA_READY_COMPLETE_COPY

export const GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TITLE = "Acquire New Customers" as const

export const GROWTH_AVA_LAUNCH_MISSION_DEFAULT_OBJECTIVE_TYPE = "customers_acquired" as const

export const GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TARGET = 10 as const

export function growthLaunchMissionSetupStepLabels(teammate: AiTeammatePresentation) {
  return {
  meet_ava: meetTeammate(teammate),
  growth_profile: "Growth Profile & ICP",
  lead_source: "Lead Source & Mission",
  mailbox_readiness: "Mailbox Readiness",
  approval_guardrails: "Approval & Autonomy",
  calendar_booking: "Calendar & Booking",
  launch_ava: launchTeammate(teammate),
  } as const
}

export const GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS =
  growthLaunchMissionSetupStepLabels(resolveAiTeammatePresentation(AI_TEAMMATE_DEFAULT_NAME))

export const GROWTH_HOME_FIND_LEADS_SECTION_SELECTOR = '[data-workflow-step="find"]' as const

export const GROWTH_HOME_MAILBOX_READINESS_SECTION_SELECTOR =
  '[data-qa-section="home-operational-readiness"]' as const

export const GROWTH_HOME_START_AVA_SETUP_SECTION_SELECTOR = '[data-qa-section="home-start-ava-setup"]' as const
