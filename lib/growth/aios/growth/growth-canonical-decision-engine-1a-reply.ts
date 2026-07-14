/**
 * GE-AIOS-DECISION-ENGINE-1A — Reply finalization refresh (client-safe helpers).
 */

import { buildCanonicalDecisionFromReplyState } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-adapters"
import type { GrowthOutreachRelationshipAssessment } from "@/lib/growth/aios/growth/growth-relationship-strategy-2a-types"
import type { GrowthCanonicalNextBestDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"

const NON_MATERIAL_INTENTS = new Set([
  "out_of_office",
  "neutral_acknowledgement",
  "unknown",
])

export function isReplyMaterialForCanonicalDecision(intent: string): boolean {
  return !NON_MATERIAL_INTENTS.has(intent)
}

export function refreshCanonicalDecisionAfterReply(input: {
  organizationId: string
  leadId: string
  generatedAt: string
  intent: string
  classificationLabel: string
  receivedAt: string
  relationshipAssessment?: GrowthOutreachRelationshipAssessment | null
  sequenceEnrolled?: boolean
}): GrowthCanonicalNextBestDecision | null {
  const isMaterial = isReplyMaterialForCanonicalDecision(input.intent)
  return buildCanonicalDecisionFromReplyState({
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt: input.generatedAt,
    relationshipAssessment: input.relationshipAssessment ?? null,
    replyState: {
      classification: input.classificationLabel,
      intent: input.intent,
      isMaterial,
      isOutOfOffice: input.intent === "out_of_office",
      isUnknown: input.intent === "unknown",
      receivedAt: input.receivedAt,
    },
    sequenceState: input.sequenceEnrolled
      ? { enrolled: true, nextScheduledAt: null, nextStepLabel: null }
      : null,
  })
}
