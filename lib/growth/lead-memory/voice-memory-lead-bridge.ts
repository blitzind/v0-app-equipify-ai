/** GE-AIOS-MEMORY-RESOLVER-1A — Voice relationship memory → canonical lead memory bridge (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { writeCanonicalLeadMemoryAndRebuild } from "@/lib/growth/lead-memory/canonical-human-memory-write"
import type { HumanMemoryKind } from "@/lib/growth/lead-memory/canonical-human-memory-metadata"
import { VOICE_BRIDGE_SOURCE_SYSTEM } from "@/lib/growth/lead-memory/canonical-human-memory-metadata"
import { resolveAuthoritativeForm } from "@/lib/growth/aios/growth/growth-canonical-display-identity-1b"
import type { VoiceRelationshipMemoryType } from "@/lib/voice/relationship-memory/types"

function mapVoiceMemoryTypeToHumanKind(memoryType: VoiceRelationshipMemoryType, label: string): HumanMemoryKind {
  const normalizedLabel = label.toLowerCase()
  if (memoryType === "preferred_channel" || memoryType === "callback_preference" || memoryType === "scheduling_preference") {
    return "communication_style"
  }
  if (memoryType === "follow_up_request" || memoryType === "booking_interest") {
    return "action_commitment"
  }
  if (memoryType === "competitor_mention" || memoryType === "budget_concern") {
    return "business_fact"
  }
  if (/personal|family|surgery|empathy/i.test(normalizedLabel)) {
    return "personal_context"
  }
  if (
    memoryType === "pricing_objection" ||
    memoryType === "negative_sentiment" ||
    memoryType === "urgency_signal" ||
    memoryType === "cancellation_risk"
  ) {
    return "sales_conclusion"
  }
  return "sales_conclusion"
}

function conclusionFromVoiceDraft(input: {
  draftLabel: string
  evidenceText: string
  memoryType: VoiceRelationshipMemoryType
}): string {
  const label = input.draftLabel.trim()
  if (label.length >= 8 && !/transcript|segment|speaker/i.test(label)) {
    return label
  }

  const evidence = input.evidenceText.trim()
  if (evidence.length >= 8) {
    const firstSentence = evidence.split(/[.!?]/)[0]?.trim() ?? evidence
    if (firstSentence.length >= 8 && firstSentence.length <= 160) return firstSentence
  }

  switch (input.memoryType) {
    case "pricing_objection":
      return "Budget or pricing concern raised on call"
    case "competitor_mention":
      return "Competitor or incumbent vendor mentioned on call"
    case "callback_preference":
      return "Callback timing preference noted on call"
    case "preferred_channel":
      return "Preferred communication channel noted on call"
    case "follow_up_request":
      return "Follow-up commitment requested on call"
    case "booking_interest":
      return "Meeting or demo interest expressed on call"
    default:
      return label || "Relationship conclusion from approved call memory"
  }
}

export async function bridgeApprovedVoiceMemoryToLeadMemory(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    draftLabel: string
    evidenceText: string
    memoryType: VoiceRelationshipMemoryType
    confidenceScore: number
    voiceMemoryEventId?: string | null
    companyName?: string | null
  },
): Promise<{ leadMemoryEventId: string | null; deduped: boolean }> {
  const humanMemoryKind = mapVoiceMemoryTypeToHumanKind(input.memoryType, input.draftLabel)
  const conclusion = conclusionFromVoiceDraft({
    draftLabel: input.draftLabel,
    evidenceText: input.evidenceText,
    memoryType: input.memoryType,
  })

  const confidence =
    input.confidenceScore >= 0.85 ? "high" : input.confidenceScore >= 0.7 ? "medium" : ("low" as const)

  const result = await writeCanonicalLeadMemoryAndRebuild(admin, {
    leadId: input.leadId,
    humanMemoryKind,
    conclusion,
    confidence,
    sourceSystem: VOICE_BRIDGE_SOURCE_SYSTEM,
    operatorStatus: "approved",
    canonicalEntityLabel: input.companyName ? resolveAuthoritativeForm(input.companyName) : null,
    whyItMatters: "Approved call memory bridged into canonical lead memory.",
    voiceMemoryEventId: input.voiceMemoryEventId ?? null,
  })

  return { leadMemoryEventId: result.eventId, deduped: result.deduped }
}
