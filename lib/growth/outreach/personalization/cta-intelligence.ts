/** CTA intelligence — context-aware call-to-action selection (Phase 4.3). */

import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import {
  classifyMemoryObjection,
  hasCompetitiveMemoryRisk,
  hasMemoryRelationshipEngagement,
  isExistingCustomerRelationship,
  prefersConciseOutreach,
} from "@/lib/growth/outreach/personalization/memory-strategy"
import {
  interpolateBlockText,
  OUTREACH_MESSAGE_BLOCK_LIBRARY,
} from "@/lib/growth/outreach/personalization/message-blocks"
import { selectResearchAwareCtaStyleId } from "@/lib/growth/outreach/personalization/email-variation-engine"
import { pickVariantIndex } from "@/lib/growth/outreach/personalization/message-variability"
import { resolveResearchEvidenceConfidenceTier } from "@/lib/growth/outreach/personalization/research-evidence-selection"
import type {
  CtaCategory,
  CtaEvidenceSource,
  CtaIntelligenceMetadata,
  CtaQualityScore,
  OutreachContextPacket,
  PersonalizationSignalKey,
  SelectedMessageStrategy,
} from "@/lib/growth/outreach/personalization/personalization-types"

export type { CtaCategory, CtaEvidenceSource, CtaQualityScore } from "@/lib/growth/outreach/personalization/personalization-types"

export type CtaIntelligenceResult = CtaIntelligenceMetadata & {
  text: string
  blockId: string
}

export const MEMORY_CTA_CONFIDENCE_THRESHOLD = 50

type CtaCandidate = {
  category: CtaCategory
  blockId: string
  evidenceSource: CtaEvidenceSource
  evidence: string | null
  selectionReason: string
}

function compactMemorySnippet(text: string, max = 48): string {
  const trimmed = text.trim().replace(/[.…]+$/, "")
  if (trimmed.length <= max) return trimmed
  const cut = trimmed.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > 20 ? cut.slice(0, space) : cut).trim()}…`
}

function pickCtaText(
  blockId: string,
  variationSeed: string,
  tokens: { companyName: string; contactName: string | null },
): string {
  const template =
    OUTREACH_MESSAGE_BLOCK_LIBRARY.cta.find((entry) => entry.id === blockId) ??
    OUTREACH_MESSAGE_BLOCK_LIBRARY.cta[0]!
  const variantIndex = pickVariantIndex(`${variationSeed}:cta:${blockId}`, template.variants.length)
  return interpolateBlockText(template.variants[variantIndex] ?? template.variants[0]!, tokens)
}

export function isWarmOutreachContext(
  packet: OutreachContextPacket,
  signals: PersonalizationSignalKey[],
): boolean {
  if (packet.priorReplySummaries.length > 0) return true
  if (signals.includes("recent_engagement_signal")) return true
  if ((packet.engagementScore ?? 0) >= 45) return true
  if (hasMemoryRelationshipEngagement(packet)) return true
  const stage = packet.relationshipStage?.toLowerCase() ?? ""
  return stage === "evaluating" || stage === "engaged" || stage === "customer" || stage === "active"
}

function warmEnoughForMeetingCta(
  packet: OutreachContextPacket,
  signals: PersonalizationSignalKey[],
  generationType: GrowthAiCopilotGenerationType,
): boolean {
  if (
    generationType === "follow_up_email" ||
    generationType === "reengagement_email" ||
    generationType === "next_message" ||
    generationType === "executive_email"
  ) {
    return isWarmOutreachContext(packet, signals)
  }

  if (generationType === "cold_email") {
    if (packet.objectionSummaries.length > 0 && packet.priorReplySummaries.length === 0) return false
    return packet.priorReplySummaries.length > 0 || hasMemoryRelationshipEngagement(packet)
  }

  return isWarmOutreachContext(packet, signals)
}

export function hasBookingOrOpportunitySignal(packet: OutreachContextPacket): boolean {
  const intent = packet.buyingIntent?.toLowerCase() ?? ""
  if (intent.includes("strong") || intent.includes("high") || intent.includes("moderate")) return true

  const tier = packet.opportunityReadinessTier?.toLowerCase() ?? ""
  if (tier.includes("qualified") || tier.includes("commit") || tier.includes("ready")) return true

  const prefs = packet.memoryPreferenceSummaries.join(" ").toLowerCase()
  return /\b(meeting|call|demo|walkthrough|calendar)\b/.test(prefs)
}

function memoryMeetsCtaThreshold(packet: OutreachContextPacket): boolean {
  if (!packet.memoryAvailable) return false
  if ((packet.memoryCoverageScore ?? 0) >= MEMORY_CTA_CONFIDENCE_THRESHOLD) return true
  return (
    packet.memoryCommitmentSummaries.length > 0 ||
    packet.memoryInteractionSummaries.length > 0
  )
}

function sequenceStage(packet: OutreachContextPacket): number {
  return Math.max(packet.priorTouchCount, packet.sequenceHistorySummaries.length)
}

function resolveQuestionBlockId(
  signals: PersonalizationSignalKey[],
  painBlockId: string | undefined,
): string {
  if (signals.includes("dispatch_appears_manual") || painBlockId === "dispatch_manual") {
    return "question_dispatch"
  }
  if (signals.includes("website_has_no_scheduler") || painBlockId === "scheduling_gaps") {
    return "question_scheduling"
  }
  return "question_workflow"
}

function resolveMemoryCtaCandidate(packet: OutreachContextPacket): CtaCandidate | null {
  if (!memoryMeetsCtaThreshold(packet)) return null

  if (packet.memoryCommitmentSummaries[0]) {
    return {
      category: "memory_aware",
      blockId: "memory_commitment",
      evidenceSource: "memory_commitment",
      evidence: packet.memoryCommitmentSummaries[0],
      selectionReason: "Memory commitment recorded — continue prior thread instead of a cold meeting ask.",
    }
  }

  if (packet.memoryInteractionSummaries[0]) {
    return {
      category: "memory_aware",
      blockId: "memory_commitment",
      evidenceSource: "memory_interaction",
      evidence: packet.memoryInteractionSummaries[0],
      selectionReason: "Prior interaction on file — use memory-aware follow-through CTA.",
    }
  }

  if (prefersConciseOutreach(packet)) {
    return {
      category: "memory_aware",
      blockId: "soft_resource",
      evidenceSource: "memory_preference",
      evidence: packet.memoryPreferenceSummaries[0] ?? null,
      selectionReason: "Concise outreach preference detected — soft resource CTA over meeting request.",
    }
  }

  return null
}

function resolveObjectionCtaCandidate(packet: OutreachContextPacket): CtaCandidate | null {
  const category = classifyMemoryObjection(packet)
  if (!category) return null

  if (category === "pricing") {
    return {
      category: "question_based",
      blockId: "question_clarification",
      evidenceSource: "memory_objection",
      evidence: packet.objectionSummaries[0] ?? null,
      selectionReason: "Pricing objection on file — clarification CTA instead of another meeting ask.",
    }
  }

  if (category === "timing") {
    return {
      category: "soft",
      blockId: "follow_up_continue",
      evidenceSource: "memory_objection",
      evidence: packet.objectionSummaries[0] ?? null,
      selectionReason: "Timing objection on file — low-pressure follow-up CTA.",
    }
  }

  if (category === "implementation" || category === "staffing") {
    return {
      category: "question_based",
      blockId: "question_clarification",
      evidenceSource: "memory_objection",
      evidence: packet.objectionSummaries[0] ?? null,
      selectionReason: "Implementation or staffing concern on file — focused clarification CTA.",
    }
  }

  return {
    category: "question_based",
    blockId: "question_clarification",
    evidenceSource: "memory_objection",
    evidence: packet.objectionSummaries[0] ?? null,
    selectionReason: "Recorded objection — clarification CTA to stay context-aware.",
  }
}

function resolveCustomerCtaCandidate(packet: OutreachContextPacket): CtaCandidate | null {
  if (!isExistingCustomerRelationship(packet)) return null

  return {
    category: "memory_aware",
    blockId: "customer_next_step",
    evidenceSource: "relationship_stage",
    evidence: packet.relationshipSummary ?? packet.memoryInteractionSummaries[0] ?? null,
    selectionReason: "Existing customer relationship — next-step continuation CTA.",
  }
}

function resolveLeadEngineCtaCandidate(input: {
  packet: OutreachContextPacket
  signals: PersonalizationSignalKey[]
  painBlockId: string | undefined
  meetingReady: boolean
  generationType: GrowthAiCopilotGenerationType
}): CtaCandidate | null {
  const guidance = input.packet.leadEngineGuidance
  if (!guidance?.recommendedCtaStrategy?.trim() || input.meetingReady) return null
  if (input.generationType !== "cold_email") return null

  const strategy = guidance.recommendedCtaStrategy.toUpperCase()
  if (
    strategy.includes("PAIN_VALIDATION") ||
    strategy.includes("DISCOVERY") ||
    strategy.includes("FIT_CONFIRMATION") ||
    strategy.includes("TIMING_CHECK")
  ) {
    return {
      category: "question_based",
      blockId: resolveQuestionBlockId(input.signals, input.painBlockId),
      evidenceSource: "lead_engine_guidance",
      evidence: guidance.recommendedCtaStrategy,
      selectionReason: "Lead Engine advisory CTA strategy favors validation question over meeting ask.",
    }
  }

  if (strategy.includes("CHANNEL_TEST")) {
    return {
      category: "soft",
      blockId: prefersConciseOutreach(input.packet) ? "soft_resource" : "soft_walkthrough",
      evidenceSource: "lead_engine_guidance",
      evidence: guidance.recommendedCtaStrategy,
      selectionReason: "Lead Engine advisory CTA strategy favors soft channel test.",
    }
  }

  return null
}

function resolveCtaCandidate(input: {
  packet: OutreachContextPacket
  strategy: SelectedMessageStrategy
  signals: PersonalizationSignalKey[]
  generationType: GrowthAiCopilotGenerationType
}): CtaCandidate {
  const { packet, strategy, signals, generationType } = input
  const warm = isWarmOutreachContext(packet, signals)
  const meetingReady = warmEnoughForMeetingCta(packet, signals, generationType)
  const booking = hasBookingOrOpportunitySignal(packet)
  const researchTier = resolveResearchEvidenceConfidenceTier(packet.researchConfidence)
  const step = sequenceStage(packet)
  const painBlockId = strategy.blocks.find((block) => block.key === "pain")?.blockId
  const legacyBlockId = strategy.blocks.find((block) => block.key === "cta")?.blockId ?? "fifteen_minute"

  if (generationType === "breakup_email" || strategy.angle === "breakup_respectful") {
    return {
      category: "soft",
      blockId: prefersConciseOutreach(packet) ? "soft_resource" : "soft_walkthrough",
      evidenceSource: "breakup_context",
      evidence: null,
      selectionReason: "Breakup email — low-pressure soft CTA instead of another meeting request.",
    }
  }

  if (generationType === "response_draft" || strategy.angle === "reply_response") {
    return {
      category: "direct",
      blockId: "direct_reply",
      evidenceSource: "prior_reply",
      evidence: packet.priorReplySummaries[0] ?? null,
      selectionReason: "Reply response — direct reply-first CTA.",
    }
  }

  const memoryCandidate = resolveMemoryCtaCandidate(packet)
  const objectionCandidate = resolveObjectionCtaCandidate(packet)
  const customerCandidate = resolveCustomerCtaCandidate(packet)
  const isFollowUpType =
    generationType === "follow_up_email" ||
    generationType === "reengagement_email" ||
    generationType === "next_message" ||
    strategy.angle === "engagement_follow_up"

  if (isFollowUpType && memoryCandidate) {
    return memoryCandidate
  }

  if (objectionCandidate && !meetingReady && generationType !== "breakup_email") {
    return objectionCandidate
  }

  if (customerCandidate && (meetingReady || generationType === "follow_up_email")) {
    return customerCandidate
  }

  if (isFollowUpType) {
    if (meetingReady && booking) {
      return {
        category: "direct",
        blockId: "direct_time",
        evidenceSource: "booking_signal",
        evidence: packet.buyingIntent ?? packet.opportunityReadinessTier,
        selectionReason: "Warm follow-up with booking or opportunity signal — direct scheduling CTA.",
      }
    }
    if (meetingReady) {
      return {
        category: "meeting",
        blockId: prefersConciseOutreach(packet) ? "fifteen_minute" : "operations_review",
        evidenceSource: "engagement_signal",
        evidence: packet.priorReplySummaries[0] ?? null,
        selectionReason: "Warm follow-up with prior engagement — meeting CTA appropriate.",
      }
    }
    return {
      category: "follow_up",
      blockId: step >= 2 ? "follow_up_continue" : "follow_up_reply",
      evidenceSource: "sequence_stage",
      evidence: packet.sequenceHistorySummaries[0] ?? null,
      selectionReason: "Follow-up without strong engagement — reply-first follow-up CTA.",
    }
  }

  if (generationType === "executive_email" || strategy.angle === "executive_outcome") {
    if (hasCompetitiveMemoryRisk(packet)) {
      return {
        category: "soft",
        blockId: "soft_resource",
        evidenceSource: "memory_preference",
        evidence: packet.objectionSummaries[0] ?? null,
        selectionReason: "Competitive risk in memory — soft compare/resource CTA for executive path.",
      }
    }
    if (booking || meetingReady) {
      return {
        category: "meeting",
        blockId: "operations_review",
        evidenceSource: "opportunity_signal",
        evidence: packet.opportunityReadinessTier,
        selectionReason: "Executive outreach with warm or opportunity context — ops review meeting CTA.",
      }
    }
    return {
      category: "direct",
      blockId: "direct_time",
      evidenceSource: "opportunity_signal",
      evidence: null,
      selectionReason: "Executive outreach — direct scheduling ask.",
    }
  }

  if (memoryCandidate && hasMemoryRelationshipEngagement(packet) && !meetingReady) {
    return memoryCandidate
  }

  if (objectionCandidate && generationType === "cold_email" && !meetingReady) {
    return objectionCandidate
  }

  if (objectionCandidate && !meetingReady && generationType !== "breakup_email" && !isFollowUpType) {
    return objectionCandidate
  }

  if (meetingReady && booking) {
    return {
      category: "direct",
      blockId: "direct_time",
      evidenceSource: "booking_signal",
      evidence: packet.buyingIntent,
      selectionReason: "Warm lead with booking intent — direct time selection CTA.",
    }
  }

  if (meetingReady) {
    return {
      category: "meeting",
      blockId: legacyBlockId === "operations_review" ? "operations_review" : "fifteen_minute",
      evidenceSource: "engagement_signal",
      evidence: packet.priorReplySummaries[0] ?? null,
      selectionReason: "Warm engagement with reply history — meeting CTA.",
    }
  }

  if (step >= 2 && !meetingReady) {
    return {
      category: "follow_up",
      blockId: "follow_up_reply",
      evidenceSource: "sequence_stage",
      evidence: packet.sequenceHistorySummaries[0] ?? null,
      selectionReason: "Repeat sequence touch without engagement — follow-up reply CTA, not another meeting ask.",
    }
  }

  if (step === 1 && !meetingReady) {
    return {
      category: "soft",
      blockId: prefersConciseOutreach(packet) ? "soft_resource" : "soft_walkthrough",
      evidenceSource: "sequence_stage",
      evidence: packet.priorTouchSummaries[0] ?? null,
      selectionReason: "Second sequence touch — soft CTA before asking for a meeting.",
    }
  }

  const leadEngineCta = resolveLeadEngineCtaCandidate({
    packet,
    signals,
    painBlockId,
    meetingReady,
    generationType,
  })
  if (leadEngineCta) return leadEngineCta

  if (researchTier && !meetingReady) {
    const blockId = selectResearchAwareCtaStyleId({
      variationSeed: strategy.variationKey,
      packet,
      signals,
      meetingReady: false,
    })
    return {
      category: blockId.startsWith("cta_") || blockId.includes("review") || blockId.includes("minute")
        ? "soft"
        : "question_based",
      blockId,
      evidenceSource: "research_confidence",
      evidence: strategy.researchOpener?.evidence ?? packet.researchPainPoints[0] ?? null,
      selectionReason: "Cold outreach with usable research — action-oriented review CTA.",
    }
  }

  if (signals.includes("dispatch_appears_manual") || signals.includes("website_has_no_scheduler")) {
    const blockId = selectResearchAwareCtaStyleId({
      variationSeed: strategy.variationKey,
      packet,
      signals,
      meetingReady: false,
    })
    return {
      category: "question_based",
      blockId,
      evidenceSource: "pain_signal",
      evidence: packet.researchPainPoints[0] ?? null,
      selectionReason: "Pain signal detected — specific workflow or gap review CTA.",
    }
  }

  const blockId = selectResearchAwareCtaStyleId({
    variationSeed: strategy.variationKey,
    packet,
    signals,
    meetingReady: false,
  })
  return {
    category: "soft",
    blockId,
    evidenceSource: "legacy_template",
    evidence: packet.researchRecommendedNextAction ?? null,
    selectionReason: "Cold outreach — actionable review CTA instead of generic question.",
  }
}

const WEAK_CTA_PATTERNS = [
  /^worth comparing notes/i,
  /^happy to circle back/i,
  /^should i keep this on your radar/i,
  /^let me know if/i,
  /^thoughts\?$/i,
]

const ACTIONABLE_CTA_PATTERNS = [
  /\b(review|call|walkthrough|assessment|audit|diagnostic|meeting|schedule|compare|benchmark)\b/i,
  /\?\s*$/,
]

export function isWeakGenericCta(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (WEAK_CTA_PATTERNS.some((p) => p.test(trimmed))) return true
  return !ACTIONABLE_CTA_PATTERNS.some((p) => p.test(trimmed))
}

export function ensureActionableCtaClosing(body: string, ctaText: string): string {
  const trimmedBody = body.trim()
  const trimmedCta = ctaText.trim()
  if (!trimmedCta) return trimmedBody

  const lastSentence = trimmedBody.split(/[.!?]/).filter(Boolean).pop()?.trim() ?? ""
  if (isWeakGenericCta(lastSentence) || !ACTIONABLE_CTA_PATTERNS.some((p) => p.test(lastSentence))) {
    const withoutWeakEnd = trimmedBody.replace(/\s*(Worth comparing notes[^.?!]*[.?!]?)\s*$/i, "").trim()
    const base = withoutWeakEnd.length > 0 ? withoutWeakEnd : trimmedBody
    if (base.toLowerCase().includes(trimmedCta.toLowerCase().slice(0, 24))) return trimmedBody
    return `${base.replace(/[.!?]\s*$/, "")}. ${trimmedCta}`
  }
  return trimmedBody
}

export function scoreCtaQuality(input: {
  category: CtaCategory
  text: string
  generationType: GrowthAiCopilotGenerationType
  warm: boolean
  evidence: string | null
  legacyCta: string
}): CtaQualityScore {
  const isMeetingAsk = /15-minute|walkthrough|operations review|calendar|fit check/i.test(input.text)
  const isQuestion = input.text.includes("?") && input.category === "question_based"
  const isSoft = input.category === "soft" || input.category === "follow_up"
  const isCold = input.generationType === "cold_email" && !input.warm

  let replyFit = 70
  if (isCold && (isQuestion || isSoft || input.category === "direct")) replyFit = 95
  if (isCold && isMeetingAsk && input.category === "meeting") replyFit = 25
  if (!isCold && input.category === "meeting" && input.warm) replyFit = 90

  let contextMatch = 65
  if (input.generationType === "breakup_email" && input.category === "soft") contextMatch = 95
  if (input.generationType === "follow_up_email" && (input.category === "follow_up" || input.category === "memory_aware")) {
    contextMatch = 90
  }
  if (input.generationType === "response_draft" && input.category === "direct") contextMatch = 95
  if (input.generationType === "cold_email" && input.category === "question_based") contextMatch = 92

  let specificity = 50
  if (input.evidence) specificity += 35
  if (/dispatch|scheduling|visibility|workflow|manual/i.test(input.text)) specificity += 15
  specificity = Math.min(100, specificity)

  let engagementAlignment = 60
  if (input.warm && input.category === "meeting") engagementAlignment = 92
  if (input.warm && input.category === "direct") engagementAlignment = 88
  if (!input.warm && (input.category === "question_based" || input.category === "soft")) engagementAlignment = 90
  if (!input.warm && input.category === "meeting") engagementAlignment = 30

  let memoryAlignment = 70
  if (input.category === "memory_aware") memoryAlignment = 95
  if (input.category === "memory_aware" && input.evidence) memoryAlignment = 100

  const legacyMeeting = /15-minute|walkthrough|operations review/i.test(input.legacyCta)
  const improvedColdMeeting = isCold && legacyMeeting && !isMeetingAsk

  const overall = Math.round(
    replyFit * 0.25 +
      contextMatch * 0.2 +
      specificity * 0.2 +
      engagementAlignment * 0.2 +
      memoryAlignment * 0.15 +
      (improvedColdMeeting ? 5 : 0),
  )

  return {
    overall: Math.min(100, overall),
    replyFit,
    contextMatch,
    specificity,
    engagementAlignment,
    memoryAlignment,
    avoidsColdMeetingAsk: isCold ? !isMeetingAsk : true,
  }
}

export function buildIntelligentCta(input: {
  packet: OutreachContextPacket
  strategy: SelectedMessageStrategy
  signals: PersonalizationSignalKey[]
  generationType: GrowthAiCopilotGenerationType
  variationSeed: string
}): CtaIntelligenceResult {
  const tokens = {
    companyName: input.packet.companyName,
    contactName: input.packet.decisionMakerName,
  }
  const legacyBlock = input.strategy.blocks.find((block) => block.key === "cta")
  const legacyCta = legacyBlock?.text ?? pickCtaText("fifteen_minute", input.variationSeed, tokens)
  const warm = isWarmOutreachContext(input.packet, input.signals)
  const meetingReady = warmEnoughForMeetingCta(input.packet, input.signals, input.generationType)
  const candidate = resolveCtaCandidate(input)
  let text = pickCtaText(candidate.blockId, input.variationSeed, tokens)

  if (candidate.category === "memory_aware" && candidate.evidence && candidate.blockId === "memory_commitment") {
    const topic = compactMemorySnippet(candidate.evidence)
    text = `Still good to follow through on ${topic.toLowerCase()}?`
  }

  if (candidate.blockId === "customer_next_step" && candidate.evidence) {
    const topic = compactMemorySnippet(candidate.evidence, 56)
    text = `What would be most useful as a next step on ${topic.toLowerCase()}?`
  }

  if (isWeakGenericCta(text)) {
    const upgradedId = selectResearchAwareCtaStyleId({
      variationSeed: input.variationSeed,
      packet: input.packet,
      signals: input.signals,
      meetingReady,
    })
    text = pickCtaText(upgradedId, `${input.variationSeed}:cta-upgrade`, tokens)
    candidate.blockId = upgradedId
    if (candidate.category === "question_based" && upgradedId.startsWith("cta_")) {
      candidate.category = "soft"
    }
  }

  const qualityScore = scoreCtaQuality({
    category: candidate.category,
    text,
    generationType: input.generationType,
    warm: input.generationType === "cold_email" ? meetingReady : warm,
    evidence: candidate.evidence,
    legacyCta,
  })

  return {
    text,
    blockId: candidate.blockId,
    category: candidate.category,
    evidenceSource: candidate.evidenceSource,
    evidence: candidate.evidence,
    selectionReason: candidate.selectionReason,
    qualityScore,
    legacyCta,
  }
}

export function applyCtaIntelligence(
  strategy: SelectedMessageStrategy,
  result: CtaIntelligenceResult,
): SelectedMessageStrategy {
  const ctaIndex = strategy.blocks.findIndex((block) => block.key === "cta")
  if (ctaIndex < 0) return strategy

  const blocks = [...strategy.blocks]
  blocks[ctaIndex] = {
    ...blocks[ctaIndex],
    blockId: result.blockId,
    label: `${result.category} CTA`,
    text: result.text,
  }

  return {
    ...strategy,
    blocks,
    ctaIntelligence: {
      category: result.category,
      evidenceSource: result.evidenceSource,
      evidence: result.evidence,
      selectionReason: result.selectionReason,
      qualityScore: result.qualityScore,
      legacyCta: result.legacyCta,
    },
  }
}
