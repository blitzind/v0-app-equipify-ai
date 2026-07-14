import type { GrowthReplyBuyingSignalEvidence } from "@/lib/growth/reply-intelligence/reply-intent-types"

type SignalRule = {
  signal: string
  patterns: RegExp[]
  confidence: number
}

const SIGNAL_RULES: SignalRule[] = [
  { signal: "demo_interest", patterns: [/demo/i, /product tour/i, /walkthrough/i], confidence: 0.8 },
  { signal: "pricing_interest", patterns: [/pricing/i, /how much/i, /cost/i, /quote/i, /rate/i], confidence: 0.75 },
  {
    signal: "pain_point_mentioned",
    patterns: [
      /struggling with/i,
      /problem with/i,
      /pain point/i,
      /challenge with/i,
      /challenges? coordinating/i,
      /frustrated/i,
    ],
    confidence: 0.7,
  },
  { signal: "current_vendor_mentioned", patterns: [/currently use/i, /already use/i, /we use /i, /our vendor/i], confidence: 0.75 },
  { signal: "replacement_intent", patterns: [/looking to replace/i, /switch(ing)? from/i, /migrate away/i, /move off/i], confidence: 0.8 },
  { signal: "timeline_mentioned", patterns: [/this quarter/i, /next month/i, /deadline/i, /asap/i, /timeline/i], confidence: 0.7 },
  {
    signal: "decision_maker_clue",
    patterns: [
      /my (boss|manager|director|vp|ceo)/i,
      /(?:our|the) service director/i,
      /decision maker/i,
      /procurement/i,
    ],
    confidence: 0.65,
  },
  {
    signal: "internal_referral",
    patterns: [
      /reach out to/i,
      /contact (my|our)/i,
      /speak with/i,
      /forward(ed)? this to/i,
      /would probably be better/i,
    ],
    confidence: 0.6,
  },
  { signal: "case_study_request", patterns: [/case study/i, /customer story/i, /who else uses/i, /reference customer/i], confidence: 0.75 },
  { signal: "feature_details_request", patterns: [/feature/i, /capability/i, /does it support/i, /can it do/i, /integration/i], confidence: 0.65 },
  { signal: "objection_raised", patterns: [/too expensive/i, /no budget/i, /not now/i, /already have/i, /not a fit/i], confidence: 0.7 },
]

function excerptAroundMatch(body: string, match: RegExpMatchArray): string {
  const index = match.index ?? 0
  const start = Math.max(0, index - 25)
  const end = Math.min(body.length, index + match[0].length + 35)
  return body.slice(start, end).trim()
}

export function extractBuyingSignals(bodyPreview: string | null | undefined): GrowthReplyBuyingSignalEvidence[] {
  const body = bodyPreview?.trim() ?? ""
  if (!body) return []

  const signals: GrowthReplyBuyingSignalEvidence[] = []
  const seen = new Set<string>()

  for (const rule of SIGNAL_RULES) {
    for (const pattern of rule.patterns) {
      const match = body.match(pattern)
      if (!match || seen.has(rule.signal)) continue
      seen.add(rule.signal)
      signals.push({
        signal: rule.signal,
        excerpt: excerptAroundMatch(body, match),
        confidence: rule.confidence,
      })
      break
    }
  }

  return signals
}
