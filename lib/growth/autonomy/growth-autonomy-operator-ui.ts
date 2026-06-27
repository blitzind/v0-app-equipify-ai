/**
 * GE-AUTO-UI-2 — Operator-facing labels and groupings for Growth Autonomy settings.
 * Client-safe presentation layer only; internal IDs unchanged for API patches.
 */

import type {
  GrowthAutonomyBudgetKey,
  GrowthAutonomyCapability,
  GrowthAutonomyMasterMode,
} from "@/lib/growth/autonomy/growth-autonomy-types"

export const GE_AUTO_UI_2_QA_MARKER = "ge-auto-ui-2-v1" as const

export const GROWTH_AUTONOMY_CONTROL_CENTER_TITLE = "Growth Autonomy" as const

export const GROWTH_AUTONOMY_CONTROL_CENTER_SUBTITLE =
  "Control how much AI OS can do on its own while keeping approvals and safety limits in place." as const

export const GROWTH_AUTONOMY_BUDGET_OPERATOR_LABELS: Record<GrowthAutonomyBudgetKey, string> = {
  autonomous_research_runs: "Prospect research runs",
  autonomous_page_generations: "Pages generated",
  autonomous_video_generations: "Videos generated",
  autonomous_campaigns: "Campaigns launched",
  autonomous_outbound_actions: "Autonomous sends",
}

export const GROWTH_AUTONOMY_CAPABILITY_OPERATOR_LABELS: Record<GrowthAutonomyCapability, string> = {
  research: "Research companies",
  enrichment: "Enrich contacts",
  audience_generation: "Find prospects & build audiences",
  page_generation: "Generate pages",
  video_generation: "Generate videos",
  campaign_launch: "Build campaigns",
  recommendations: "Suggest next steps",
  task_creation: "Create tasks",
  strategy_adaptation: "Adapt strategy",
  email_execution: "Email outreach",
  sms_execution: "SMS outreach",
  voice_execution: "Voice drop outreach",
}

export const GROWTH_AUTONOMY_CAPABILITY_OPERATOR_DESCRIPTIONS: Partial<
  Record<GrowthAutonomyCapability, string>
> = {
  email_execution: "Prepare drafts and send when outbound autonomy is enabled.",
  sms_execution: "Prepare messages and send when outbound autonomy is enabled.",
  voice_execution: "Prepare voice drops and send when outbound autonomy is enabled.",
}

export const GROWTH_AUTONOMY_CAPABILITY_OPERATOR_GROUPS: ReadonlyArray<{
  title: string
  description: string
  ids: readonly GrowthAutonomyCapability[]
}> = [
  {
    title: "Find & Learn",
    description: "Discover and understand prospects before you engage.",
    ids: ["research", "enrichment", "audience_generation"],
  },
  {
    title: "Create",
    description: "Generate pages, videos, and campaigns within daily limits.",
    ids: ["page_generation", "video_generation", "campaign_launch"],
  },
  {
    title: "Recommend",
    description: "Suggest next steps and internal work for your team.",
    ids: ["recommendations", "task_creation", "strategy_adaptation"],
  },
  {
    title: "Outreach",
    description: "Prepare and optionally send outreach by channel.",
    ids: ["email_execution", "sms_execution", "voice_execution"],
  },
]

export const GROWTH_AUTONOMY_OUTBOUND_LOCKED_MESSAGE = "Locked — requires outbound autonomy" as const

export const GROWTH_AUTONOMY_OPERATING_MODE_OPERATOR_COPY: Record<
  GrowthAutonomyMasterMode,
  { title: string; description: string; safetyNote: string }
> = {
  manual: {
    title: "Manual",
    description: "Everything requires you.",
    safetyNote: "Safest default — AI OS only assists when you ask.",
  },
  assisted: {
    title: "Assisted",
    description: "AI can recommend and prepare work, but you stay in control.",
    safetyNote: "Outbound still needs your approval before anything goes out.",
  },
  guardrailed: {
    title: "Guardrailed",
    description: "AI can run safe internal tasks within limits.",
    safetyNote: "Daily caps and approval rules still apply.",
  },
  channel: {
    title: "Channel",
    description: "AI can prepare outreach by channel and queue it for approval.",
    safetyNote: "Autonomous send stays off unless you enable it per channel.",
  },
  objective: {
    title: "Objective",
    description: 'AI can work toward goals like "book demos" using approved limits.',
    safetyNote: "Objectives follow the same approval and budget guardrails.",
  },
}

export const GROWTH_AUTONOMY_KILL_SWITCH_OPERATOR_LABELS: Record<
  "autonomyEnabled" | "autonomyOutboundEnabled" | "autonomyGenerationEnabled" | "autonomyObjectiveModeEnabled",
  string
> = {
  autonomyEnabled: "Allow AI OS to act autonomously",
  autonomyOutboundEnabled: "Allow autonomous outbound send",
  autonomyGenerationEnabled: "Allow autonomous content generation",
  autonomyObjectiveModeEnabled: "Allow objective-driven autonomy",
}

export type GrowthAutonomyApprovalDisplayCategory =
  | "internal"
  | "approval_required"
  | "outbound_locked"

export const GROWTH_AUTONOMY_APPROVAL_OPERATOR_ROWS: ReadonlyArray<{
  label: string
  category: GrowthAutonomyApprovalDisplayCategory
  capabilityIds: readonly GrowthAutonomyCapability[]
}> = [
  {
    label: "Research & enrichment",
    category: "internal",
    capabilityIds: ["research", "enrichment", "audience_generation", "recommendations", "strategy_adaptation"],
  },
  {
    label: "Page & video generation",
    category: "internal",
    capabilityIds: ["page_generation", "video_generation", "task_creation"],
  },
  {
    label: "Campaign launch",
    category: "approval_required",
    capabilityIds: ["campaign_launch"],
  },
  {
    label: "Email, SMS & voice send",
    category: "outbound_locked",
    capabilityIds: ["email_execution", "sms_execution", "voice_execution"],
  },
]

export function resolveGrowthAutonomyOutboundStatusLabel(status: {
  outboundLocked: boolean
  shadowModeEnabled: boolean
  sendEnabled: boolean
}): string {
  if (status.outboundLocked) return "Locked"
  if (status.shadowModeEnabled) return "Shadow only"
  if (status.sendEnabled) return "Autonomous send enabled"
  return "Approval required"
}

export function formatAllowedListSummary(value: string): string {
  const count = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean).length
  if (count === 0) return "Not restricted"
  return `${count} configured`
}

export function countAllowedEntries(value: string): number {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean).length
}
