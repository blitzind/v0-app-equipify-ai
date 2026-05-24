/** Client-safe sequence enrollment UI helpers. */

import { GROWTH_SEQUENCE_CATALOG_KEYS } from "@/lib/growth/sequence-types"
import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_SEQUENCE_TEST_PATTERN_KEYS = GROWTH_SEQUENCE_CATALOG_KEYS

export type SequenceStartAvailability = {
  canStart: boolean
  code: string | null
  message: string | null
}

export function describeSequenceStartUnavailable(
  lead: GrowthLead,
  input: {
    hasEnrollment: boolean
    preflightCode?: string | null
    preflightReason?: string | null
  },
): SequenceStartAvailability {
  if (input.hasEnrollment) {
    return {
      canStart: false,
      code: "active_enrollment",
      message: "Existing sequence active",
    }
  }

  if (!lead.recommendedSequencePatternId) {
    return {
      canStart: false,
      code: "no_recommendation",
      message: "No recommended sequence yet",
    }
  }

  if (lead.sequenceFatigueRisk === "high") {
    return {
      canStart: false,
      code: "fatigue_blocked",
      message: "High fatigue risk",
    }
  }

  if (input.preflightCode) {
    return {
      canStart: false,
      code: input.preflightCode,
      message: mapPreflightCodeToMessage(input.preflightCode, input.preflightReason),
    }
  }

  if ((lead.recommendedSequenceConfidence ?? 0) < 40) {
    return {
      canStart: false,
      code: "low_confidence",
      message: "Need more outreach activity",
    }
  }

  return { canStart: true, code: null, message: null }
}

export function mapPreflightCodeToMessage(code: string, reason?: string | null): string {
  switch (code) {
    case "no_recommendation":
      return "No recommended sequence yet"
    case "low_confidence":
      return "Need more outreach activity"
    case "fatigue_blocked":
      return "High fatigue risk"
    case "active_enrollment":
      return "Existing sequence active"
    case "lead_blocked":
      return reason ?? "Lead is not eligible for sequence enrollment."
    case "suppressed":
      return reason ?? "Contact is suppressed."
    default:
      return reason ?? "Sequence enrollment unavailable."
  }
}
