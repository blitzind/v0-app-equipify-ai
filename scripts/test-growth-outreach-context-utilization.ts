/**
 * Phase 4.4 — context packet completeness and utilization validation.
 * Run: pnpm test:growth-outreach-context-utilization
 */
import assert from "node:assert/strict"
import { buildAllowedFactsFromContextPacket } from "../lib/growth/outreach/personalization/allowed-facts-from-context-packet"
import { listAvailableContextSources } from "../lib/growth/outreach/personalization/context-utilization"
import { bridgeLeadEngineOutreachGuidance } from "../lib/growth/outreach/personalization/lead-engine-guidance-bridge"
import { buildPersonalizedOutreachDraft } from "../lib/growth/outreach/personalization/assemble-draft"
import { buildPersonalizationEvidenceFromContext } from "../lib/growth/personalization/personalization-evidence-engine"
import {
  OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
  type OutreachContextPacket,
  type OutreachLeadEngineGuidance,
} from "../lib/growth/outreach/personalization/personalization-types"
import type { GrowthLeadEngineOutreachPersonalizationOutput } from "../lib/growth/lead-engine/outreach-personalization-types"
import { extractPersonalizationSignals } from "../lib/growth/outreach/personalization/signal-extraction"

const LEAD_ID = "00000000-0000-4000-8000-00000000d4"

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
}

const phase44Empty = {
  websiteSummary: null as string | null,
  websiteTextExcerpt: null as string | null,
  researchRecommendedNextAction: null as string | null,
  leadEngineGuidance: null as OutreachLeadEngineGuidance | null,
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
  companySummary: "Summit HVAC Services provides commercial HVAC maintenance across Colorado.",
  outreachAngles: ["Growing commercial HVAC footprint across Denver metro"],
  priorOutboundSubjects: [],
  priorTouchCount: 0,
  hasWebsiteResearch: true,
  hasDecisionMaker: true,
  ...memoryEmpty,
  ...phase44Empty,
}

function ctaText(strategy: { blocks: { key: string; text: string }[] }) {
  return strategy.blocks.find((block) => block.key === "cta")?.text ?? ""
}

function openerText(strategy: { blocks: { key: string; text: string }[] }) {
  return strategy.blocks.find((block) => block.key === "opening")?.text ?? ""
}

function sample(label: string, packet: OutreachContextPacket) {
  const signals = extractPersonalizationSignals(packet)
  const available = listAvailableContextSources(packet)
  const allowedFacts = buildAllowedFactsFromContextPacket(packet)
  const { strategy, draft, contextQuality } = buildPersonalizedOutreachDraft({
    leadId: LEAD_ID,
    packet,
    signals,
    generationType: "cold_email",
    maxWords: OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
  })

  console.log(`\n=== ${label} ===`)
  console.log(`Context available (${available.length}): ${available.join(", ")}`)
  console.log(`Context used (${contextQuality.contextSourcesUsed.length}): ${contextQuality.contextSourcesUsed.join(", ")}`)
  console.log(`Utilization: ${contextQuality.utilizationPercentage}%`)
  console.log(`Allowed facts count: ${allowedFacts.length}`)
  console.log(`Subject: ${draft.subject}`)
  console.log(`Opener: ${openerText(strategy)}`)
  console.log(`CTA: ${ctaText(strategy)}`)
  console.log(`Research opener source: ${strategy.researchOpener?.source ?? "none"}`)

  return { strategy, draft, contextQuality, allowedFacts, available }
}

const highResearch = sample("High confidence research lead", {
  ...basePacket,
  websiteSummary: "Summit HVAC runs 24/7 emergency dispatch with phone-only booking across Denver metro.",
  websiteTextExcerpt: "Emergency HVAC repair — call to schedule service.",
  researchRecommendedNextAction: "Lead with dispatch workflow pain",
  timelineEventSummaries: ["Research completed — manual dispatch noted"],
  sequenceHistorySummaries: ["Sequence step 1: Summit HVAC intro"],
})
assert.ok(highResearch.contextQuality.utilizationPercentage >= 40)
assert.ok(highResearch.allowedFacts.some((fact) => fact.includes("24/7")))
assert.equal(highResearch.strategy.researchOpener?.source, "website_summary")

const mediumResearch = sample("Medium confidence research lead", {
  ...basePacket,
  companyName: "FrontRange Mechanical",
  researchConfidence: 52,
  websiteSummary: null,
  websiteFindings: [],
  outreachAngles: [],
  companySummary: null,
  researchPainPoints: ["Dispatch still runs on spreadsheets and phone calls"],
  fitScore: 58,
  engagementScore: 30,
})
assert.ok(mediumResearch.strategy.researchOpener?.source === "research_pain_point" || mediumResearch.strategy.researchOpener)

const memoryRich = sample("Memory-rich lead", {
  ...basePacket,
  companyName: "Alpine Service Group",
  memoryAvailable: true,
  memoryCoverageScore: 72,
  relationshipStage: "evaluating",
  relationshipSummary: "Ops lead asked for a lighter follow-up after reviewing dispatch notes.",
  memoryInteractionSummaries: ["Discussed manual dispatch board in prior email thread"],
  memoryCommitmentSummaries: ["Promised to send a one-page workflow comparison"],
  memoryPreferenceSummaries: ["Prefers concise emails without meeting asks early"],
  priorReplySummaries: ["Asked for more detail on technician routing (interested)"],
  priorTouchSummaries: ["Prior outreach on dispatch workflow"],
  priorTouchCount: 2,
  engagementScore: 62,
})
assert.ok(memoryRich.contextQuality.contextSourcesUsed.includes("memory"))

const outreachAnglesLead = sample("Lead with outreachAngles", {
  ...basePacket,
  companyName: "Peak Mechanical",
  websiteSummary: null,
  websiteFindings: [],
  outreachAngles: [
    "Position Equipify around technician utilization for a growing commercial HVAC fleet",
  ],
  researchPainPoints: [],
  researchConfidence: 68,
})
assert.equal(outreachAnglesLead.strategy.researchOpener?.source, "outreach_angle")

const hiringSignalsLead = sample("Lead with hiring signals", {
  ...basePacket,
  companyName: "BlueSky HVAC",
  websiteSummary: "BlueSky HVAC is hiring field service technicians across three Colorado locations.",
  websiteFindings: [],
  hiringSignals: ["Hiring field service technicians across Colorado"],
  outreachAngles: [],
  companySummary: null,
  researchConfidence: 70,
})
assert.ok(hiringSignalsLead.strategy.sourceSignals.includes("technician_hiring_signal"))

const leadEngineOutput: GrowthLeadEngineOutreachPersonalizationOutput = {
  personalization_summary: "Commercial HVAC operator with dispatch friction and hiring pressure.",
  contact_context: "Ops manager owns dispatch workflow decisions.",
  company_context: "Multi-site HVAC service company in Colorado.",
  recommended_talking_points: [
    {
      claim: "Technician routing still appears manual across dispatch",
      evidence: "Website careers page lists dispatcher and field tech openings",
      source: "website",
      confidence: 0.82,
    },
  ],
  recommended_problem_alignment: [
    {
      claim: "Dispatch board workflow is the highest-fit pain point",
      evidence: "Research notes phone-only booking and manual dispatch",
      source: "research",
      confidence: 0.78,
    },
  ],
  recommended_business_outcomes: ["Reduce dispatch coordination time"],
  recommended_social_proof_types: ["SIMILAR_COMPANY_SIZE"],
  recommended_case_study_types: ["DISPATCH_OPTIMIZATION"],
  recommended_objection_categories: [],
  recommended_cta_strategy: "PAIN_VALIDATION",
  urgency_signals: [
    {
      claim: "Active technician hiring suggests capacity strain",
      evidence: "Three open field tech roles posted this month",
      source: "website",
      confidence: 0.71,
    },
  ],
  timing_signals: [],
  recommended_channel_priority: ["EMAIL"],
  recommended_sequence_priority: "COMPANY_CONTEXT_FIRST",
  personalization_confidence: 0.76,
  personalization_completeness: 0.8,
  human_review_required: false,
  evidence_summary: "Website + research aligned on dispatch pain.",
  source_attribution: [],
}

const leadEngineGuidance = bridgeLeadEngineOutreachGuidance(leadEngineOutput)
assert.ok(leadEngineGuidance)

const leadEngineLead = sample("Lead Engine guidance lead", {
  ...basePacket,
  companyName: "Horizon Mechanical",
  websiteSummary: null,
  websiteFindings: [],
  outreachAngles: [],
  researchPainPoints: [],
  researchConfidence: 40,
  leadEngineGuidance,
})
assert.ok(leadEngineLead.allowedFacts.some((fact) => fact.includes("PAIN_VALIDATION")))
assert.ok(
  leadEngineLead.strategy.researchOpener?.source === "lead_engine_angle" ||
    leadEngineLead.strategy.researchOpener?.source === "lead_engine_pain" ||
    leadEngineLead.strategy.ctaIntelligence?.evidenceSource === "lead_engine_guidance",
)

const dashboardEvidence = buildPersonalizationEvidenceFromContext({
  leadLabel: "Summit HVAC Services",
  companyName: "Summit HVAC Services",
  industryLabel: "HVAC contractor",
  relationshipStage: null,
  relationshipSummary: null,
  topObjections: [],
  topPreferences: [],
  opportunitySignals: [],
  bookingSignals: [],
  engagementTier: "warm",
  territoryLabel: "Denver, CO",
  websiteSignals: ["Summit HVAC runs 24/7 emergency dispatch with phone-only booking across Denver metro."],
  committeeContext: [],
  buyingSignals: ["Manual dispatch process"],
  companySignals: ["25-50 employees"],
  inboxHistory: [],
  sequenceHistory: [],
  templateOverlay: null,
  sourcesUsed: ["website_intelligence", "company_signals"],
  companySummary: basePacket.companySummary,
  outreachAngles: basePacket.outreachAngles,
  researchPainPoints: basePacket.researchPainPoints,
  hiringSignals: basePacket.hiringSignals,
  researchConfidence: 72,
})
assert.ok(dashboardEvidence.some((entry) => entry.claimKey === "outreach_angle"))
assert.ok(dashboardEvidence.some((entry) => entry.claimKey === "company_summary"))

console.log("\nPhase 4.4 context utilization validation passed")
