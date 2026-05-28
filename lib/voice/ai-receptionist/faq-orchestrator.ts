/** Approved FAQ orchestration — Phase 4A. Approved answers only. */

import type { VoiceAiReceptionistFaqEntryPublicView } from "@/lib/voice/ai-receptionist/types"

export type FaqMatchResult =
  | { matched: true; entry: VoiceAiReceptionistFaqEntryPublicView; confidence: number }
  | { matched: false; reason: "no_match" | "blocked" | "escalation_required" }

export function matchApprovedFaq(
  callerText: string,
  entries: VoiceAiReceptionistFaqEntryPublicView[],
): FaqMatchResult {
  const normalized = callerText.toLowerCase().trim()
  if (!normalized) return { matched: false, reason: "no_match" }

  for (const entry of entries) {
    if (entry.blocked) continue
    const pattern = entry.questionPattern.toLowerCase()
    if (normalized.includes(pattern) || pattern.split("|").some((p) => normalized.includes(p.trim()))) {
      if (entry.escalationRequired) {
        return { matched: false, reason: "escalation_required" }
      }
      return { matched: true, entry, confidence: 0.85 }
    }
  }

  return { matched: false, reason: "no_match" }
}

export function buildDefaultFaqEntries(organizationId: string): Omit<
  VoiceAiReceptionistFaqEntryPublicView,
  "id"
>[] {
  return [
    {
      organizationId,
      topic: "hours",
      questionPattern: "hours|open|when are you",
      approvedAnswer:
        "Our business hours vary by location. I can collect your callback number and have a team member confirm hours for your area.",
      escalationRequired: false,
      blocked: false,
      sortOrder: 1,
    },
    {
      organizationId,
      topic: "service_area",
      questionPattern: "service area|do you serve|coverage",
      approvedAnswer:
        "We serve commercial equipment businesses in configured service territories. I can note your location for a team member to confirm coverage.",
      escalationRequired: false,
      blocked: false,
      sortOrder: 2,
    },
    {
      organizationId,
      topic: "pricing",
      questionPattern: "price|pricing|cost|quote",
      approvedAnswer:
        "Pricing depends on scope and equipment. A team member will provide an accurate quote — I cannot commit to pricing.",
      escalationRequired: true,
      blocked: false,
      sortOrder: 3,
    },
  ]
}
