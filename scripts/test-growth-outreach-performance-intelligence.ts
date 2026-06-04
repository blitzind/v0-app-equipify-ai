/**
 * Phase 4.6 — Outreach performance intelligence validation.
 * Run: pnpm test:growth-outreach-performance-intelligence
 */
import assert from "node:assert/strict"
import { buildPersonalizedOutreachDraft } from "../lib/growth/outreach/personalization/assemble-draft"
import {
  OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
  OUTREACH_PERSONALIZATION_STRATEGY_VERSION,
  type OutreachContextPacket,
  type OutreachPersonalizationAudit,
} from "../lib/growth/outreach/personalization/personalization-types"
import { extractPersonalizationSignals } from "../lib/growth/outreach/personalization/signal-extraction"
import { buildOutreachPerformanceAttributionRecord } from "../lib/growth/outreach/performance/outreach-attribution-builder"
import { aggregateCtaPerformance } from "../lib/growth/outreach/performance/cta-performance"
import {
  buildOutreachPerformanceExperimentReadiness,
  filterAttributedSendsForComparison,
} from "../lib/growth/outreach/performance/experiment-readiness"
import { aggregateOpenerPerformance } from "../lib/growth/outreach/performance/opener-performance"
import { aggregatePersonalizationPerformance } from "../lib/growth/outreach/performance/personalization-performance"
import { buildOutreachPerformanceDataAudit } from "../lib/growth/outreach/performance/performance-data-audit"
import { buildExecutiveSummary } from "../lib/growth/outreach/performance/performance-aggregator"
import { attachOutreachPerformanceOutcomes } from "../lib/growth/outreach/performance/performance-outcome-resolver"
import {
  GROWTH_OUTREACH_PERFORMANCE_QA_MARKER,
  type OutreachPerformanceAttributedSend,
  type OutreachPerformanceOutcomeFlags,
} from "../lib/growth/outreach/performance/performance-types"
import { aggregateSubjectPerformance } from "../lib/growth/outreach/performance/subject-performance"

const LEAD_ID = "00000000-0000-4000-8000-00000000p6"

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

function basePacket(overrides: Partial<OutreachContextPacket> = {}): OutreachContextPacket {
  return {
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
    leadEngineGuidance: null,
    ...memoryEmpty,
    ...overrides,
  }
}

function buildAuditFromPacket(
  packet: OutreachContextPacket,
  generationType: "cold_email" | "follow_up_email" = "cold_email",
): OutreachPersonalizationAudit {
  const signals = extractPersonalizationSignals(packet)
  const { draft, strategy, contextQuality, memoryQuality } = buildPersonalizedOutreachDraft({
    leadId: LEAD_ID,
    packet,
    signals,
    generationType,
    maxWords: OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
  })

  return {
    strategyVersion: OUTREACH_PERSONALIZATION_STRATEGY_VERSION,
    contextPacket: packet,
    selectedBlocks: strategy.blocks,
    angle: strategy.angle,
    industry: strategy.industry,
    sourceSignals: strategy.sourceSignals,
    warnings: [],
    confidenceScore: 75,
    confidenceLabel: "high",
    variationKey: strategy.variationKey,
    deterministicDraft: draft,
    refinedByAi: false,
    generationType,
    maxWords: OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
    subjectIntelligence: strategy.subjectIntelligence,
    ctaIntelligence: strategy.ctaIntelligence,
    contextQuality,
    memoryQuality,
    researchOpener: strategy.researchOpener,
    memoryOpener: strategy.memoryOpener,
    memoryInfluence: strategy.memoryInfluence,
    communicationStyle: strategy.communicationStyle,
  }
}

function mockSend(
  audit: OutreachPersonalizationAudit,
  outcomes: OutreachPerformanceOutcomeFlags,
  index: number,
): OutreachPerformanceAttributedSend {
  const attribution = buildOutreachPerformanceAttributionRecord({
    audit,
    generationId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    leadId: `${LEAD_ID.slice(0, -2)}${String(index).padStart(2, "0")}`,
  })
  return attachOutreachPerformanceOutcomes(attribution, {
    ...outcomes,
    sent: true,
    sentAt: new Date().toISOString(),
  })
}

function printGroupRows(
  label: string,
  rows: { groupLabel?: string; bucketLabel?: string; sends: number; replyRate: number | null }[],
) {
  console.log(`\n--- ${label} ---`)
  for (const row of rows.slice(0, 5)) {
    const name = row.groupLabel ?? row.bucketLabel ?? "unknown"
    console.log(
      `  ${name}: sends=${row.sends} replyRate=${row.replyRate == null ? "n/a" : `${row.replyRate.toFixed(1)}%`}`,
    )
  }
}

console.log("Phase 4.6 — Outreach Performance Intelligence Validation\n")

const researchPacket = basePacket()
const memoryPacket = basePacket({
  memoryAvailable: true,
  memoryCoverageScore: 85,
  relationshipStage: "engaged",
  relationshipSummary: "Jordan asked for pricing after the last demo.",
  memoryCommitmentSummaries: ["Send revised dispatch workflow one-pager"],
  memoryInteractionSummaries: ["Opened last email twice"],
  memoryPreferenceSummaries: ["Prefers concise bullet points"],
  priorTouchCount: 2,
  priorReplySummaries: ["Interested in scheduling a walkthrough"],
})
const lowContextPacket = basePacket({
  websiteSummary: null,
  websiteFindings: [],
  companySummary: null,
  outreachAngles: [],
  researchConfidence: 15,
  hasWebsiteResearch: false,
  researchPainPoints: [],
})

const scenarios: OutreachPerformanceAttributedSend[] = [
  mockSend(buildAuditFromPacket(researchPacket), { sent: true, replied: true, positiveInterest: true, meetingBooked: true, opportunityCreated: false }, 1),
  mockSend(buildAuditFromPacket(researchPacket), { sent: true, replied: true, positiveInterest: false, meetingBooked: false, opportunityCreated: false }, 2),
  mockSend(buildAuditFromPacket(researchPacket), { sent: true, replied: false, positiveInterest: false, meetingBooked: false, opportunityCreated: false }, 3),
  mockSend(buildAuditFromPacket(memoryPacket, "follow_up_email"), { sent: true, replied: true, positiveInterest: true, meetingBooked: true, opportunityCreated: true }, 4),
  mockSend(buildAuditFromPacket(memoryPacket, "follow_up_email"), { sent: true, replied: true, positiveInterest: true, meetingBooked: false, opportunityCreated: false }, 5),
  mockSend(buildAuditFromPacket(lowContextPacket), { sent: true, replied: false, positiveInterest: false, meetingBooked: false, opportunityCreated: false }, 6),
  mockSend(buildAuditFromPacket(lowContextPacket), { sent: true, replied: false, positiveInterest: false, meetingBooked: false, opportunityCreated: false }, 7),
]

const sampleAttribution = scenarios[0]!
console.log("=== Generated email attribution record ===")
console.log(JSON.stringify({
  attributionId: sampleAttribution.attributionId,
  subjectStrategyKey: sampleAttribution.subjectStrategyKey,
  openerStrategyKey: sampleAttribution.openerStrategyKey,
  ctaStrategyKey: sampleAttribution.ctaStrategyKey,
  contextUtilizationPercentage: sampleAttribution.contextUtilizationPercentage,
  memoryUtilizationPercentage: sampleAttribution.memoryUtilizationPercentage,
  researchConfidence: sampleAttribution.researchConfidence,
}, null, 2))

assert.match(sampleAttribution.attributionId, /^opa-v1-[0-9a-f]{8}$/)
assert.ok(sampleAttribution.subjectStrategyKey.includes(":"))
assert.ok(sampleAttribution.ctaStrategyKey.includes(":"))

const dataAudit = buildOutreachPerformanceDataAudit()
assert.ok(dataAudit.availableMetrics.includes("outreach_performance_attributions"))
assert.ok(dataAudit.missingMetrics.length > 0)
assert.ok(dataAudit.attributionLimitations.length > 0)

console.log("\n=== Performance data audit (4.6A) ===")
console.log(`Available metrics: ${dataAudit.availableMetrics.length}`)
console.log(`Missing metrics: ${dataAudit.missingMetrics.length}`)
console.log(`Attribution limitations: ${dataAudit.attributionLimitations.length}`)

const executive = buildExecutiveSummary(scenarios, 14)
console.log("\n=== Executive summary ===")
console.log(JSON.stringify(executive, null, 2))
assert.equal(executive.attributedSendCount, scenarios.length)
assert.ok(executive.replyRate != null && executive.replyRate > 0)

const subjectAgg = aggregateSubjectPerformance(scenarios)
console.log("\n=== Subject performance aggregation (4.6C) ===")
printGroupRows("By category", subjectAgg.byCategory)
printGroupRows("Top performers", subjectAgg.topPerformers)
assert.ok(subjectAgg.byCategory.length >= 1)

const openerAgg = aggregateOpenerPerformance(scenarios)
console.log("\n=== Opener performance aggregation (4.6D) ===")
printGroupRows("By strategy", openerAgg.byStrategy)
assert.ok(openerAgg.byStrategy.length >= 1)

const ctaAgg = aggregateCtaPerformance(scenarios)
console.log("\n=== CTA performance aggregation (4.6E) ===")
printGroupRows("By category", ctaAgg.byCategory)
assert.ok(ctaAgg.byCategory.length >= 1)

const personalizationAgg = aggregatePersonalizationPerformance(scenarios)
console.log("\n=== Personalization utilization aggregation (4.6F) ===")
printGroupRows("Context utilization buckets", personalizationAgg.contextUtilizationBuckets)
printGroupRows("Memory utilization buckets", personalizationAgg.memoryUtilizationBuckets)
assert.ok(personalizationAgg.contextUtilizationBuckets.length >= 1)

const experimentReadiness = buildOutreachPerformanceExperimentReadiness()
assert.equal(experimentReadiness.qa_marker, GROWTH_OUTREACH_PERFORMANCE_QA_MARKER)
assert.ok(experimentReadiness.predefinedComparisons.length >= 4)

const comparison = experimentReadiness.predefinedComparisons[0]!
const { armA, armB } = filterAttributedSendsForComparison(scenarios, comparison)
console.log("\n=== Experiment readiness (4.6H) ===")
console.log(`Comparison: ${comparison.armALabel} vs ${comparison.armBLabel}`)
console.log(`Arm A rows: ${armA.length}, Arm B rows: ${armB.length}`)

const dashboardShape = {
  qa_marker: GROWTH_OUTREACH_PERFORMANCE_QA_MARKER,
  executiveSummary: executive,
  subjectIntelligence: subjectAgg,
  openerIntelligence: openerAgg,
  ctaIntelligence: ctaAgg,
  personalizationIntelligence: personalizationAgg,
  dataAudit: {
    availableMetrics: [...dataAudit.availableMetrics],
    missingMetrics: [...dataAudit.missingMetrics],
    attributionLimitations: [...dataAudit.attributionLimitations],
  },
}

console.log("\n=== Dashboard architecture sample ===")
console.log(`QA marker: ${dashboardShape.qa_marker}`)
console.log(`Subject top performer: ${subjectAgg.topPerformers[0]?.groupLabel ?? "n/a"}`)
console.log(`Opener top performer: ${openerAgg.topPerformers[0]?.groupLabel ?? "n/a"}`)
console.log(`CTA top performer: ${ctaAgg.topPerformers[0]?.groupLabel ?? "n/a"}`)

console.log("\n✓ Phase 4.6 validation passed — measurement-only, no generation changes.")
