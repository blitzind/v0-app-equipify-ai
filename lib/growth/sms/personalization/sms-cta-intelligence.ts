/** SMS CTA intelligence (Phase 5.3D). Client-safe. */

import {
  classifyMemoryObjection,
  hasMemoryRelationshipEngagement,
  isExistingCustomerRelationship,
  memoryMeetsOutreachThreshold,
} from "@/lib/growth/outreach/personalization/memory-strategy"
import { isWarmOutreachContext } from "@/lib/growth/outreach/personalization/cta-intelligence"
import { pickVariantIndex } from "@/lib/growth/outreach/personalization/message-variability"
import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"
import type { PersonalizationSignalKey } from "@/lib/growth/outreach/personalization/personalization-types"
import type {
  SmsCtaCategory,
  SmsCtaMetadata,
  SmsMessageType,
} from "@/lib/growth/sms/personalization/sms-personalization-types"

const CTA_TEMPLATES: Record<SmsCtaCategory, string[]> = {
  quick_question: [
    "Worth a quick reply?",
    "Open to a 2-min compare?",
    "Does that match what you're seeing?",
  ],
  yes_no: ["Still the case?", "Is that accurate?", "Still on your radar?"],
  clarification: ["Want me to clarify one point?", "Should I send a short breakdown?"],
  scheduling_prompt: ["What day works for a 15-min fit check?", "Have 10 min this week?"],
  commitment_continuation: ["Still good to follow through on that?", "Need anything from me on this?"],
  soft_reply: ["Happy to share more if useful.", "No pressure — just let me know."],
}

function compact(text: string, max: number): string {
  const trimmed = text.trim().replace(/[.…]+$/, "")
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trim()}…`
}

export function buildSmsCta(input: {
  packet: OutreachContextPacket
  signals: PersonalizationSignalKey[]
  messageType: SmsMessageType
  variationKey: string
}): SmsCtaMetadata & { text: string } {
  const { packet, signals, messageType, variationKey } = input
  const warm = isWarmOutreachContext(packet, signals)
  const objection = classifyMemoryObjection(packet)

  if (packet.memoryCommitmentSummaries[0]?.trim() && memoryMeetsOutreachThreshold(packet)) {
    const topic = compact(packet.memoryCommitmentSummaries[0], 36)
    const templates = CTA_TEMPLATES.commitment_continuation
    const text = templates[pickVariantIndex(`${variationKey}:sms:cta:commit`, templates.length)]!
    return {
      category: "commitment_continuation",
      evidence: topic,
      evidenceSource: "memory_commitment",
      selectionReason: "Active commitment in memory — continue thread.",
      text,
    }
  }

  if (objection && messageType === "sms_reply") {
    const templates = CTA_TEMPLATES.clarification
    const text = templates[pickVariantIndex(`${variationKey}:sms:cta:clarify`, templates.length)]!
    return {
      category: "clarification",
      evidence: packet.objectionSummaries[0] ?? null,
      evidenceSource: "memory_objection",
      selectionReason: "Objection present — clarify, don't push meeting.",
      text,
    }
  }

  if (
    warm &&
    (messageType === "follow_up_sms" || messageType === "sms_reply" || hasMemoryRelationshipEngagement(packet)) &&
    !objection
  ) {
    const templates = CTA_TEMPLATES.scheduling_prompt
    const text = templates[pickVariantIndex(`${variationKey}:sms:cta:sched`, templates.length)]!
    return {
      category: "scheduling_prompt",
      evidence: packet.priorReplySummaries[0] ?? null,
      evidenceSource: "prior_reply",
      selectionReason: "Warm thread — scheduling acceptable on SMS.",
      text,
    }
  }

  if (messageType === "customer_check_in_sms" || isExistingCustomerRelationship(packet)) {
    const templates = CTA_TEMPLATES.soft_reply
    const text = templates[pickVariantIndex(`${variationKey}:sms:cta:soft`, templates.length)]!
    return {
      category: "soft_reply",
      evidence: packet.relationshipSummary,
      evidenceSource: "relationship_stage",
      selectionReason: "Existing customer — low-pressure check-in.",
      text,
    }
  }

  if (packet.priorTouchCount > 0 && !warm) {
    const templates = CTA_TEMPLATES.yes_no
    const text = templates[pickVariantIndex(`${variationKey}:sms:cta:yesno`, templates.length)]!
    return {
      category: "yes_no",
      evidence: null,
      evidenceSource: "sequence_stage",
      selectionReason: "Follow-up touch — binary question.",
      text,
    }
  }

  const templates = CTA_TEMPLATES.quick_question
  const text = templates[pickVariantIndex(`${variationKey}:sms:cta:quick`, templates.length)]!
  return {
    category: "quick_question",
    evidence: packet.researchPainPoints[0] ?? null,
    evidenceSource: packet.researchPainPoints[0] ? "research_pain_point" : "legacy_template",
    selectionReason: "Cold SMS — conversation-first question CTA.",
    text,
  }
}

export function ctaCategoryLabel(category: SmsCtaCategory): string {
  return category.replace(/_/g, " ")
}
