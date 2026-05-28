/** Draft kind → relationship memory type mapping (deterministic). */

import type { VoiceRelationshipMemoryType } from "@/lib/voice/relationship-memory/types"

const DRAFT_KIND_TO_MEMORY_TYPE: Record<string, VoiceRelationshipMemoryType> = {
  objection: "pricing_objection",
  pricing_objection: "pricing_objection",
  competitor: "competitor_mention",
  competitor_mention: "competitor_mention",
  timeline: "scheduling_preference",
  committee: "decision_maker",
  decision_maker: "decision_maker",
  callback: "callback_preference",
  channel: "preferred_channel",
  budget: "budget_concern",
  urgency: "urgency_signal",
  cancellation: "cancellation_risk",
  follow_up: "follow_up_request",
  booking: "booking_interest",
  positive: "positive_sentiment",
  negative: "negative_sentiment",
  escalation: "escalation_pattern",
}

const EVENT_TYPE_TO_MEMORY_TYPE: Record<string, VoiceRelationshipMemoryType> = {
  pricing_objection: "pricing_objection",
  timing_objection: "pricing_objection",
  competitor_mention: "competitor_mention",
  ready_to_book: "booking_interest",
  decision_maker_signal: "decision_maker",
  urgency_signal: "urgency_signal",
  cancellation_risk: "cancellation_risk",
  angry_caller: "negative_sentiment",
  opt_out_intent: "cancellation_risk",
}

export function mapDraftKindToMemoryType(draftKind: string, draftLabel?: string): VoiceRelationshipMemoryType {
  const normalized = draftKind.trim().toLowerCase()
  if (DRAFT_KIND_TO_MEMORY_TYPE[normalized]) return DRAFT_KIND_TO_MEMORY_TYPE[normalized]
  const label = (draftLabel ?? "").toLowerCase()
  if (label.includes("competitor")) return "competitor_mention"
  if (label.includes("budget") || label.includes("price")) return "budget_concern"
  if (label.includes("book") || label.includes("demo")) return "booking_interest"
  if (label.includes("decision")) return "decision_maker"
  return "follow_up_request"
}

export function mapIntelligenceEventTypeToMemoryType(eventType: string): VoiceRelationshipMemoryType | null {
  return EVENT_TYPE_TO_MEMORY_TYPE[eventType] ?? null
}

export function normalizePhoneForMemoryProfile(phone: string | null | undefined): string {
  if (!phone) return ""
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 7) return ""
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`
  return digits.startsWith("+") ? phone.trim() : `+${digits}`
}

export function buildMemoryEvidenceDedupeKey(memoryType: string, evidenceText: string): string {
  return `${memoryType}:${evidenceText.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 120)}`
}
