import type { IngestedMemoryCandidate } from "@/lib/growth/lead-memory/memory-ingestion"
import type { GrowthLeadPreferenceMemory, GrowthLeadPreferenceType, GrowthMemoryConfidence } from "@/lib/growth/lead-memory/memory-types"

export function mapCandidateToPreference(candidate: IngestedMemoryCandidate): {
  preferenceType: GrowthLeadPreferenceType
  preferenceKey: string
  preferenceValue: string
  confidence: GrowthMemoryConfidence
  evidenceSnippet: string
} | null {
  if (candidate.memoryCategory === "communication_preference") {
    const value = inferCommunicationPreference(candidate.evidenceSnippet)
    return {
      preferenceType: "communication_preference",
      preferenceKey: "channel_hint",
      preferenceValue: value,
      confidence: candidate.confidence,
      evidenceSnippet: candidate.evidenceSnippet,
    }
  }
  if (candidate.memoryCategory === "budget_signal") {
    return {
      preferenceType: "buying_preference",
      preferenceKey: "budget_sensitivity",
      preferenceValue: "price_conscious",
      confidence: candidate.confidence,
      evidenceSnippet: candidate.evidenceSnippet,
    }
  }
  if (candidate.memoryCategory === "timeline_signal") {
    return {
      preferenceType: "timing_preference",
      preferenceKey: "timeline",
      preferenceValue: "active_planning",
      confidence: candidate.confidence,
      evidenceSnippet: candidate.evidenceSnippet,
    }
  }
  if (candidate.memoryCategory === "meeting_signal") {
    return {
      preferenceType: "channel_preference",
      preferenceKey: "meeting_interest",
      preferenceValue: "open_to_meeting",
      confidence: candidate.confidence,
      evidenceSnippet: candidate.evidenceSnippet,
    }
  }
  return null
}

function inferCommunicationPreference(text: string): string {
  if (/\bemail\b/i.test(text)) return "email_preferred"
  if (/\bcall|phone\b/i.test(text)) return "call_preferred"
  if (/\blinkedin\b/i.test(text)) return "linkedin_preferred"
  if (/\bmorning\b/i.test(text)) return "morning_contact"
  if (/\bafternoon\b/i.test(text)) return "afternoon_contact"
  return "unspecified"
}

export function rankPreferences(preferences: GrowthLeadPreferenceMemory[]): GrowthLeadPreferenceMemory[] {
  return [...preferences].sort((a, b) => a.preferenceType.localeCompare(b.preferenceType))
}
