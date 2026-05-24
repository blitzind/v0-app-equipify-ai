import type { GrowthRealtimeTranscriptEvent, GrowthRealtimeTalkRatio } from "@/lib/growth/realtime/realtime-call-types"

const REP_GOAL_MIN = 45
const REP_GOAL_MAX = 60

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function computeRealtimeTalkRatio(
  events: Pick<GrowthRealtimeTranscriptEvent, "speaker" | "content">[],
): GrowthRealtimeTalkRatio {
  let repWordCount = 0
  let prospectWordCount = 0
  let repQuestions = 0

  for (const event of events) {
    const words = wordCount(event.content)
    if (event.speaker === "rep") {
      repWordCount += words
      if (event.content.includes("?")) repQuestions += 1
    } else if (event.speaker === "prospect") {
      prospectWordCount += words
    }
  }

  const total = repWordCount + prospectWordCount
  const repTalkPercent = total > 0 ? Math.round((repWordCount / total) * 100) : 0
  const prospectTalkPercent = total > 0 ? 100 - repTalkPercent : 0
  const inGoalRange = repTalkPercent >= REP_GOAL_MIN && repTalkPercent <= REP_GOAL_MAX

  const flags: GrowthRealtimeTalkRatio["flags"] = []
  if (total >= 20 && repTalkPercent > REP_GOAL_MAX + 10) flags.push("talking_too_much")
  if (total >= 20 && repQuestions === 0) flags.push("not_enough_questions")

  return {
    repTalkPercent,
    prospectTalkPercent,
    repWordCount,
    prospectWordCount,
    inGoalRange,
    flags,
  }
}
