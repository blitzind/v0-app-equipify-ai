import type { GrowthOutboundReply } from "@/lib/growth/outbound/types"

export type ReplyThreadIntelligence = {
  threadReplyCount: number
  firstReplyAt: string | null
  lastReplyAt: string
  responseLatencyMs: number | null
  unanswered: boolean
  ownerWaiting: boolean
}

export function computeReplyThreadIntelligence(input: {
  currentReplyReceivedAt: string
  priorReplies: GrowthOutboundReply[]
  lastOutboundSentAt?: string | null
}): ReplyThreadIntelligence {
  const prior = [...input.priorReplies].sort(
    (left, right) => new Date(left.receivedAt).getTime() - new Date(right.receivedAt).getTime(),
  )
  const threadReplyCount = prior.length + 1
  const firstReplyAt = prior[0]?.receivedAt ?? input.currentReplyReceivedAt
  const lastReplyAt = input.currentReplyReceivedAt

  let responseLatencyMs: number | null = null
  if (input.lastOutboundSentAt) {
    responseLatencyMs = Math.max(
      0,
      new Date(input.currentReplyReceivedAt).getTime() - new Date(input.lastOutboundSentAt).getTime(),
    )
  }

  const unanswered = threadReplyCount === 1
  const ownerWaiting = !["out_of_office", "not_interested", "unsubscribe", "wrong_contact"].includes(
    prior[prior.length - 1]?.classification ?? "",
  )

  return {
    threadReplyCount,
    firstReplyAt,
    lastReplyAt,
    responseLatencyMs,
    unanswered,
    ownerWaiting,
  }
}
