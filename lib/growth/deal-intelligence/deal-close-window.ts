import type {
  DealIntelligenceCloseWindow,
} from "@/lib/growth/deal-intelligence/deal-intelligence-types"

export function predictDealCloseWindow(input: {
  closeProbability: number
  expectedCloseDate: string | null
  meetingsScheduled: number
  now?: Date
}): DealIntelligenceCloseWindow {
  const now = input.now ?? new Date()
  if (input.expectedCloseDate) {
    const days = Math.ceil((Date.parse(input.expectedCloseDate) - now.getTime()) / (24 * 60 * 60 * 1000))
    if (days <= 7) return "this_week"
    if (days <= 14) return "next_14_days"
    if (days <= 31) return "this_month"
    if (days <= 92) return "next_quarter"
  }
  if (input.closeProbability >= 70 && input.meetingsScheduled > 0) return "next_14_days"
  if (input.closeProbability >= 55) return "this_month"
  return "unknown"
}
