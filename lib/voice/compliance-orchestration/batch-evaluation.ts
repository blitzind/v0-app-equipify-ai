/** Batched compliance evaluation — Phase 4C performance safeguards. */

import { evaluateCommunicationCompliance } from "@/lib/voice/compliance-orchestration/compliance-decision-engine"
import type {
  CommunicationComplianceEvaluationContext,
  CommunicationComplianceEvaluationInput,
  CommunicationComplianceResult,
} from "@/lib/voice/compliance-orchestration/types"
import { VOICE_COMPLIANCE_BATCH_PREVIEW_LIMIT } from "@/lib/voice/compliance-orchestration/types"

export type BatchComplianceInput = {
  organizationId: string
  channel: CommunicationComplianceEvaluationInput["channel"]
  campaignType?: string | null
  recipients: Array<{
    phoneNumber: string
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    relationshipMemoryProfileId?: string | null
  }>
  loadContext: (phoneNumber: string) => Promise<CommunicationComplianceEvaluationContext>
}

export type BatchComplianceResult = {
  results: Array<{ phoneNumber: string; result: CommunicationComplianceResult }>
  dedupedCount: number
  evaluatedCount: number
  allowedCount: number
  blockedCount: number
  manualReviewCount: number
}

export async function evaluateCommunicationComplianceBatch(
  input: BatchComplianceInput,
  limit: number = VOICE_COMPLIANCE_BATCH_PREVIEW_LIMIT,
): Promise<BatchComplianceResult> {
  const seen = new Set<string>()
  const results: BatchComplianceResult["results"] = []
  let allowedCount = 0
  let blockedCount = 0
  let manualReviewCount = 0

  const contextCache = new Map<string, CommunicationComplianceEvaluationContext>()

  for (const recipient of input.recipients.slice(0, limit)) {
    const key = recipient.phoneNumber.trim()
    if (seen.has(key)) continue
    seen.add(key)

    let context = contextCache.get(key)
    if (!context) {
      context = await input.loadContext(key)
      contextCache.set(key, context)
    }

    const result = evaluateCommunicationCompliance(
      {
        organizationId: input.organizationId,
        phoneNumber: key,
        channel: input.channel,
        campaignType: input.campaignType,
        relatedCustomerId: recipient.relatedCustomerId,
        relatedProspectId: recipient.relatedProspectId,
        relationshipMemoryProfileId: recipient.relationshipMemoryProfileId,
      },
      context,
    )

    results.push({ phoneNumber: key, result })
    if (result.allowed) allowedCount += 1
    else if (result.blocked) blockedCount += 1
    else manualReviewCount += 1
  }

  return {
    results,
    dedupedCount: input.recipients.length - seen.size,
    evaluatedCount: seen.size,
    allowedCount,
    blockedCount,
    manualReviewCount,
  }
}
