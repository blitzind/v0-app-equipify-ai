/**
 * GE-AI-UX-6A — AI ownership & accountability terminology (client-safe).
 */

export const GE_AI_UX_6A_QA_MARKER = "ge-ai-ux-6a-ai-ownership-accountability-v1" as const

export const AI_OWNERSHIP_MY_PRIORITIES_TITLE = "My Priorities" as const
export const AI_OWNERSHIP_ACCOMPLISHMENTS_TITLE = "What I Accomplished" as const
export const AI_OWNERSHIP_WEEKLY_GOALS_TITLE = "My Goals This Week" as const
export const AI_OWNERSHIP_WAITING_ON_YOU_TITLE = "Waiting On You" as const
export const AI_OWNERSHIP_BIGGEST_WIN_TITLE = "My Biggest Win" as const
export const AI_OWNERSHIP_BIGGEST_RISK_TITLE = "Biggest Risk" as const
export const AI_OWNERSHIP_WORKLOAD_TITLE = "Today's workload" as const
export const AI_OWNERSHIP_EXECUTIVE_REC_TITLE = "Here's my recommendation." as const

export const AI_OWNERSHIP_ACCOMPLISHMENT_GROUPS = [
  { id: "revenue", label: "Revenue" },
  { id: "pipeline", label: "Pipeline" },
  { id: "meetings", label: "Meetings" },
  { id: "prospecting", label: "Prospecting" },
  { id: "campaigns", label: "Campaigns" },
  { id: "relationships", label: "Relationships" },
  { id: "learning", label: "Learning" },
] as const

export const AI_OWNERSHIP_WAITING_ON_YOU_LIMIT = 5 as const

export function ownershipPhrase(kind: "responsible" | "monitoring" | "preparing" | "waiting" | "protecting" | "tracking" | "optimizing", detail: string): string {
  const trimmed = detail.trim().replace(/\.$/, "")
  const lower = trimmed.charAt(0).toLowerCase() + trimmed.slice(1)
  const map = {
    responsible: "I'm responsible for",
    monitoring: "I'm monitoring",
    preparing: "I'm preparing",
    waiting: "I'm waiting for",
    protecting: "I'm protecting",
    tracking: "I'm tracking",
    optimizing: "I'm optimizing",
  }
  return `${map[kind]} ${lower}.`
}

export function progressPercent(current: number, target: number): number {
  if (target <= 0) return current > 0 ? 100 : 0
  return Math.min(100, Math.max(0, Math.round((current / target) * 100)))
}

export function progressBarLabel(percent: number): string {
  const filled = Math.round(percent / 10)
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)}`
}
