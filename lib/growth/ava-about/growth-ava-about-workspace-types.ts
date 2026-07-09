/** GE-AIOS-19C-2F — About Your AI workspace types (client-safe). */

export const GROWTH_AVA_ABOUT_WORKSPACE_19C_2F_QA_MARKER = "ge-aios-19c-2f-about-your-ai-v1" as const

export const GROWTH_AVA_ABOUT_WORKSPACE_ROUTE = "/growth/ava" as const

export const GROWTH_AVA_ABOUT_WORKSPACE_TITLE = "About Your AI" as const

export const GROWTH_AVA_ABOUT_WORKSPACE_DESCRIPTION =
  "Who your AI teammate is, what they can do, what needs your approval, and how they're working today." as const

export type GrowthAvaAboutCapabilityStatus = "available" | "requires_setup" | "coming_soon" | "disabled"

export type GrowthAvaAboutCapabilityRow = {
  id: string
  label: string
  description: string | null
  status: GrowthAvaAboutCapabilityStatus
  statusLabel: string
  href: string | null
}

export type GrowthAvaAboutToolRow = {
  id: string
  label: string
  connected: boolean
  summary: string
  href: string | null
}

export type GrowthAvaAboutPermissionGroup = {
  title: string
  items: string[]
}

export type GrowthAvaAboutActivityRow = {
  id: string
  label: string
  value: string
}

export type GrowthAvaAboutReadModel = {
  qaMarker: typeof GROWTH_AVA_ABOUT_WORKSPACE_19C_2F_QA_MARKER
  meetIntro: string
  statusLabel: string
  activityLabel: string
  currentFocus: string | null
  nextPlannedWork: string | null
  capabilities: GrowthAvaAboutCapabilityRow[]
  tools: GrowthAvaAboutToolRow[]
  permissions: {
    canDo: GrowthAvaAboutPermissionGroup
    needApproval: GrowthAvaAboutPermissionGroup
  }
  learning: {
    recentlyLearned: string[]
    improving: string[]
    needsCoaching: string[]
    trainingHref: string
  }
  activity: GrowthAvaAboutActivityRow[]
  autonomy: {
    modeTitle: string
    modeDescription: string
    safetyNote: string
    outboundLabel: string
    paused: boolean
    settingsHref: string
  }
  identitySettingsHref: string
  operationsHref: string
  trainingHref: string
  degraded: boolean
  degradedMessage: string | null
}
