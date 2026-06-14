/** Deterministic revenue / conversion impact estimators — no ML (client-safe). */

import type { LeadSignalType } from "@/lib/growth/signal-intelligence/lead-signal-event-types"
import { externalSignalWeightPoints } from "@/lib/growth/signal-intelligence/external-signal-scoring"

export type SignalExpectedImpact = {
  summary: string
  dimension: "reply_lift" | "meeting_likelihood" | "opportunity_lift" | "revenue_impact" | "readiness"
  level: "low" | "moderate" | "high" | "very_high"
}

function levelFromWeight(weight: number): SignalExpectedImpact["level"] {
  if (weight >= 22) return "very_high"
  if (weight >= 18) return "high"
  if (weight >= 12) return "moderate"
  return "low"
}

export function estimateSignalExpectedImpact(signalType: LeadSignalType): SignalExpectedImpact {
  const weight = externalSignalWeightPoints(signalType)
  const level = levelFromWeight(weight)

  switch (signalType) {
    case "funding_event":
      return {
        summary: `Opportunity increase potential: ${capitalize(level)}`,
        dimension: "opportunity_lift",
        level,
      }
    case "pricing_page_visit":
    case "demo_page_visit":
    case "contact_page_visit":
      return {
        summary: `Meeting likelihood increase: ${capitalize(level === "very_high" ? "high" : level)}`,
        dimension: "meeting_likelihood",
        level: level === "very_high" ? "high" : level,
      }
    case "company_hiring":
    case "expansion_event":
    case "leadership_change":
      return {
        summary: `Expansion opportunity likelihood: ${capitalize(level === "very_high" ? "high" : level === "high" ? "moderate" : level)}`,
        dimension: "opportunity_lift",
        level: level === "very_high" || level === "high" ? "moderate" : level,
      }
    case "positive_reply":
    case "meeting_requested":
      return {
        summary: `Opportunity readiness increase: ${capitalize(level === "low" ? "moderate" : level)}`,
        dimension: "readiness",
        level: level === "low" ? "moderate" : level,
      }
    case "meeting_completed":
    case "opportunity_created":
    case "stage_advanced":
    case "deal_won":
      return {
        summary: `Expected revenue impact: ${capitalize(level === "low" ? "moderate" : level)}`,
        dimension: "revenue_impact",
        level: level === "low" ? "moderate" : level,
      }
    case "competitor_search":
    case "high_intent_search":
      return {
        summary: `Expected opportunity lift: ${capitalize(level)}`,
        dimension: "opportunity_lift",
        level,
      }
    case "repeat_visit":
    case "high_engagement_visit":
      return {
        summary: `Expected reply lift: ${capitalize(level === "very_high" ? "high" : level === "high" ? "moderate" : level)}`,
        dimension: "reply_lift",
        level: level === "very_high" ? "high" : level === "high" ? "moderate" : level,
      }
    default:
      return {
        summary: `Signal influence: ${capitalize(level)}`,
        dimension: "readiness",
        level,
      }
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ")
}
