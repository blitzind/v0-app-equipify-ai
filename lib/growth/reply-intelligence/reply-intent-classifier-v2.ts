import type {
  GrowthReplyConfidenceTier,
  GrowthReplyIntent,
  GrowthReplyMatchedPhrase,
  GrowthReplyUncertaintyState,
} from "@/lib/growth/reply-intelligence/reply-intent-types"
import {
  classifyReplyIntent,
  type ReplyIntentClassificationResult,
} from "@/lib/growth/reply-intelligence/reply-intent-classifier"

export type ReplyIntentClassificationV2Result = ReplyIntentClassificationResult & {
  classificationReason: string
  matchedPhrases: GrowthReplyMatchedPhrase[]
  confidenceTier: GrowthReplyConfidenceTier
  uncertaintyState: GrowthReplyUncertaintyState
  recommendedOperatorAction: string
  aiAssisted: false
}

type PatternRule = {
  category: string
  patterns: RegExp[]
  intent?: GrowthReplyIntent
  reason: string
  recommendedOperatorAction: string
  confidenceBoost?: number
}

const V2_RULES: PatternRule[] = [
  {
    category: "unsubscribe",
    patterns: [/unsubscribe/i, /remove me/i, /stop emailing/i, /do not contact/i, /opt out/i],
    intent: "unsubscribe",
    reason: "Explicit unsubscribe or stop language detected.",
    recommendedOperatorAction: "Suppress future outreach and confirm compliance review.",
    confidenceBoost: 0.9,
  },
  {
    category: "angry_complaint",
    patterns: [/this is (spam|harassment)/i, /report you/i, /lawyer/i, /furious/i, /unacceptable/i, /stop contacting/i],
    intent: "angry_complaint",
    reason: "Angry or complaint language detected.",
    recommendedOperatorAction: "Route to immediate human review — do not auto-respond.",
    confidenceBoost: 0.85,
  },
  {
    category: "demo_request",
    patterns: [/demo/i, /product tour/i, /see (it|the product) in action/i, /walkthrough/i],
    intent: "demo_request",
    reason: "Demo or product tour request detected.",
    recommendedOperatorAction: "Route to demo scheduling workflow for human review.",
    confidenceBoost: 0.8,
  },
  {
    category: "needs_more_information",
    patterns: [/more information/i, /can you (send|share) (details|info)/i, /what does (your|the) (product|platform)/i, /how does it work/i],
    intent: "needs_more_information",
    reason: "Prospect requested additional information.",
    recommendedOperatorAction: "Draft informational reply for human approval.",
    confidenceBoost: 0.7,
  },
  {
    category: "neutral_acknowledgement",
    patterns: [/thanks?(,|\s|$)/i, /received/i, /noted/i, /got it/i, /will review/i],
    intent: "neutral_acknowledgement",
    reason: "Neutral acknowledgement without clear buying or stop signal.",
    recommendedOperatorAction: "Monitor thread — avoid aggressive follow-up.",
    confidenceBoost: 0.55,
  },
  {
    category: "authority_objection",
    patterns: [/need approval/i, /not my decision/i, /talk to my (boss|manager|director|vp)/i, /decision maker/i],
    intent: "objection",
    reason: "Authority or approval objection detected.",
    recommendedOperatorAction: "Identify decision-maker and route for human review.",
    confidenceBoost: 0.7,
  },
  {
    category: "budget_objection",
    patterns: [/no budget/i, /too expensive/i, /can't afford/i, /price is too high/i],
    intent: "objection",
    reason: "Budget or price objection detected.",
    recommendedOperatorAction: "Prepare pricing/value response draft for human approval.",
    confidenceBoost: 0.75,
  },
  {
    category: "timing_objection",
    patterns: [/not now/i, /maybe later/i, /next quarter/i, /check back/i, /bad timing/i],
    intent: "timing_delay",
    reason: "Timing objection or deferral detected.",
    recommendedOperatorAction: "Schedule follow-up task — do not push sequence blindly.",
    confidenceBoost: 0.65,
  },
]

function extractMatchedPhrases(body: string, rule: PatternRule): GrowthReplyMatchedPhrase[] {
  const matches: GrowthReplyMatchedPhrase[] = []
  for (const pattern of rule.patterns) {
    const match = body.match(pattern)
    if (!match) continue
    const index = match.index ?? 0
    const start = Math.max(0, index - 20)
    const end = Math.min(body.length, index + match[0].length + 40)
    matches.push({
      phrase: match[0],
      excerpt: body.slice(start, end).trim(),
      category: rule.category,
    })
  }
  return matches
}

function resolveConfidenceTier(confidence: number): GrowthReplyConfidenceTier {
  if (confidence >= 0.8) return "high"
  if (confidence >= 0.6) return "medium"
  if (confidence >= 0.4) return "low"
  return "uncertain"
}

function resolveUncertaintyState(input: {
  confidence: number
  matchedPhrases: GrowthReplyMatchedPhrase[]
  intent: GrowthReplyIntent
}): GrowthReplyUncertaintyState {
  if (!input.matchedPhrases.length && input.intent === "unknown") return "insufficient_evidence"
  if (input.confidence >= 0.8 && input.matchedPhrases.length > 0) return "confident"
  if (input.matchedPhrases.length > 0 && input.confidence >= 0.55) return "partial"
  return "ambiguous"
}

function mapV2IntentToLegacyClassification(intent: GrowthReplyIntent): ReplyIntentClassificationResult["classification"] {
  switch (intent) {
    case "positive_interest":
    case "meeting_request":
    case "demo_request":
    case "pricing_question":
      return "interested"
    case "not_interested":
    case "unsubscribe":
    case "wrong_contact":
    case "angry_complaint":
      return "not_interested"
    case "objection":
    case "timing_delay":
    case "competitor_mention":
      return "objection"
    case "out_of_office":
      return "out_of_office"
    case "referral":
      return "referral"
    default:
      return "unclassified"
  }
}

function resolveRecommendedAction(intent: GrowthReplyIntent): string {
  switch (intent) {
    case "meeting_request":
    case "demo_request":
      return "Route to demo/meeting scheduling — human confirms calendar."
    case "pricing_question":
      return "Route to pricing response draft — human approval required."
    case "positive_interest":
      return "Mark interested and create follow-up task — human executes."
    case "unsubscribe":
    case "not_interested":
      return "Stop sequence and suppress outreach per compliance rules."
    case "wrong_contact":
      return "Route to wrong-person/referral workflow — no blind continuation."
    case "referral":
      return "Flag referral contact — do not auto-enroll referred party."
    case "angry_complaint":
      return "Urgent manual review — suppress automated follow-ups."
    case "out_of_office":
      return "Do not count as positive engagement — pause aggressive follow-up."
    case "competitor_mention":
      return "Update opportunity context — human handles competitive response."
    case "objection":
    case "timing_delay":
      return "Create objection follow-up task with draft assist — human sends."
    case "needs_more_information":
      return "Draft informational reply for human approval."
    case "neutral_acknowledgement":
      return "Monitor only — avoid treating as strong buying signal."
    default:
      return "Flag for manual review when confidence is low."
  }
}

export function classifyReplyIntentV2(bodyPreview: string | null | undefined): ReplyIntentClassificationV2Result {
  const body = bodyPreview?.trim() ?? ""
  const base = classifyReplyIntent(bodyPreview)
  const matchedPhrases: GrowthReplyMatchedPhrase[] = []

  let intent = base.intent
  let confidence = base.confidence
  let classificationReason = base.intent === "unknown" ? "No strong deterministic signals matched." : `Matched legacy intent: ${base.intent}.`
  let recommendedOperatorAction = resolveRecommendedAction(base.intent)

  for (const rule of V2_RULES) {
    const ruleMatches = extractMatchedPhrases(body, rule)
    if (ruleMatches.length === 0) continue
    matchedPhrases.push(...ruleMatches)
    if (rule.intent && (intent === "unknown" || (rule.confidenceBoost ?? 0) >= confidence)) {
      intent = rule.intent
      confidence = Math.max(confidence, rule.confidenceBoost ?? confidence)
      classificationReason = rule.reason
      recommendedOperatorAction = rule.recommendedOperatorAction
    }
  }

  if (intent === "meeting_request" && matchedPhrases.some((m) => m.category === "demo_request")) {
    intent = "demo_request"
    classificationReason = "Demo-specific language takes precedence over generic meeting request."
    recommendedOperatorAction = "Route to demo scheduling workflow for human review."
  }

  const confidenceTier = resolveConfidenceTier(confidence)
  const uncertaintyState = resolveUncertaintyState({ confidence, matchedPhrases, intent })

  return {
    ...base,
    intent,
    classification: mapV2IntentToLegacyClassification(intent),
    sentiment: base.sentiment,
    confidence,
    classificationReason,
    matchedPhrases,
    confidenceTier,
    uncertaintyState,
    recommendedOperatorAction,
    aiAssisted: false,
  }
}
