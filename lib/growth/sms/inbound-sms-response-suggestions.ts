/** Phase 5.6B-D — Inbound SMS response suggestion builder. Client-safe. */

import type { GrowthInboxClassification } from "@/lib/growth/inbox/inbox-types"
import {
  GROWTH_NEXT_BEST_ACTION_LABELS,
  type GrowthNextBestAction,
} from "@/lib/growth/nba-types"
import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"
import { extractBuyingSignals } from "@/lib/growth/reply-intelligence/buying-signal-extractor"
import { classifyReplyIntentV2 } from "@/lib/growth/reply-intelligence/reply-intent-classifier-v2"
import type { ReplyCopilotRelationshipMemory } from "@/lib/growth/reply-intelligence/reply-copilot-memory"
import type { GrowthReplyIntent } from "@/lib/growth/reply-intelligence/reply-intent-types"
import { buildPersonalizedSmsDraft } from "@/lib/growth/sms/personalization/assemble-sms-draft"
import {
  summarizeSmsContextUsed,
  summarizeSmsMemoryUsed,
} from "@/lib/growth/sms/personalization/sms-audit-summaries"
import { GROWTH_SMS_PERSONALIZATION_QA_MARKER } from "@/lib/growth/sms/personalization/sms-personalization-audit"
import { projectSmsPersonalizationContext } from "@/lib/growth/sms/personalization/sms-context-projection"
import { estimateSmsSegments } from "@/lib/growth/sms/personalization/sms-quality-scoring"
import { SMS_PERSONALIZATION_DEFAULT_MAX_CHARS } from "@/lib/growth/sms/personalization/sms-personalization-types"
import type { GrowthSmsInboxDraftSuggestion } from "@/lib/growth/sms/personalization/sms-personalization-types"
import {
  GROWTH_SMS_INBOUND_RESPONSE_SUGGESTIONS_QA_MARKER,
  type GrowthInboundSmsResponseSuggestions,
  type GrowthSmsCallPromptSuggestion,
  type GrowthSmsEmailFollowUpKind,
  type GrowthSmsEmailFollowUpSuggestion,
} from "@/lib/growth/sms/inbound-sms-response-suggestion-types"
import {
  auditSmsSuggestionSafety,
  sanitizeSmsSuggestionBody,
  shouldSuppressSmsReplySuggestion,
} from "@/lib/growth/sms/sms-suggestion-safety"

const CALL_NBA: GrowthNextBestAction[] = [
  "call_immediately",
  "call_now",
  "call_after_email_reply",
  "call_primary_contact",
  "call_decision_maker",
  "immediate_sales_action",
]

function compact(text: string, max: number): string {
  const trimmed = text.trim().replace(/[.…]+$/, "")
  if (trimmed.length <= max) return trimmed
  const cut = trimmed.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > 12 ? cut.slice(0, space) : cut).trim()}…`
}

function firstName(contactName: string | null | undefined, companyName: string): string | null {
  if (contactName?.trim()) return contactName.trim().split(/\s+/)[0] ?? null
  return null
}

function pickVerifiedFactSnippet(packet: OutreachContextPacket): string | null {
  if (!packet.hasWebsiteResearch) return null
  if (packet.researchPainPoints[0]?.trim()) return compact(packet.researchPainPoints[0], 72)
  if (packet.websiteFindings[0]?.trim()) return compact(packet.websiteFindings[0], 72)
  if (packet.companySummary?.trim()) return compact(packet.companySummary, 72)
  return null
}

function resolveEngagementSignal(intent: GrowthReplyIntent, threadClassification: GrowthInboxClassification | null): string {
  if (threadClassification === "positive_interest" || threadClassification === "meeting_intent") {
    return "positive engagement"
  }
  if (intent === "positive_interest" || intent === "meeting_request" || intent === "demo_request") {
    return "positive engagement"
  }
  if (intent === "needs_more_information" || intent === "pricing_question") {
    return "information seeking"
  }
  if (intent === "objection" || intent === "timing_delay") {
    return "objection or deferral"
  }
  if (intent === "not_interested" || intent === "unsubscribe") {
    return "disengagement signal"
  }
  if (intent === "neutral_acknowledgement") {
    return "neutral acknowledgement"
  }
  return "unclear engagement"
}

function buildIntentAwareSmsBody(input: {
  inboundBody: string
  intent: GrowthReplyIntent
  contactFirstName: string | null
  companyName: string
  verifiedFact: string | null
  relationshipMemory?: ReplyCopilotRelationshipMemory
  priorSmsPreviews: string[]
}): string {
  const { intent, contactFirstName, companyName, verifiedFact, relationshipMemory } = input
  const namePrefix = contactFirstName ? `${contactFirstName}, ` : ""
  const factClause = verifiedFact ? `${verifiedFact}. ` : ""

  switch (intent) {
    case "positive_interest":
    case "needs_more_information":
      if (factClause) {
        return `${namePrefix}happy to share more — ${factClause.trim()} Want a quick overview by text or email?`
      }
      return `${namePrefix}happy to share more — want a quick text overview or should I email a short summary?`
    case "meeting_request":
    case "demo_request":
      return `${namePrefix}great — I can send a few time options. Any days work best this week?`
    case "pricing_question":
      return `${namePrefix}I'll pull together pricing context for ${companyName}. Text or email better for you?`
    case "timing_delay":
      return `${namePrefix}understood — I'll follow up when timing is better. Anything I should keep in mind?`
    case "objection": {
      const objection = relationshipMemory?.topObjections[0]
      if (objection?.trim()) {
        return `${namePrefix}got it on ${compact(objection.split(":")[0] ?? objection, 40)} — want me to clarify one point by text?`
      }
      return `${namePrefix}appreciate the note — want me to clarify one point without rehashing prior details?`
    }
    case "neutral_acknowledgement":
      return `${namePrefix}thanks for confirming — I'll keep this brief. Need anything else from me?`
    case "not_interested":
      return `${namePrefix}understood — I'll close the loop on my side. Reply STOP anytime to opt out.`
    case "unsubscribe":
      return `Understood — you won't receive further messages. Reply STOP to confirm opt-out.`
    case "referral":
      return `${namePrefix}thanks for the referral — should I reach out directly or wait for an intro?`
    case "wrong_contact":
      return `${namePrefix}thanks for letting me know — who handles ops workflow decisions at ${companyName}?`
    default:
      return `${namePrefix}thanks for your text — happy to share more if useful. What's the best next step for you?`
  }
}

function buildEmailFollowUpSuggestion(input: {
  intent: GrowthReplyIntent
  companyName: string
  contactFirstName: string | null
  nextBestAction: GrowthNextBestAction | null
  hasPriorEmail: boolean
}): GrowthSmsEmailFollowUpSuggestion | null {
  const { intent, companyName, contactFirstName, nextBestAction, hasPriorEmail } = input

  if (intent === "unsubscribe" || intent === "not_interested" || intent === "angry_complaint") {
    return null
  }

  let kind: GrowthSmsEmailFollowUpKind | null = null
  if (intent === "meeting_request" || intent === "demo_request") {
    kind = "send_scheduling_link"
  } else if (intent === "pricing_question") {
    kind = "send_proposal_context"
  } else if (intent === "positive_interest" || intent === "needs_more_information") {
    kind = "send_short_overview"
  } else if (nextBestAction === "call_immediately" || nextBestAction === "call_now") {
    kind = "send_scheduling_link"
  } else if (intent === "objection" && hasPriorEmail) {
    kind = "send_details_by_email"
  }

  if (!kind) return null

  const labels: Record<GrowthSmsEmailFollowUpKind, { label: string; summary: string; subject: string }> = {
    send_details_by_email: {
      label: "Send details by email",
      summary: "Follow up with a concise email that answers their question — operator sends manually.",
      subject: `Re: ${companyName} — details you asked for`,
    },
    send_short_overview: {
      label: "Send short overview",
      summary: "Email a brief overview with verified research points — no auto-send.",
      subject: `Quick overview for ${companyName}`,
    },
    send_scheduling_link: {
      label: "Send scheduling link",
      summary: "Email a scheduling link or propose 2–3 times — human approval required.",
      subject: `Scheduling — ${companyName}`,
    },
    send_proposal_context: {
      label: "Send proposal/context",
      summary: "Email pricing or scope context appropriate to their question — verify facts first.",
      subject: `Context for ${companyName}`,
    },
  }

  const entry = labels[kind]
  const greeting = contactFirstName ? contactFirstName : companyName
  return {
    kind,
    label: entry.label,
    summary: entry.summary.replace("operator sends", `${greeting}: operator sends`),
    suggestedSubject: entry.subject,
    humanApprovalRequired: true,
  }
}

function buildCallPromptSuggestion(input: {
  intent: GrowthReplyIntent
  inboundBody: string
  contactFirstName: string | null
  companyName: string
  nextBestAction: GrowthNextBestAction | null
  nextBestActionReason: string | null
  verifiedFact: string | null
  buyingSignals: string[]
}): GrowthSmsCallPromptSuggestion | null {
  const { intent, inboundBody, contactFirstName, companyName, nextBestAction, nextBestActionReason, verifiedFact, buyingSignals } =
    input

  if (!nextBestAction || !CALL_NBA.includes(nextBestAction)) return null
  if (intent === "unsubscribe" || intent === "not_interested" || intent === "angry_complaint") return null

  const name = contactFirstName ?? "there"
  const excerpt = compact(inboundBody, 80)
  const whyCallNow =
    nextBestActionReason?.trim() ||
    (intent === "positive_interest" || intent === "needs_more_information"
      ? `Prospect asked for more info via SMS ("${excerpt}") — high-intent window.`
      : `Next best action is ${GROWTH_NEXT_BEST_ACTION_LABELS[nextBestAction]}.`)

  const openingLine =
    intent === "positive_interest" || intent === "needs_more_information"
      ? `Hi ${name} — saw your text asking for more detail on ${companyName}.`
      : `Hi ${name} — calling about your recent SMS on ${companyName}.`

  const keyQuestion =
    buyingSignals.includes("timeline_urgency")
      ? "What's driving the timeline on your side?"
      : verifiedFact
        ? `Is ${verifiedFact.toLowerCase().replace(/\.$/, "")} still the main pain point?`
        : "What part of the workflow is most urgent for you right now?"

  const desiredOutcome =
    intent === "meeting_request" || intent === "demo_request"
      ? "Book a short fit check or demo slot before ending the call."
      : "Agree on one concrete next step — overview by email, quick call, or scheduling link."

  return {
    whyCallNow,
    openingLine,
    keyQuestion,
    desiredOutcome,
    humanApprovalRequired: true,
  }
}

function wrapSmsDraftSuggestion(input: {
  body: string
  draftType: "reply"
  audit: ReturnType<typeof buildPersonalizedSmsDraft>["audit"]
}): GrowthSmsInboxDraftSuggestion {
  const body = sanitizeSmsSuggestionBody(input.body)
  return {
    qa_marker: GROWTH_SMS_PERSONALIZATION_QA_MARKER,
    channel: "sms",
    draftType: "reply",
    suggestedBody: body,
    charCount: body.length,
    segmentCount: estimateSmsSegments(body.length),
    humanApprovalRequired: true,
    audit: {
      openingHook: input.audit.openingHook,
      cta: input.audit.cta,
      qualityScore: input.audit.qualityScore,
      contextQuality: input.audit.contextQuality,
      memoryQuality: input.audit.memoryQuality,
      confidenceLabel: input.audit.confidenceLabel,
    },
    contextUsed: summarizeSmsContextUsed(input.audit),
    memoryUsed: summarizeSmsMemoryUsed(input.audit),
  }
}

export function buildInboundSmsResponseSuggestions(input: {
  leadId: string
  inboundBody: string
  contactName?: string | null
  companyName: string
  packet: OutreachContextPacket
  priorSmsPreviews: string[]
  priorEmailSummaries?: string[]
  threadClassification?: GrowthInboxClassification | null
  nextBestAction?: GrowthNextBestAction | null
  nextBestActionReason?: string | null
  relationshipMemory?: ReplyCopilotRelationshipMemory
}): GrowthInboundSmsResponseSuggestions {
  const inboundBody = input.inboundBody.trim()
  const classified = classifyReplyIntentV2(inboundBody)
  const buying = extractBuyingSignals(inboundBody)
  const verifiedFact = pickVerifiedFactSnippet(input.packet)
  const contactFirstName = firstName(input.contactName, input.companyName)
  const threadClassification = input.threadClassification ?? null

  const context = projectSmsPersonalizationContext({
    packet: input.packet,
    priorSmsPreviews: input.priorSmsPreviews,
  })
  const { audit } = buildPersonalizedSmsDraft({
    leadId: input.leadId,
    context,
    draftType: "reply",
    maxChars: SMS_PERSONALIZATION_DEFAULT_MAX_CHARS,
  })

  let smsBody: string
  if (shouldSuppressSmsReplySuggestion(classified.intent)) {
    smsBody = buildIntentAwareSmsBody({
      inboundBody,
      intent: classified.intent,
      contactFirstName,
      companyName: input.companyName,
      verifiedFact,
      relationshipMemory: input.relationshipMemory,
      priorSmsPreviews: input.priorSmsPreviews,
    })
  } else {
    smsBody = buildIntentAwareSmsBody({
      inboundBody,
      intent: classified.intent,
      contactFirstName,
      companyName: input.companyName,
      verifiedFact,
      relationshipMemory: input.relationshipMemory,
      priorSmsPreviews: input.priorSmsPreviews,
    })
  }

  const smsReply = wrapSmsDraftSuggestion({ body: smsBody, draftType: "reply", audit })
  const safetyWarnings = auditSmsSuggestionSafety({ body: smsReply.suggestedBody, intent: classified.intent })

  const emailFollowUp = buildEmailFollowUpSuggestion({
    intent: classified.intent,
    companyName: input.companyName,
    contactFirstName,
    nextBestAction: input.nextBestAction ?? null,
    hasPriorEmail: (input.priorEmailSummaries?.length ?? input.packet.priorReplySummaries.length) > 0,
  })

  const callPrompt = buildCallPromptSuggestion({
    intent: classified.intent,
    inboundBody,
    contactFirstName,
    companyName: input.companyName,
    nextBestAction: input.nextBestAction ?? null,
    nextBestActionReason: input.nextBestActionReason ?? null,
    verifiedFact,
    buyingSignals: buying.map((signal) => signal.signal),
  })

  const contextUsed = [
    ...smsReply.contextUsed,
    "inbound_sms_body",
    `reply_intent:${classified.intent}`,
  ]
  if (verifiedFact) contextUsed.push("verified_research")
  if (input.nextBestAction) contextUsed.push(`next_best_action:${input.nextBestAction}`)

  const memoryUsed = [...smsReply.memoryUsed]
  if (input.relationshipMemory?.relationshipSummary) memoryUsed.push("relationship_summary")
  if (input.relationshipMemory?.topObjections.length) memoryUsed.push("known_objections")

  return {
    qa_marker: GROWTH_SMS_INBOUND_RESPONSE_SUGGESTIONS_QA_MARKER,
    channel: "sms",
    humanApprovalRequired: true,
    replyContext: {
      inboundBody,
      intent: classified.intent,
      classification: classified.classification,
      confidence: classified.confidence,
      confidenceTier: classified.confidenceTier,
      sentiment: classified.sentiment,
      engagementSignal: resolveEngagementSignal(classified.intent, threadClassification),
      uncertaintyState: classified.uncertaintyState,
      matchedPhrases: classified.matchedPhrases.map((entry) => entry.phrase),
      threadClassification,
    },
    smsReply,
    emailFollowUp,
    callPrompt,
    nextBestAction: input.nextBestAction ?? null,
    nextBestActionLabel: input.nextBestAction ? GROWTH_NEXT_BEST_ACTION_LABELS[input.nextBestAction] : null,
    contextUsed: [...new Set(contextUsed)],
    memoryUsed: [...new Set(memoryUsed)],
    safetyWarnings,
  }
}

export function buildInboundSmsResponseSuggestionArchitectureAudit() {
  return {
    qa_marker: GROWTH_SMS_INBOUND_RESPONSE_SUGGESTIONS_QA_MARKER,
    reuses: [
      "classifyReplyIntentV2 — inbound body intent",
      "buildSmsPersonalizationContext / assemble-sms-draft — memory + research audit",
      "buildLeadMemoryInfluenceContext — relationship memory (server)",
      "reply-copilot patterns — intent-driven tone",
      "next-best-action — call prompt gating",
      "sms-suggestion-safety — Phase 5.6F rules",
    ],
    doesNot: [
      "Auto-send SMS or email",
      "Modify Twilio transport or sequences",
      "Hallucinate facts beyond verified research packet",
    ],
  }
}
