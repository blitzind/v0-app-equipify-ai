/** GE-AIOS-10A — Deterministic narrative copy templates (client-safe). */

export const AVA_NARRATIVE_TODAY_PRIORITIES_TITLE = "Today's priorities" as const
export const AVA_NARRATIVE_SINCE_YESTERDAY_TITLE = "Since yesterday" as const
export const AVA_NARRATIVE_ALL_NORMAL_LINE = "Everything else is running normally." as const
export const AVA_NARRATIVE_PRIORITY_TITLE = "Ready for your review" as const
export const AVA_NARRATIVE_WORKED_ON_TITLE = "Today I worked on" as const

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

export function capitalizeSentence(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}
