import type { GrowthOutboundReplyClassification, GrowthOutboundReplySentiment } from "@/lib/growth/outbound/types"
import { classifyReplyIntent } from "@/lib/growth/reply-intelligence/reply-intent-classifier"

export type ReplyClassificationResult = {
  classification: GrowthOutboundReplyClassification
  sentiment: GrowthOutboundReplySentiment
  confidence: number
}

/** Legacy classifier — delegates to slice 6.22A intent classifier and maps to legacy buckets. */
export function classifyOutboundReply(bodyPreview: string | null | undefined): ReplyClassificationResult {
  const result = classifyReplyIntent(bodyPreview)
  return {
    classification: result.classification,
    sentiment: result.sentiment,
    confidence: result.confidence,
  }
}
