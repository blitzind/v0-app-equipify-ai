/** Compute inclusive ISO date bounds for report presets. */

export type DateRangePreset =
  | "Last 30 days"
  | "Last 60 days"
  | "Last 90 days"
  | "Last 6 months"
  | "Last 12 months"
  | "Custom"

const PRESET_DAYS: Record<Exclude<DateRangePreset, "Custom">, number> = {
  "Last 30 days": 30,
  "Last 60 days": 60,
  "Last 90 days": 90,
  "Last 6 months": 180,
  "Last 12 months": 365,
}

export function isDateRangePreset(s: string): s is DateRangePreset {
  return s in PRESET_DAYS || s === "Custom"
}

export function reportRangeFromPreset(
  preset: string,
  customFrom?: string | null,
  customTo?: string | null,
): { from: string; to: string } {
  if (preset === "Custom" && customFrom && customTo) {
    return { from: customFrom, to: customTo }
  }
  const days = PRESET_DAYS[preset as keyof typeof PRESET_DAYS] ?? 180
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - days)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}
