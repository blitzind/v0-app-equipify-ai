/** GROWTH-WORKSPACE-HOME-EXPERIENCE-2B — executive briefing presentation copy (client-safe). */

export const GROWTH_WORKSPACE_HOME_EXPERIENCE_2B_QA_MARKER =
  "growth-workspace-home-experience-2b-v1" as const

export const GROWTH_HOME_TODAY_AT_A_GLANCE = "Today at a glance" as const
export const GROWTH_HOME_AVA_RECOMMENDS = "Ava recommends" as const
export const GROWTH_HOME_NEEDS_YOUR_ATTENTION = "Needs Your Decision" as const
export const GROWTH_HOME_CAUGHT_UP_TITLE = "You're all caught up." as const
export const GROWTH_HOME_AVA_IDLE =
  "Ava doesn't need anything from you right now." as const

export const GROWTH_HOME_KPI_AVA_CONFIDENCE = "Ava's confidence" as const
export const GROWTH_HOME_KPI_COMPLETED_FOR_YOU = "Completed for you" as const
export const GROWTH_HOME_KPI_NEEDS_APPROVAL = "Needs approval" as const
export const GROWTH_HOME_KPI_PIPELINE_IMPACT = "Pipeline impact" as const
export const GROWTH_HOME_RECOMMENDATION_IMPACT = "Estimated impact" as const
export const GROWTH_HOME_SUPPORTING_METRICS = "Supporting metrics" as const

export const GROWTH_HOME_OPPORTUNITY_LABEL = "Opportunity" as const
export const GROWTH_HOME_RISK_LABEL = "Risk" as const
export const GROWTH_HOME_NO_OPPORTUNITY = "Nothing urgent to chase right now." as const
export const GROWTH_HOME_NO_RISK = "No risks detected." as const
export const GROWTH_HOME_NO_RECOMMENDATION = "No recommendations right now." as const
export const GROWTH_HOME_PIPELINE_HEALTHY = "Pipeline looks healthy." as const

export const GROWTH_HOME_EXPERIENCE_2B_SURFACES = [
  "lib/growth/workspace/executive-briefing/growth-home-experience-2b.ts",
  "components/growth/workspace/executive-briefing/growth-home-ava-hero-section.tsx",
  "components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section.tsx",
  "lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer.ts",
] as const

export type HomeDayPart = "morning" | "afternoon" | "evening"

export function resolveHomeDayPart(hour: number): HomeDayPart {
  if (hour >= 5 && hour < 12) return "morning"
  if (hour >= 12 && hour < 17) return "afternoon"
  return "evening"
}

/** Contextual subtitle beneath the greeting — local time only. */
export function resolveHomeContextualIntroLine(dayPart: HomeDayPart): string {
  if (dayPart === "morning") return "Here's what changed overnight."
  if (dayPart === "afternoon") return "Here's where your pipeline stands."
  return "Here's what I finished today."
}

/** First name from greeting like "Good morning, Mike." */
export function extractFirstNameFromGreeting(greeting: string): string | null {
  const match = greeting.match(/,\s*([^.!]+)/)
  return match?.[1]?.trim() ?? null
}

/** Teammate-voice status line from existing status labels. */
export function resolveAvaTeammateStatusLine(statusLabel: string, activityLabel?: string | null): string {
  const lower = statusLabel.toLowerCase()
  if (lower.includes("waiting") || lower.includes("approval")) {
    return "Ava is waiting for your approval."
  }
  if (lower.includes("idle") || lower.includes("caught")) {
    return "Ava completed today's work."
  }
  if (activityLabel?.trim()) {
    return `Ava is ${activityLabel.trim().replace(/^Ava\s+/i, "").replace(/\.$/, "")}.`
  }
  return "Ava is actively monitoring your pipeline."
}
