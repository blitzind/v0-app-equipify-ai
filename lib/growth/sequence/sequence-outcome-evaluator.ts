import type { GrowthSequencePatternOutcome, GrowthSequenceTouch } from "@/lib/growth/sequence-types"
import { daysBetween, detectReplyAfterTouches } from "@/lib/growth/sequence/sequence-pattern-matcher"

const POSITIVE_REPLY_KINDS = new Set(["interested", "positive_interest", "positive_reply"])
const MEETING_SIGNAL_KINDS = new Set([
  "meeting_scheduled",
  "send_proposal",
  "meeting_signal",
  "call_interested",
])

export function evaluateSequenceOutcome(input: {
  patternId: string
  leadId: string
  matchedTouches: GrowthSequenceTouch[]
  allTouches: GrowthSequenceTouch[]
  outcomeWindowDays: number
  opportunityScoreBefore: number | null
  opportunityScoreAfter: number | null
  revenueProbabilityBefore: number | null
  revenueProbabilityAfter: number | null
  conversationHealthBefore: number | null
  conversationHealthAfter: number | null
  leadIndustryBucket: string | null
  dominantObjectionKey: string | null
  buyingIntentAtStart: string | null
  stepCount: number
}): GrowthSequencePatternOutcome {
  const startedAt = input.matchedTouches[0]?.occurredAt ?? new Date().toISOString()
  const completedAt = input.matchedTouches[input.matchedTouches.length - 1]?.occurredAt ?? null
  const replyTouch = detectReplyAfterTouches(input.allTouches, startedAt, input.outcomeWindowDays)

  const gotReply = replyTouch != null
  const gotPositiveReply =
    gotReply &&
    (POSITIVE_REPLY_KINDS.has(replyTouch.signalKind ?? "") ||
      POSITIVE_REPLY_KINDS.has(replyTouch.generationType ?? ""))

  const gotMeetingSignal = input.allTouches.some((touch) => {
    const afterStart = Date.parse(touch.occurredAt) >= Date.parse(startedAt)
    const withinWindow =
      daysBetween(startedAt, touch.occurredAt) <= input.outcomeWindowDays
    return afterStart && withinWindow && MEETING_SIGNAL_KINDS.has(touch.signalKind ?? "")
  })

  const followUpCompleted =
    input.matchedTouches.length >= input.stepCount &&
    input.matchedTouches.some((touch) => touch.channel === "manual_follow_up")

  const abandoned =
    input.matchedTouches.length > 0 &&
    input.matchedTouches.length < input.stepCount &&
    !gotReply

  let timeToReplyHours: number | null = null
  if (replyTouch) {
    timeToReplyHours = ((Date.parse(replyTouch.occurredAt) - Date.parse(startedAt)) / (60 * 60 * 1000))
  }

  let touchesToPositiveSignal: number | null = null
  if (gotPositiveReply) {
    const idx = input.allTouches.findIndex((touch) => touch === replyTouch)
    touchesToPositiveSignal = idx >= 0 ? idx + 1 : 1
  }

  return {
    patternId: input.patternId,
    leadId: input.leadId,
    startedAt,
    completedAt,
    gotReply,
    gotPositiveReply,
    gotMeetingSignal,
    followUpCompleted,
    abandoned,
    timeToReplyHours,
    touchesToPositiveSignal,
    opportunityScoreBefore: input.opportunityScoreBefore,
    opportunityScoreAfter: input.opportunityScoreAfter,
    revenueProbabilityBefore: input.revenueProbabilityBefore,
    revenueProbabilityAfter: input.revenueProbabilityAfter,
    conversationHealthBefore: input.conversationHealthBefore,
    conversationHealthAfter: input.conversationHealthAfter,
    leadIndustryBucket: input.leadIndustryBucket,
    dominantObjectionKey: input.dominantObjectionKey,
    buyingIntentAtStart: input.buyingIntentAtStart,
  }
}
