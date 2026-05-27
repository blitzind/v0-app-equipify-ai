/** Deterministic reply signal extraction. Client-safe. No AI. */

export type ReplySignalFlags = {
  contains_budget: boolean
  contains_pricing: boolean
  contains_timeline: boolean
  contains_meeting_language: boolean
  contains_competitor: boolean
  contains_unsubscribe: boolean
  contains_positive_signal: boolean
  contains_question: boolean
  contains_referral: boolean
}

function normalizeText(text: string): string {
  return text.toLowerCase()
}

export function extractReplySignals(input: { subject?: string; body?: string }): ReplySignalFlags {
  const combined = normalizeText(`${input.subject ?? ""} ${input.body ?? ""}`)

  const contains_budget = /\bbudget\b|\bpricing\b|\bcost\b|\bprice\b/.test(combined)
  const contains_pricing = /\bpricing\b|\bcost\b|\bprice\b/.test(combined)
  const contains_timeline = /\btimeline\b|\bnext quarter\b|\bfuture\b|\blater\b|\bnot ready\b/.test(combined)
  const contains_meeting_language = /\bbook\b|\bcalendar\b|\bmeeting\b|\bcall\b|\bschedule\b/.test(combined)
  const contains_competitor = /\balready use\b|\bvendor\b|\bcurrent provider\b|\bcompetitor\b/.test(combined)
  const contains_unsubscribe = /\bnot interested\b|\bremove me\b|\bstop\b|\bunsubscribe\b/.test(combined)
  const contains_positive_signal = /\bsounds good\b|\binterested\b|\btell me more\b|\blove to\b/.test(combined)
  const contains_question = /\?|\bhow\b|\bwhat\b|\bwhen\b|\bwhy\b/.test(combined)
  const contains_referral = /\brefer\b|\bintroduce\b|\bcolleague\b|\bpass along\b/.test(combined)

  return {
    contains_budget,
    contains_pricing,
    contains_timeline,
    contains_meeting_language,
    contains_competitor,
    contains_unsubscribe,
    contains_positive_signal,
    contains_question,
    contains_referral,
  }
}
