import type { GrowthOutboundReplyClassification, GrowthOutboundReplySentiment } from "@/lib/growth/outbound/types"

export type ReplyClassificationResult = {
  classification: GrowthOutboundReplyClassification
  sentiment: GrowthOutboundReplySentiment
  confidence: number
}

const OOO_PATTERNS = [/out of office/i, /\booo\b/i, /automatic reply/i, /auto.?reply/i, /away from (the )?office/i]

const NOT_INTERESTED_PATTERNS = [
  /not interested/i,
  /no thank/i,
  /please remove/i,
  /stop emailing/i,
  /do not contact/i,
  /unsubscribe/i,
]

const INTERESTED_PATTERNS = [
  /schedule a call/i,
  /let'?s talk/i,
  /interested/i,
  /tell me more/i,
  /book a (call|demo|meeting)/i,
  /call me/i,
  /sounds good/i,
  /yes[, ]/i,
]

const OBJECTION_PATTERNS = [/not now/i, /maybe later/i, /already have/i, /no budget/i, /check back/i]

const REFERRAL_PATTERNS = [/reach out to/i, /contact (my|our)/i, /try .+@/i, /speak with/i]

export function classifyOutboundReply(bodyPreview: string | null | undefined): ReplyClassificationResult {
  const body = bodyPreview?.trim() ?? ""
  if (!body) {
    return { classification: "unclassified", sentiment: "unknown", confidence: 0.2 }
  }

  for (const pattern of OOO_PATTERNS) {
    if (pattern.test(body)) {
      return { classification: "out_of_office", sentiment: "neutral", confidence: 0.85 }
    }
  }

  for (const pattern of NOT_INTERESTED_PATTERNS) {
    if (pattern.test(body)) {
      return { classification: "not_interested", sentiment: "negative", confidence: 0.8 }
    }
  }

  for (const pattern of INTERESTED_PATTERNS) {
    if (pattern.test(body)) {
      return { classification: "interested", sentiment: "positive", confidence: 0.75 }
    }
  }

  for (const pattern of OBJECTION_PATTERNS) {
    if (pattern.test(body)) {
      return { classification: "objection", sentiment: "neutral", confidence: 0.65 }
    }
  }

  for (const pattern of REFERRAL_PATTERNS) {
    if (pattern.test(body)) {
      return { classification: "referral", sentiment: "neutral", confidence: 0.6 }
    }
  }

  return { classification: "unclassified", sentiment: "unknown", confidence: 0.3 }
}
