/** Deterministic external signal weights — pure functions (client-safe). */

import type { LeadSignalType } from "@/lib/growth/signal-intelligence/lead-signal-event-types"

export const EXTERNAL_SIGNAL_WEIGHT_POINTS: Partial<Record<LeadSignalType, number>> = {
  funding_event: 20,
  leadership_change: 15,
  company_hiring: 15,
  expansion_event: 15,
  technology_change: 12,
  pricing_page_visit: 20,
  repeat_visit: 10,
  demo_page_visit: 25,
  competitor_search: 15,
  high_intent_search: 20,
  high_engagement_visit: 18,
  category_interest: 12,
  contact_page_visit: 14,
}

export function externalSignalWeightPoints(signalType: LeadSignalType): number {
  return EXTERNAL_SIGNAL_WEIGHT_POINTS[signalType] ?? 8
}

export function externalSignalConfidenceFromWeight(signalType: LeadSignalType, baseConfidence = 0.7): number {
  const weight = externalSignalWeightPoints(signalType)
  return Math.min(1, Math.max(0.35, baseConfidence + weight / 100))
}

export function externalSignalRoutingPriority(signalType: LeadSignalType): number {
  const weight = externalSignalWeightPoints(signalType)
  return Math.min(100, Math.max(10, weight + 40))
}

export function externalSignalCommandCenterBoost(signalType: LeadSignalType): number {
  const weight = externalSignalWeightPoints(signalType)
  if (weight >= 20) return 6
  if (weight >= 15) return 4
  if (weight >= 10) return 2
  return 1
}

export function externalSignalAttentionTier(signalType: LeadSignalType): "hot" | "expansion" | "monitor" | null {
  if (signalType === "pricing_page_visit" || signalType === "demo_page_visit" || signalType === "high_intent_search") {
    return "hot"
  }
  if (
    signalType === "company_hiring" ||
    signalType === "expansion_event" ||
    signalType === "funding_event"
  ) {
    return "expansion"
  }
  if (signalType === "competitor_search" || signalType === "leadership_change") {
    return "monitor"
  }
  return null
}
