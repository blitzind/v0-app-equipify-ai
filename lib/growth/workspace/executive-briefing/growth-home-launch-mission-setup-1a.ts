/** GE-AVA-LAUNCH-MISSION-SETUP-1A — Start Ava guided launch copy & constants (client-safe). */

export const GROWTH_AVA_LAUNCH_MISSION_SETUP_1A_QA_MARKER = "ge-ava-launch-mission-setup-1a-v1" as const

export const GROWTH_AVA_LAUNCH_MISSION_SETUP_RULE =
  "Start Ava setup reuses Growth Profile, Mission Center, Find Leads binding, mailbox readiness, and Human Approval guardrails — no new runtime engine or scheduler." as const

export const GROWTH_AVA_LAUNCH_MISSION_SETUP_TITLE = "Start Ava" as const

export const GROWTH_AVA_LAUNCH_MISSION_SETUP_DESCRIPTION =
  "Ava needs a Growth Profile, an active mission, and a lead search before she can begin working continuously." as const

export const GROWTH_AVA_LAUNCH_MISSION_SETUP_CTA = "Start Setup" as const

export const GROWTH_AVA_LAUNCH_MISSION_SETUP_COMPLETE_COPY =
  "Ava is ready to monitor your mission. She will prepare recommendations and wait for your approval before any outbound." as const

export const GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TITLE = "Acquire New Customers" as const

export const GROWTH_AVA_LAUNCH_MISSION_DEFAULT_OBJECTIVE_TYPE = "customers_acquired" as const

export const GROWTH_AVA_LAUNCH_MISSION_DEFAULT_TARGET = 10 as const

export const GROWTH_AVA_LAUNCH_MISSION_SETUP_STEP_LABELS = {
  growth_profile: "Growth Profile",
  mission: "Mission",
  lead_search: "Lead Search",
  mailbox_readiness: "Mailbox Readiness",
  approval_guardrails: "Approval Guardrails",
} as const

export const GROWTH_HOME_FIND_LEADS_SECTION_SELECTOR = '[data-workflow-step="find"]' as const

export const GROWTH_HOME_MAILBOX_READINESS_SECTION_SELECTOR =
  '[data-qa-section="home-operational-readiness"]' as const

export const GROWTH_HOME_START_AVA_SETUP_SECTION_SELECTOR = '[data-qa-section="home-start-ava-setup"]' as const
