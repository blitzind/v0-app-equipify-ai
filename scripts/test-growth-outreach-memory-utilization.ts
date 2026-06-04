/**
 * Phase 4.5 — memory-aware outreach validation.
 * Run: pnpm test:growth-outreach-memory-utilization
 */
import assert from "node:assert/strict"
import { buildPersonalizedOutreachDraft } from "../lib/growth/outreach/personalization/assemble-draft"
import { listAvailableMemorySignals } from "../lib/growth/outreach/personalization/memory-utilization"
import {
  OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
  type OutreachContextPacket,
} from "../lib/growth/outreach/personalization/personalization-types"
import { extractPersonalizationSignals } from "../lib/growth/outreach/personalization/signal-extraction"

const LEAD_ID = "00000000-0000-4000-8000-00000000e5"

const memoryEmpty = {
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

const phase44Empty = {
  websiteSummary: null as string | null,
  websiteTextExcerpt: null as string | null,
  researchRecommendedNextAction: null as string | null,
  leadEngineGuidance: null,
}

const basePacket: OutreachContextPacket = {
  companyName: "Summit HVAC Services",
  industryLabel: "HVAC contractor",
  website: "https://summithvac.example",
  employeeSize: "25-50",
  location: "Denver, CO",
  decisionMakerName: "Jordan Lee",
  decisionMakerTitle: "Operations Manager",
  fitScore: 82,
  engagementScore: 55,
  opportunityReadinessTier: "qualified",
  buyingIntent: "moderate",
  competitorPressure: null,
  capacitySignals: ["Growing call volume"],
  websiteSummary: "Summit HVAC runs 24/7 emergency dispatch with phone-only booking.",
  websiteTextExcerpt: null,
  websiteFindings: ["Manual dispatch and phone-only booking"],
  hiringSignals: ["Hiring service technicians"],
  enrichmentFindings: ["Field service operator"],
  researchRecommendedNextAction: null,
  priorTouchSummaries: [],
  priorReplySummaries: [],
  objectionSummaries: [],
  sequenceHistorySummaries: [],
  timelineEventSummaries: [],
  researchConfidence: 72,
  researchPainPoints: ["Manual dispatch process"],
  equipmentServiceIndicators: ["HVAC maintenance"],
  companySummary: "Summit HVAC Services provides commercial HVAC maintenance across Colorado.",
  outreachAngles: ["Growing commercial HVAC footprint across Denver metro"],
  priorOutboundSubjects: [],
  priorTouchCount: 0,
  hasWebsiteResearch: true,
  hasDecisionMaker: true,
  ...memoryEmpty,
  ...phase44Empty,
  leadEngineGuidance: null,
}

function openerText(strategy: { blocks: { key: string; text: string }[] }) {
  return strategy.blocks.find((block) => block.key === "opening")?.text ?? ""
}

function ctaText(strategy: { blocks: { key: string; text: string }[] }) {
  return strategy.blocks.find((block) => block.key === "cta")?.text ?? ""
}

function sample(label: string, packet: OutreachContextPacket, generationType: "cold_email" | "follow_up_email" = "cold_email") {
  const signals = extractPersonalizationSignals(packet)
  const available = listAvailableMemorySignals(packet)
  const { strategy, draft, memoryQuality } = buildPersonalizedOutreachDraft({
    leadId: LEAD_ID,
    packet,
    signals,
    generationType,
    maxWords: OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
  })

  console.log(`\n=== ${label} ===`)
  console.log(`Memory available (${available.length}): ${available.join(", ") || "none"}`)
  console.log(`Memory used (${memoryQuality.memorySignalsUsed.length}): ${memoryQuality.memorySignalsUsed.join(", ") || "none"}`)
  console.log(`Memory utilization: ${memoryQuality.memoryUtilizationPercentage}%`)
  console.log(`Subject: ${draft.subject}`)
  console.log(`Opener: ${openerText(strategy)}`)
  console.log(`CTA: ${ctaText(strategy)}`)
  console.log(`Memory opener source: ${strategy.memoryOpener?.source ?? "none"}`)
  console.log(`Subject evidence: ${strategy.subjectIntelligence?.evidenceSource ?? "none"}`)
  console.log(`CTA evidence: ${strategy.ctaIntelligence?.evidenceSource ?? "none"}`)

  return { strategy, draft, memoryQuality, available }
}

const newLead = sample("New lead", basePacket)
assert.equal(newLead.memoryQuality.memoryUtilizationPercentage, 0)
assert.ok(!newLead.strategy.memoryOpener)

const warmLead = sample("Warm lead", {
  ...basePacket,
  companyName: "FrontRange Mechanical",
  priorReplySummaries: ["Asked for more detail on technician routing (interested)"],
  priorTouchSummaries: ["Prior outreach on dispatch workflow"],
  priorTouchCount: 2,
  engagementScore: 62,
  memoryAvailable: true,
  memoryCoverageScore: 58,
  relationshipStage: "engaged",
  memoryInteractionSummaries: ["Discussed manual dispatch board in prior email thread"],
  memoryOpenLoopSummaries: ["Asked for more detail on technician routing"],
  memoryEngagementTrend: "improving",
  memoryProgressionScore: 64,
})
assert.ok(warmLead.memoryQuality.memoryUtilizationPercentage >= 40)
assert.ok(warmLead.strategy.memoryOpener || warmLead.strategy.subjectIntelligence?.category === "memory_aware")

const memoryRich = sample(
  "Memory-rich lead",
  {
    ...basePacket,
    companyName: "Alpine Service Group",
    memoryAvailable: true,
    memoryCoverageScore: 72,
    relationshipStage: "evaluating",
    relationshipSummary: "Ops lead asked for a lighter follow-up after reviewing dispatch notes.",
    memoryInteractionSummaries: ["Discussed manual dispatch board in prior email thread"],
    memoryCommitmentSummaries: ["Send revised dispatch workflow proposal by Friday"],
    memoryPreferenceSummaries: ["communication preference: concise email updates"],
    memoryOpenLoopSummaries: ["Asked for pricing breakdown after demo"],
    priorReplySummaries: ["Asked for pricing breakdown after demo (interested)"],
    priorTouchCount: 2,
    engagementScore: 62,
  },
  "follow_up_email",
)
assert.ok(memoryRich.strategy.memoryOpener?.source === "memory_commitment" || memoryRich.strategy.memoryOpener)
assert.ok(/pricing|dispatch|proposal|follow/i.test(memoryRich.draft.subject))

const commitmentLead = sample(
  "Commitment-based lead",
  {
    ...basePacket,
    companyName: "Peak Mechanical",
    memoryAvailable: true,
    memoryCoverageScore: 68,
    relationshipStage: "evaluating",
    memoryCommitmentSummaries: ["Send revised dispatch workflow proposal by Friday"],
    memoryInteractionSummaries: ["Reviewed dispatch workflow notes in prior call"],
    priorTouchCount: 1,
  },
  "follow_up_email",
)
assert.equal(commitmentLead.strategy.memoryOpener?.source, "memory_commitment")

const objectionLead = sample(
  "Objection-heavy lead",
  {
    ...basePacket,
    companyName: "BlueSky HVAC",
    memoryAvailable: true,
    memoryCoverageScore: 61,
    relationshipStage: "evaluating",
    objectionSummaries: ["pricing: Budget approval needed before any rollout"],
    memoryAvoidRepeating: ["Do not re-ask for a live demo this week"],
    memoryPreferenceSummaries: ["communication preference: brief written follow-up"],
    memoryInteractionSummaries: ["Requested pricing breakdown after initial walkthrough"],
    memoryOpenLoopSummaries: ["Requested pricing breakdown after initial walkthrough"],
    engagementScore: 35,
  },
  "cold_email",
)
assert.ok(
  objectionLead.strategy.ctaIntelligence?.evidenceSource === "memory_objection" ||
    objectionLead.strategy.subjectIntelligence?.evidenceSource === "memory_objection" ||
    objectionLead.strategy.memoryOpener?.source === "memory_open_loop",
)
assert.ok(objectionLead.memoryQuality.memorySignalsUsed.includes("objections"))

const existingCustomer = sample(
  "Existing customer",
  {
    ...basePacket,
    companyName: "Horizon Mechanical",
    memoryAvailable: true,
    memoryCoverageScore: 78,
    relationshipStage: "customer",
    relationshipSummary: "Active customer evaluating technician routing improvements.",
    memoryInteractionSummaries: ["Customer team asked for next-step rollout guidance"],
    memoryCommitmentSummaries: ["Share rollout checklist before next ops review"],
    memoryEngagementTrend: "stable",
    memoryProgressionScore: 82,
    engagementScore: 74,
    priorReplySummaries: ["Confirmed interest in next-step rollout guidance"],
  },
  "follow_up_email",
)
assert.ok(existingCustomer.strategy.memoryOpener || existingCustomer.strategy.subjectIntelligence?.category === "memory_aware")
assert.ok(existingCustomer.memoryQuality.memoryUtilizationPercentage >= 35)

console.log("\nPhase 4.5 memory utilization validation passed")
