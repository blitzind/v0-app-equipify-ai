/**
 * Phase 4.2 — research-backed opener validation samples.
 * Run: pnpm test:growth-outreach-research-opener
 */
import assert from "node:assert/strict"
import { buildPersonalizedOutreachDraft } from "../lib/growth/outreach/personalization/assemble-draft"
import {
  OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
  type OutreachContextPacket,
} from "../lib/growth/outreach/personalization/personalization-types"
import { extractPersonalizationSignals } from "../lib/growth/outreach/personalization/signal-extraction"
import { selectMessageStrategy } from "../lib/growth/outreach/personalization/message-strategy"
import { buildGenericOpeningText } from "../lib/growth/outreach/personalization/research-backed-opener"

const LEAD_ID = "00000000-0000-4000-8000-000000000099"

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

function sample(label: string, packet: OutreachContextPacket) {
  const signals = extractPersonalizationSignals(packet)
  const strategy = selectMessageStrategy({
    leadId: LEAD_ID,
    packet,
    signals,
    generationType: "cold_email",
  })
  const draft = buildPersonalizedOutreachDraft({
    leadId: LEAD_ID,
    packet,
    signals,
    generationType: "cold_email",
    maxWords: OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
  })

  const genericOpening = buildGenericOpeningText({
    openingBlockId: strategy.blocks[0]?.blockId === "opening_research_backed" ? "opening_context" : (strategy.blocks[0]?.blockId ?? "opening_direct"),
    variationSeed: strategy.variationKey,
    tokens: { companyName: packet.companyName, contactName: packet.decisionMakerName },
  })

  const newOpening = strategy.blocks.find((block) => block.key === "opening")?.text ?? ""

  console.log(`\n=== ${label} ===`)
  console.log(`Research confidence: ${packet.researchConfidence ?? "none"}`)
  console.log(`Existing opener: ${genericOpening}`)
  console.log(`New opener: ${newOpening}`)
  if (strategy.researchOpener) {
    console.log(`Evidence source: ${strategy.researchOpener.source}`)
    console.log(`Evidence used: ${strategy.researchOpener.evidence}`)
    console.log(`Confidence tier: ${strategy.researchOpener.confidenceTier}`)
  } else {
    console.log("Evidence source: generic fallback (insufficient research)")
  }
  console.log(`Full body preview: ${draft.draft.body.slice(0, 220)}…`)

  return { strategy, draft }
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
  companySummary: "Summit HVAC Services provides commercial HVAC maintenance and emergency repair across Colorado.",
  outreachAngles: ["Lead with dispatch workflow efficiency for a growing commercial HVAC fleet"],
  priorOutboundSubjects: [],
  priorTouchCount: 0,
  hasWebsiteResearch: true,
  hasDecisionMaker: true,
  ...memoryDefaults,
}

const mediumPacket: OutreachContextPacket = {
  ...highPacket,
  companyName: "FrontRange Mechanical",
  decisionMakerName: "Alex Morgan",
  researchConfidence: 52,
  websiteFindings: [],
  outreachAngles: [],
  companySummary: null,
  researchPainPoints: ["Dispatch still runs on spreadsheets and phone calls"],
}

const lowPacket: OutreachContextPacket = {
  ...highPacket,
  companyName: "Generic Field Co",
  decisionMakerName: null,
  researchConfidence: 28,
  websiteFindings: [],
  outreachAngles: [],
  companySummary: null,
  researchPainPoints: [],
  hiringSignals: [],
  equipmentServiceIndicators: [],
  hasWebsiteResearch: false,
}

const high = sample("High research confidence lead", highPacket)
const medium = sample("Medium research confidence lead", mediumPacket)
const low = sample("Low research confidence lead", lowPacket)

assert.equal(high.strategy.researchOpener?.source, "website_finding")
assert.equal(high.strategy.blocks[0]?.blockId, "opening_research_backed")
assert.ok(high.strategy.blocks[0]?.text.includes("Denver metro"))

assert.equal(medium.strategy.researchOpener?.source, "research_pain_point")
assert.equal(medium.strategy.researchOpener?.confidenceTier, "medium")

assert.equal(low.strategy.researchOpener, undefined)
assert.notEqual(low.strategy.blocks[0]?.blockId, "opening_research_backed")

console.log("\ngrowth-outreach-research-opener: all checks passed")
