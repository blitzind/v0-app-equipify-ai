import type { GrowthOutboundReplyClassification, GrowthOutboundReplySentiment } from "@/lib/growth/outbound/types"
import type {
  GrowthReplyBuyingSignal,
  GrowthReplyEscalationSignal,
  GrowthReplyIntent,
  GrowthReplyObjectionSignal,
} from "@/lib/growth/reply-intelligence/reply-intent-types"

export type ReplyIntentClassificationResult = {
  intent: GrowthReplyIntent
  classification: GrowthOutboundReplyClassification
  sentiment: GrowthOutboundReplySentiment
  confidence: number
  buyingSignals: GrowthReplyBuyingSignal[]
  objectionSignals: GrowthReplyObjectionSignal[]
  escalationSignals: GrowthReplyEscalationSignal[]
}

const OOO = [/out of office/i, /\booo\b/i, /automatic reply/i, /auto.?reply/i, /away from (the )?office/i]
const UNSUB = [/unsubscribe/i, /remove me/i, /stop emailing/i, /do not contact/i, /opt out/i]
const NOT_INTERESTED = [/not interested/i, /no thank/i, /please remove/i, /not a fit/i]
const WRONG_CONTACT = [/wrong (person|contact|email)/i, /not the right person/i, /no longer (here|with)/i]
const MEETING = [/schedule a (call|meeting|demo)/i, /book a (call|demo|meeting)/i, /let'?s (meet|talk|chat)/i, /meeting booked/i, /calendar/i]
const PRICING = [/pricing/i, /how much/i, /cost/i, /budget/i, /quote/i, /rate/i]
const TIMING = [/not now/i, /maybe later/i, /check back/i, /next quarter/i, /next month/i, /circle back/i]
const COMPETITOR = [/\bcompetitor\b/i, /already using/i, /already use/i, /we use /i, /compared to/i, /versus/i, /\bvs\b/i]
const REFERRAL = [/reach out to/i, /contact (my|our)/i, /try .+@/i, /speak with/i, /forward(ed)? this to/i]
const SUPPORT = [/support ticket/i, /customer service/i, /help desk/i, /billing issue/i]
const POSITIVE = [/interested/i, /tell me more/i, /sounds good/i, /yes[, ]/i, /would like to learn/i]
const OBJECTION = [/too expensive/i, /no budget/i, /internal resistance/i, /need approval/i, /hard to justify/i]
const STAKEHOLDER = [/my (boss|manager|team|director|vp|ceo)/i, /stakeholder/i, /decision maker/i, /procurement/i]
const IMPLEMENTATION = [/implementation/i, /rollout/i, /deploy/i, /onboarding/i]
const INTEGRATION = [/integrate/i, /integration/i, /api/i, /connect to/i]
const TIMELINE_URGENCY = [/asap/i, /urgent/i, /this quarter/i, /deadline/i, /timeline/i]
const EXECUTIVE = [/\bceo\b/i, /\bcfo\b/i, /\bvp\b/i, /executive/i, /leadership team/i]
const CONTRACT = [/contract/i, /renewal/i, /procurement cycle/i]

function matchAny(body: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(body))
}

function mapIntentToLegacyClassification(intent: GrowthReplyIntent): GrowthOutboundReplyClassification {
  switch (intent) {
    case "positive_interest":
    case "meeting_request":
    case "pricing_question":
      return "interested"
    case "not_interested":
    case "unsubscribe":
    case "wrong_contact":
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

function resolveSentiment(intent: GrowthReplyIntent): GrowthOutboundReplySentiment {
  if (["positive_interest", "meeting_request", "pricing_question", "referral"].includes(intent)) return "positive"
  if (["not_interested", "unsubscribe", "wrong_contact"].includes(intent)) return "negative"
  if (intent === "out_of_office") return "neutral"
  return "unknown"
}

export function classifyReplyIntent(bodyPreview: string | null | undefined): ReplyIntentClassificationResult {
  const body = bodyPreview?.trim() ?? ""
  if (!body) {
    return {
      intent: "unknown",
      classification: "unclassified",
      sentiment: "unknown",
      confidence: 0.2,
      buyingSignals: [],
      objectionSignals: [],
      escalationSignals: [],
    }
  }

  const buyingSignals: GrowthReplyBuyingSignal[] = []
  const objectionSignals: GrowthReplyObjectionSignal[] = []
  const escalationSignals: GrowthReplyEscalationSignal[] = []

  if (matchAny(body, PRICING)) buyingSignals.push("pricing_asked")
  if (matchAny(body, TIMELINE_URGENCY)) buyingSignals.push("timeline_urgency")
  if (matchAny(body, STAKEHOLDER)) buyingSignals.push("stakeholder_mention")
  if (matchAny(body, IMPLEMENTATION)) buyingSignals.push("implementation_question")
  if (matchAny(body, INTEGRATION)) buyingSignals.push("integration_question")

  if (matchAny(body, [/too expensive/i, /no budget/i])) objectionSignals.push("too_expensive")
  if (matchAny(body, [/no time/i, /not now/i, /busy/i])) objectionSignals.push("no_time")
  if (matchAny(body, [/already using/i, /already have/i])) objectionSignals.push("already_have_solution")
  if (matchAny(body, [/internal resistance/i, /need approval/i])) objectionSignals.push("internal_resistance")

  if (matchAny(body, COMPETITOR)) escalationSignals.push("competitor_mentioned")
  if (matchAny(body, STAKEHOLDER)) escalationSignals.push("multiple_stakeholders")
  if (matchAny(body, CONTRACT)) escalationSignals.push("contract_timing")
  if (matchAny(body, EXECUTIVE)) escalationSignals.push("executive_involvement")

  let intent: GrowthReplyIntent = "unknown"
  let confidence = 0.55

  if (matchAny(body, OOO)) {
    intent = "out_of_office"
    confidence = 0.85
  } else if (matchAny(body, UNSUB)) {
    intent = "unsubscribe"
    confidence = 0.9
  } else if (matchAny(body, NOT_INTERESTED)) {
    intent = "not_interested"
    confidence = 0.8
  } else if (matchAny(body, WRONG_CONTACT)) {
    intent = "wrong_contact"
    confidence = 0.75
  } else if (matchAny(body, MEETING)) {
    intent = "meeting_request"
    confidence = 0.85
  } else if (matchAny(body, COMPETITOR)) {
    intent = "competitor_mention"
    confidence = 0.8
  } else if (matchAny(body, PRICING)) {
    intent = "pricing_question"
    confidence = 0.75
  } else if (matchAny(body, SUPPORT)) {
    intent = "support_request"
    confidence = 0.7
  } else if (matchAny(body, REFERRAL)) {
    intent = "referral"
    confidence = 0.65
  } else if (matchAny(body, TIMING)) {
    intent = "timing_delay"
    confidence = 0.65
  } else if (matchAny(body, OBJECTION)) {
    intent = "objection"
    confidence = 0.7
  } else if (matchAny(body, POSITIVE)) {
    intent = "positive_interest"
    confidence = 0.75
  }

  return {
    intent,
    classification: mapIntentToLegacyClassification(intent),
    sentiment: resolveSentiment(intent),
    confidence,
    buyingSignals,
    objectionSignals,
    escalationSignals,
  }
}
