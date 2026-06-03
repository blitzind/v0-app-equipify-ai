/**
 * Regression checks for Growth Engine outreach personalization (slice 6.15B).
 * Run: pnpm test:growth-outreach-personalization
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  OUTREACH_FAKE_URGENCY_PHRASES,
  OUTREACH_HYPE_PHRASES,
  OUTREACH_SPAM_PHRASES,
  validateOutreachRefinement,
} from "../lib/growth/outreach/personalization/ai-refinement-guard"
import { buildPersonalizedOutreachDraft } from "../lib/growth/outreach/personalization/assemble-draft"
import { detectOutreachIndustry } from "../lib/growth/outreach/personalization/industry-detection"
import { normalizeGrowthResearchConfidence } from "../lib/growth/research/research-confidence"
import { buildPersonalizationWarnings, computePersonalizationConfidence } from "../lib/growth/outreach/personalization/personalization-warnings"
import {
  OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
  OUTREACH_PERSONALIZATION_STRATEGY_VERSION,
  type OutreachContextPacket,
} from "../lib/growth/outreach/personalization/personalization-types"
import { extractPersonalizationSignals } from "../lib/growth/outreach/personalization/signal-extraction"
import { selectMessageStrategy } from "../lib/growth/outreach/personalization/message-strategy"
import { buildPersonalizationVariationKey, pickVariantIndex } from "../lib/growth/outreach/personalization/message-variability"

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
  websiteFindings: ["Manual dispatch and phone-only booking"],
  hiringSignals: ["Hiring service technicians"],
  enrichmentFindings: ["Field service operator"],
  priorTouchSummaries: [],
  priorReplySummaries: [],
  objectionSummaries: [],
  sequenceHistorySummaries: [],
  timelineEventSummaries: [],
  researchConfidence: 72,
  researchPainPoints: ["Manual dispatch process"],
  equipmentServiceIndicators: ["HVAC maintenance"],
  priorTouchCount: 0,
  hasWebsiteResearch: true,
  hasDecisionMaker: true,
}

const signals = extractPersonalizationSignals(basePacket)
assert.ok(signals.includes("dispatch_appears_manual"))
assert.ok(signals.includes("technician_hiring_signal"))
assert.ok(signals.includes("field_operations_signal"))

const hvacIndustry = detectOutreachIndustry(basePacket)
assert.equal(hvacIndustry, "hvac")

const strategy = selectMessageStrategy({
  leadId: "00000000-0000-4000-8000-000000000001",
  packet: basePacket,
  signals,
  generationType: "cold_email",
})
assert.equal(strategy.industry, "hvac")
assert.equal(strategy.angle, "dispatch_pain_capacity")
assert.equal(strategy.blocks.length, 5)

const draftA = buildPersonalizedOutreachDraft({
  leadId: "00000000-0000-4000-8000-000000000001",
  packet: basePacket,
  signals,
  generationType: "cold_email",
  maxWords: OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
})
const draftB = buildPersonalizedOutreachDraft({
  leadId: "00000000-0000-4000-8000-000000000002",
  packet: basePacket,
  signals,
  generationType: "cold_email",
  maxWords: OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
})
assert.notEqual(draftA.draft.body, draftB.draft.body)

const medicalPacket: OutreachContextPacket = {
  ...basePacket,
  companyName: "CareMed Equipment",
  industryLabel: "Medical equipment service",
  websiteFindings: ["Service visibility gaps across hospital accounts"],
  researchPainPoints: ["Manual process for service updates"],
  equipmentServiceIndicators: ["Medical equipment maintenance"],
}
const medicalSignals = extractPersonalizationSignals(medicalPacket)
const medicalStrategy = selectMessageStrategy({
  leadId: "00000000-0000-4000-8000-000000000003",
  packet: medicalPacket,
  signals: medicalSignals,
  generationType: "cold_email",
})
assert.equal(medicalStrategy.industry, "medical_equipment")
assert.equal(medicalStrategy.angle, "service_visibility_workflow")

const sparsePacket: OutreachContextPacket = {
  ...basePacket,
  websiteFindings: [],
  researchPainPoints: [],
  hiringSignals: [],
  equipmentServiceIndicators: [],
  hasWebsiteResearch: false,
  hasDecisionMaker: false,
  decisionMakerName: null,
  researchConfidence: 20,
}
const sparseSignals = extractPersonalizationSignals(sparsePacket)
const sparseConfidence = computePersonalizationConfidence({
  packet: sparsePacket,
  signals: sparseSignals,
  strategy: selectMessageStrategy({
    leadId: "00000000-0000-4000-8000-000000000004",
    packet: sparsePacket,
    signals: sparseSignals,
    generationType: "cold_email",
  }),
})
const sparseWarnings = buildPersonalizationWarnings({
  packet: sparsePacket,
  signals: sparseSignals,
  confidenceScore: sparseConfidence.score,
})
assert.ok(sparseConfidence.score < 50)
assert.ok(sparseWarnings.some((warning) => warning.code === "missing_website_signal"))
assert.ok(sparseWarnings.some((warning) => warning.code === "missing_decision_maker"))
assert.ok(sparseWarnings.some((warning) => warning.code === "low_confidence_context"))

const guardReject = validateOutreachRefinement({
  refinedBody: "Act now! I noticed your amazing website and our revolutionary platform guarantees results.",
  refinedSubject: "URGENT!!!",
  deterministicBody: draftA.draft.body,
  allowedFacts: [basePacket.companyName],
  maxWords: 120,
})
assert.equal(guardReject.ok, false)
assert.ok(guardReject.reasons.length > 0)

const guardAccept = validateOutreachRefinement({
  refinedBody: draftA.draft.body,
  refinedSubject: draftA.draft.subject,
  deterministicBody: draftA.draft.body,
  allowedFacts: [basePacket.companyName, ...basePacket.websiteFindings],
  maxWords: 120,
})
assert.equal(guardAccept.ok, true)

const variationKey = buildPersonalizationVariationKey({
  leadId: "00000000-0000-4000-8000-000000000001",
  generationType: "cold_email",
  strategyVersion: OUTREACH_PERSONALIZATION_STRATEGY_VERSION,
  angle: strategy.angle,
})
assert.ok(variationKey.includes(OUTREACH_PERSONALIZATION_STRATEGY_VERSION))
assert.ok(
  pickVariantIndex(`${variationKey}:opening:opening_context`, 3) >= 0 &&
    pickVariantIndex(`${variationKey}:cta:fifteen_minute`, 3) >= 0,
)

for (const phrase of OUTREACH_SPAM_PHRASES) {
  assert.ok(phrase.length > 0)
}
for (const phrase of OUTREACH_HYPE_PHRASES) {
  assert.ok(phrase.length > 0)
}
for (const phrase of OUTREACH_FAKE_URGENCY_PHRASES) {
  assert.ok(phrase.length > 0)
}

const runSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/run-ai-copilot-generation.ts"),
  "utf8",
)
assert.match(runSource, /runOutreachPersonalizationGeneration/)
assert.match(runSource, /outreachPersonalizationEnabled/)

const approveRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/copilot/generations/[generationId]/route.ts"),
  "utf8",
)
assert.match(approveRouteSource, /approveGrowthAiCopilotGeneration/)

const clientSafeFiles = [
  "lib/growth/outreach/personalization/personalization-types.ts",
  "lib/growth/outreach/personalization/signal-extraction.ts",
  "lib/growth/outreach/personalization/message-strategy.ts",
  "lib/growth/outreach/personalization/ai-refinement-guard.ts",
  "components/growth/growth-outreach-personalization-preview.tsx",
]
for (const relativePath of clientSafeFiles) {
  const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
  assert.ok(!source.includes("server-only"), `${relativePath} must remain client-safe`)
}

assert.equal(normalizeGrowthResearchConfidence(0.85), 85)
assert.equal(normalizeGrowthResearchConfidence(0.65), 65)
assert.equal(normalizeGrowthResearchConfidence(72), 72)
assert.equal(normalizeGrowthResearchConfidence(null), null)

const leadResearchPacket: OutreachContextPacket = {
  ...basePacket,
  researchConfidence: normalizeGrowthResearchConfidence(0.85),
}
const leadResearchStrategy = selectMessageStrategy({
  packet: leadResearchPacket,
  signals: extractPersonalizationSignals(leadResearchPacket),
  generationType: "cold_email",
})
const leadResearchConfidence = computePersonalizationConfidence({
  packet: leadResearchPacket,
  signals: extractPersonalizationSignals(leadResearchPacket),
  strategy: leadResearchStrategy,
})
assert.ok(leadResearchConfidence.score >= 55, "0–1 lead research confidence should contribute after normalization")

const contextBuilderSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/outreach/personalization/context-packet-builder.ts"),
  "utf8",
)
assert.match(contextBuilderSource, /normalizeGrowthResearchConfidence/)

console.log("growth outreach personalization tests passed")
