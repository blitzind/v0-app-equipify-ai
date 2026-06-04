/**
 * Phase 4.1 — subject line intelligence validation samples.
 * Run: pnpm test:growth-outreach-subject-intelligence
 */
import assert from "node:assert/strict"
import { buildPersonalizedOutreachDraft } from "../lib/growth/outreach/personalization/assemble-draft"
import { buildLegacyDeterministicSubject } from "../lib/growth/outreach/personalization/subject-intelligence"
import {
  OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
  type OutreachContextPacket,
} from "../lib/growth/outreach/personalization/personalization-types"
import { extractPersonalizationSignals } from "../lib/growth/outreach/personalization/signal-extraction"
import { selectMessageStrategy } from "../lib/growth/outreach/personalization/message-strategy"
import { isGenericSubjectPattern } from "../lib/growth/outreach/personalization/subject-intelligence"

const LEAD_ID = "00000000-0000-4000-8000-00000000a1"

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
}

const phase44Defaults = {
  websiteSummary: null as string | null,
  websiteTextExcerpt: null as string | null,
  researchRecommendedNextAction: null as string | null,
  leadEngineGuidance: null,
}

function sample(label: string, packet: OutreachContextPacket, generationType: OutreachContextPacket extends never ? never : "cold_email" | "follow_up_email" = "cold_email") {
  const signals = extractPersonalizationSignals(packet)
  const strategy = selectMessageStrategy({
    leadId: LEAD_ID,
    packet,
    signals,
    generationType,
  })
  const { draft, strategy: enrichedStrategy } = buildPersonalizedOutreachDraft({
    leadId: LEAD_ID,
    packet,
    signals,
    generationType,
    maxWords: OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
  })
  const legacySubject = buildLegacyDeterministicSubject({ packet, strategy })
  const intel = enrichedStrategy.subjectIntelligence

  console.log(`\n=== ${label} ===`)
  console.log(`Existing subject: ${legacySubject}`)
  console.log(`New subject: ${draft.subject}`)
  console.log(`Quality score: ${intel?.qualityScore.overall ?? "n/a"}/100`)
  console.log(`Category: ${intel?.category ?? "n/a"}`)
  console.log(`Evidence source: ${intel?.evidenceSource ?? "n/a"}`)
  console.log(`Evidence: ${intel?.evidence ?? "none"}`)
  console.log(`Generic pattern flagged: ${intel?.qualityScore.isGenericPattern ?? isGenericSubjectPattern(legacySubject)}`)

  return { draft, strategy: enrichedStrategy, legacySubject }
}

const highPacket: OutreachContextPacket = {
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
  outreachAngles: ["Lead with dispatch workflow efficiency for a growing commercial HVAC fleet"],
  priorOutboundSubjects: ["Summit HVAC Services — quick ops note"],
  priorTouchCount: 1,
  hasWebsiteResearch: true,
  hasDecisionMaker: true,
  ...memoryDefaults,
  ...phase44Defaults,
}

const mediumPacket: OutreachContextPacket = {
  ...highPacket,
  companyName: "FrontRange Mechanical",
  researchConfidence: 52,
  websiteFindings: [],
  outreachAngles: [],
  companySummary: null,
  researchPainPoints: ["Dispatch still runs on spreadsheets and phone calls"],
  priorOutboundSubjects: [],
  priorTouchCount: 0,
}

const lowPacket: OutreachContextPacket = {
  ...highPacket,
  companyName: "Generic Field Co",
  researchConfidence: 28,
  websiteFindings: [],
  outreachAngles: [],
  companySummary: null,
  researchPainPoints: [],
  hiringSignals: [],
  equipmentServiceIndicators: [],
  hasWebsiteResearch: false,
  priorOutboundSubjects: [],
  priorTouchCount: 0,
}

const existingCustomerPacket: OutreachContextPacket = {
  ...highPacket,
  companyName: "Summit HVAC Services",
  memoryAvailable: true,
  memoryCoverageScore: 72,
  relationshipStage: "evaluating",
  relationshipSummary: "Evaluating dispatch workflow options after initial demo interest.",
  memoryInteractionSummaries: ["Asked for pricing breakdown after demo"],
  priorOutboundSubjects: ["Summit HVAC Services dispatch workflow"],
  priorTouchCount: 2,
}

const followUpPacket: OutreachContextPacket = {
  ...highPacket,
  companyName: "Summit HVAC Services",
  priorOutboundSubjects: [
    "Dispatch question for Summit HVAC Services",
    "Summit HVAC Services — quick ops note",
  ],
  priorTouchSummaries: ["Prior outreach on dispatch workflow"],
  sequenceHistorySummaries: ["Sequence step 2: Dispatch question for Summit HVAC Services"],
  priorTouchCount: 2,
}

const memoryRichPacket: OutreachContextPacket = {
  ...highPacket,
  memoryAvailable: true,
  memoryCoverageScore: 81,
  relationshipStage: "engaged",
  memoryCommitmentSummaries: ["Send revised dispatch workflow proposal by Friday"],
  memoryInteractionSummaries: ["Requested async email follow-up instead of live demo"],
  objectionSummaries: ["Budget timing concern for Q3"],
  priorOutboundSubjects: ["Following up on dispatch workflow"],
  priorTouchCount: 3,
}

const high = sample("High confidence research lead", highPacket)
const medium = sample("Medium confidence research lead", mediumPacket)
const low = sample("Low confidence lead", lowPacket)
const existing = sample("Existing customer (evaluating)", existingCustomerPacket)
const followUp = sample("Follow-up sequence", followUpPacket, "follow_up_email")
const memoryRich = sample("Memory-rich lead", memoryRichPacket, "follow_up_email")

assert.ok(high.strategy.subjectIntelligence)
assert.ok(high.strategy.subjectIntelligence!.qualityScore.overall >= 60)
assert.ok(!isGenericSubjectPattern(high.draft.subject))
assert.notEqual(high.draft.subject, high.legacySubject)
assert.equal(high.strategy.subjectIntelligence!.category, "research_observation")

assert.equal(medium.strategy.subjectIntelligence?.category, "pain_point")
assert.ok((medium.strategy.subjectIntelligence?.qualityScore.overall ?? 0) >= 55)

assert.equal(low.strategy.subjectIntelligence?.category, "curiosity")
assert.ok(!isGenericSubjectPattern(low.draft.subject))

assert.equal(existing.strategy.subjectIntelligence?.category, "memory_aware")

assert.equal(followUp.strategy.subjectIntelligence?.category, "follow_up")
assert.ok(!isGenericSubjectPattern(followUp.draft.subject) || followUp.draft.subject.includes("follow"))

assert.equal(memoryRich.strategy.subjectIntelligence?.category, "memory_aware")
assert.equal(memoryRich.strategy.subjectIntelligence?.evidenceSource, "memory_commitment")

console.log("\ngrowth-outreach-subject-intelligence: all checks passed")
