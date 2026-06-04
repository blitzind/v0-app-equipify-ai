/**
 * Phase 4.3 — CTA intelligence validation samples.
 * Run: pnpm test:growth-outreach-cta-intelligence
 */
import assert from "node:assert/strict"
import { buildPersonalizedOutreachDraft } from "../lib/growth/outreach/personalization/assemble-draft"
import {
  OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
  type OutreachContextPacket,
} from "../lib/growth/outreach/personalization/personalization-types"
import { extractPersonalizationSignals } from "../lib/growth/outreach/personalization/signal-extraction"

const LEAD_ID = "00000000-0000-4000-8000-00000000c3"

const memoryDefaults = {
  memoryAvailable: false,
  memoryCoverageScore: null,
  relationshipStage: null,
  relationshipSummary: null,
  memoryPreferenceSummaries: [] as string[],
  memoryInteractionSummaries: [] as string[],
  memoryCommitmentSummaries: [] as string[],
  memoryAvoidRepeating: [] as string[],
  memoryRiskFlags: [] as string[],
  memoryCommitteeSummaries: [] as string[],
  memoryOpenLoopSummaries: [] as string[],
  memoryEngagementTrend: null as string | null,
  memoryProgressionScore: null as number | null,
  memoryUnresolvedObjectionCount: 0,
}

const phase44Defaults = {
  websiteSummary: null as string | null,
  websiteTextExcerpt: null as string | null,
  researchRecommendedNextAction: null as string | null,
  leadEngineGuidance: null,
}

function ctaText(strategy: { blocks: { key: string; text: string }[] }) {
  return strategy.blocks.find((block) => block.key === "cta")?.text ?? ""
}

function sample(
  label: string,
  packet: OutreachContextPacket,
  generationType:
    | "cold_email"
    | "follow_up_email"
    | "breakup_email"
    | "executive_email" = "cold_email",
) {
  const signals = extractPersonalizationSignals(packet)
  const { strategy } = buildPersonalizedOutreachDraft({
    leadId: LEAD_ID,
    packet,
    signals,
    generationType,
    maxWords: OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
  })
  const intel = strategy.ctaIntelligence

  console.log(`\n=== ${label} ===`)
  console.log(`Existing CTA: ${intel?.legacyCta ?? "n/a"}`)
  console.log(`New CTA: ${ctaText(strategy)}`)
  console.log(`Category: ${intel?.category ?? "n/a"}`)
  console.log(`Quality score: ${intel?.qualityScore.overall ?? "n/a"}/100`)
  console.log(`Selection reason: ${intel?.selectionReason ?? "n/a"}`)
  console.log(`Evidence source: ${intel?.evidenceSource ?? "n/a"}`)
  console.log(`Evidence: ${intel?.evidence ?? "none"}`)

  return { strategy, intel }
}

const baseCold: OutreachContextPacket = {
  companyName: "Summit HVAC Services",
  industryLabel: "HVAC contractor",
  website: "https://summithvac.example",
  employeeSize: "25-50",
  location: "Denver, CO",
  decisionMakerName: "Jordan Lee",
  decisionMakerTitle: "Operations Manager",
  fitScore: 82,
  engagementScore: 20,
  opportunityReadinessTier: null,
  buyingIntent: null,
  competitorPressure: null,
  capacitySignals: ["Growing call volume"],
  websiteFindings: ["Covers commercial HVAC service across the Denver metro with 24/7 emergency dispatch"],
  hiringSignals: ["Hiring service technicians"],
  enrichmentFindings: ["Field service operator"],
  priorTouchSummaries: [],
  priorReplySummaries: [],
  objectionSummaries: [],
  sequenceHistorySummaries: [],
  timelineEventSummaries: [],
  researchConfidence: 78,
  researchPainPoints: ["Manual dispatch process"],
  equipmentServiceIndicators: ["HVAC maintenance"],
  companySummary: "Summit HVAC Services provides commercial HVAC maintenance across Colorado.",
  outreachAngles: ["Lead with dispatch workflow efficiency"],
  priorOutboundSubjects: [],
  priorTouchCount: 0,
  hasWebsiteResearch: true,
  hasDecisionMaker: true,
  ...memoryDefaults,
  ...phase44Defaults,
}

const coldHigh = sample("Cold outreach — high research confidence", baseCold)
const coldLow = sample("Cold outreach — low research confidence", {
  ...baseCold,
  companyName: "Generic Field Co",
  researchConfidence: 25,
  websiteFindings: [],
  outreachAngles: [],
  researchPainPoints: [],
  hasWebsiteResearch: false,
})
const sequenceStep2 = sample("Cold sequence step 2 — no engagement", {
  ...baseCold,
  priorTouchCount: 2,
  priorTouchSummaries: ["Prior outreach on dispatch"],
  sequenceHistorySummaries: ["Sequence step 2: Dispatch question for Summit HVAC Services"],
})
const warmFollowUp = sample("Warm follow-up with prior reply", {
  ...baseCold,
  engagementScore: 62,
  priorReplySummaries: ["Asked for pricing details (pricing_question)"],
  priorTouchCount: 2,
  buyingIntent: "moderate",
}, "follow_up_email")
const memoryRich = sample("Memory-rich follow-up with commitment", {
  ...baseCold,
  memoryAvailable: true,
  memoryCoverageScore: 84,
  relationshipStage: "engaged",
  memoryCommitmentSummaries: ["Send revised dispatch workflow proposal by Friday"],
  priorTouchCount: 3,
}, "follow_up_email")
const breakup = sample("Breakup email", baseCold, "breakup_email")
const executiveWarm = sample("Executive outreach — warm opportunity", {
  ...baseCold,
  engagementScore: 58,
  opportunityReadinessTier: "qualified",
  buyingIntent: "strong",
  priorReplySummaries: ["Interested in ops review"],
}, "executive_email")

assert.equal(coldHigh.intel?.category, "question_based")
assert.ok(coldHigh.intel?.qualityScore.avoidsColdMeetingAsk)
assert.ok(!/15-minute|operations review/i.test(ctaText(coldHigh.strategy)))
assert.equal(coldHigh.intel?.evidenceSource, "research_confidence")

assert.equal(coldLow.intel?.category, "question_based")
assert.ok(coldLow.intel?.qualityScore.avoidsColdMeetingAsk)

assert.equal(sequenceStep2.intel?.category, "follow_up")
assert.equal(sequenceStep2.intel?.evidenceSource, "sequence_stage")

assert.equal(warmFollowUp.intel?.category, "direct")
assert.ok(/times that work|calendar|day works|15-minute/i.test(ctaText(warmFollowUp.strategy)))

assert.equal(memoryRich.intel?.category, "memory_aware")
assert.equal(memoryRich.intel?.evidenceSource, "memory_commitment")
assert.ok(/follow through/i.test(ctaText(memoryRich.strategy)))

assert.equal(breakup.intel?.category, "soft")
assert.equal(breakup.intel?.evidenceSource, "breakup_context")

assert.ok(executiveWarm.intel?.category === "meeting" || executiveWarm.intel?.category === "direct")

console.log("\ngrowth-outreach-cta-intelligence: all checks passed")
