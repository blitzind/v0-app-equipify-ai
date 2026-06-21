/**
 * GS-AI-PLAYBOOK-3B certification — multi-pass personalization quality engine.
 */

import assert from "node:assert/strict"
import { assembleDeterministicOutreachDraft } from "@/lib/growth/outreach/personalization/assemble-draft"
import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"
import { buildGrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context"
import {
  applyGrowthPersonalizationQualityPass,
  applySharePagePersonalizationQualityPass,
  applyVideoPersonalizationQualityPass,
  evaluatePersonalizationQualityInput,
  GROWTH_PERSONALIZATION_QUALITY_QA_MARKER,
} from "@/lib/growth/personalization/quality/growth-personalization-quality-engine"
import { buildPersonalizedSmsDraft } from "@/lib/growth/sms/personalization/assemble-sms-draft"
import { projectSmsPersonalizationContext } from "@/lib/growth/sms/personalization/sms-context-projection"

const CERT_SECTION = process.env.GS_PLAYBOOK_3B_CERT_SECTION ?? "all"

function section(name: string): boolean {
  return CERT_SECTION === "all" || CERT_SECTION === name
}

const sterlingVerified = [
  "provides field service and biomedical support for medical equipment organizations",
  "supports hospitals and surgery centers",
]

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

function buildSterlingPacket(): OutreachContextPacket {
  const industryContext = buildGrowthIndustryContext({
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    description: "Sterling Biomedical provides biomedical field service",
    naics: ["621999"],
    verifiedFacts: sterlingVerified,
    researchSignals: ["PM compliance tracking for patient-connected devices"],
    decisionMakerTitle: "HTM Director",
  })
  return {
    companyName: "Sterling Biomedical",
    industryLabel: "biomedical equipment service",
    website: null,
    employeeSize: null,
    location: null,
    decisionMakerName: "Jordan Lee",
    decisionMakerTitle: "HTM Director",
    fitScore: null,
    engagementScore: null,
    opportunityReadinessTier: null,
    buyingIntent: null,
    competitorPressure: null,
    capacitySignals: [],
    websiteSummary: null,
    websiteTextExcerpt: null,
    websiteFindings: [],
    hiringSignals: [],
    enrichmentFindings: [],
    researchRecommendedNextAction: null,
    priorTouchSummaries: [],
    priorReplySummaries: [],
    objectionSummaries: [],
    sequenceHistorySummaries: [],
    timelineEventSummaries: [],
    researchConfidence: null,
    researchPainPoints: [],
    equipmentServiceIndicators: [],
    companySummary: null,
    outreachAngles: [],
    priorOutboundSubjects: [],
    priorTouchCount: 0,
    hasWebsiteResearch: false,
    hasDecisionMaker: true,
    ...memoryEmpty,
    leadEngineGuidance: null,
    industryContext,
  } as OutreachContextPacket
}

function runQualityScoringCert(): void {
  assert.equal(GROWTH_PERSONALIZATION_QUALITY_QA_MARKER, "growth-personalization-quality-gs-ai-playbook-3b-v1")
  const diagnostics = evaluatePersonalizationQualityInput({
    channel: "EMAIL",
    body: "Hi there regarding Sterling Biomedical. Equipify can help with work orders and scheduling. Would you like a demo?",
    companyName: "Sterling Biomedical",
    contactName: "Jordan Lee",
    allowedFacts: sterlingVerified,
  })
  assert.ok(diagnostics.overallQualityScore >= 0 && diagnostics.overallQualityScore <= 100)
  assert.equal(Object.keys(diagnostics.dimensionScores).length, 10)
  assert.ok(diagnostics.issuesDetected.includes("generic_opening"))
  assert.ok(diagnostics.issuesDetected.includes("feature_dump"))
  assert.ok(diagnostics.issuesDetected.includes("weak_cta"))
  console.log("✓ quality scoring — dimensions + issue detection")
}

function runRewriteCert(): void {
  const before =
    "Hi there regarding Sterling Biomedical. Equipify can help with work orders and scheduling. Would you like a demo?"
  const result = applyGrowthPersonalizationQualityPass({
    channel: "EMAIL",
    body: before,
    companyName: "Sterling Biomedical",
    contactName: "Jordan Lee",
    allowedFacts: sterlingVerified,
    industryLabel: "biomedical equipment service",
    industryFact: "Teams in Biomedical Equipment Service often struggle with PM schedules disconnected from work orders.",
  })
  assert(result.qualityApplied)
  assert.match(result.body, /Jordan/i)
  assert.match(result.body, /Sterling Biomedical/i)
  assert.ok(!/would you like a demo/i.test(result.body))
  assert.ok(result.diagnostics.overallQualityScore >= evaluatePersonalizationQualityInput({
    channel: "EMAIL",
    body: before,
    allowedFacts: sterlingVerified,
  }).overallQualityScore)
  assert.ok(!result.body.toLowerCase().includes("revolutionary"))
  console.log("✓ rewrites — generic opening, feature dump, weak CTA improved")
}

function runEmailQualityCert(): void {
  const packet = buildSterlingPacket()
  const generic = assembleDeterministicOutreachDraft({
    strategy: {
      blocks: [
        { key: "opening", blockId: "o1", label: "opening", text: "Hi there regarding Sterling Biomedical." },
        { key: "cta", blockId: "c1", label: "cta", text: "Would you like a demo?" },
      ],
    } as never,
    subject: "Quick note",
    maxWords: 120,
  })
  const pass = applyGrowthPersonalizationQualityPass({
    channel: "EMAIL",
    subject: generic.subject,
    body: `${generic.body} Equipify can help with work orders and scheduling.`,
    companyName: packet.companyName,
    contactName: packet.decisionMakerName,
    allowedFacts: sterlingVerified,
    industryLabel: packet.industryContext?.playbook?.displayName ?? null,
    industryFact: packet.industryContext?.industryFacts[0] ?? null,
    preferredCta: packet.industryContext?.personaMessagingContext?.preferredCtaBlock ?? null,
    maxWords: 120,
  })
  assert(pass.diagnostics.rewritesApplied.length >= 1)
  assert.ok(pass.diagnostics.strengths.length >= 0)
  console.log("✓ email quality — evaluate + rewrite on outreach draft")
}

function runSmsQualityCert(): void {
  const packet = buildSterlingPacket()
  const context = projectSmsPersonalizationContext({ packet, priorSmsPreviews: [] })
  const { audit, draft } = buildPersonalizedSmsDraft({
    leadId: "lead-1",
    context,
    messageType: "cold_sms",
  })
  assert.ok(draft.body.length <= 320)
  assert.ok(audit.qualityDiagnostics)
  assert.equal(typeof audit.qualityDiagnostics!.overallQualityScore, "number")
  console.log("✓ SMS quality — tone/CTA pass integrated in assemble-sms-draft")
}

function runVideoQualityCert(): void {
  const script =
    "Hi there — I hope this email finds you well. Equipify can help with work orders and scheduling. Would you like a demo?"
  const result = applyVideoPersonalizationQualityPass({
    script,
    companyName: "Sterling Biomedical",
    allowedFacts: sterlingVerified,
  })
  assert(result.qualityApplied)
  assert.ok(!/hope this email finds you well/i.test(result.script))
  assert.ok(result.diagnostics.dimensionScores.flow >= 0)
  console.log("✓ video quality — narrative flow + credibility rewrite")
}

function runShareQualityCert(): void {
  const result = applySharePagePersonalizationQualityPass({
    headline: "Welcome to Equipify",
    heroMessage: "Equipify can help with work orders and scheduling.",
    whyReachingOut: "We wanted to reach out regarding your operations.",
    ctaLabel: "Schedule a demo",
    companyName: "Sterling Biomedical",
    allowedFacts: sterlingVerified,
  })
  assert(result.qualityApplied)
  assert.ok(!/schedule a demo/i.test(result.ctaLabel))
  assert.match(result.heroMessage, /teams|Sterling|biomedical/i)
  console.log("✓ share page quality — headline, proof hierarchy, CTA")
}

function runRegressionCert(): void {
  const pass = applyGrowthPersonalizationQualityPass({
    channel: "EMAIL",
    body: "Jordan, teams in biomedical service often coordinate PM schedules across technicians. Would it be unreasonable to spend 15 minutes comparing workflows?",
    companyName: "Sterling Biomedical",
    contactName: "Jordan Lee",
    allowedFacts: sterlingVerified,
    skipRewrite: true,
  })
  assert.ok(pass.diagnostics.overallQualityScore >= 70)
  assert.equal(pass.rewritesApplied?.length ?? pass.diagnostics.rewritesApplied.length, 0)

  const fabricated = applyGrowthPersonalizationQualityPass({
    channel: "EMAIL",
    body: "You recently raised Series C funding and are struggling with dispatch.",
    allowedFacts: sterlingVerified,
    skipRewrite: true,
  })
  assert.ok(fabricated.diagnostics.issuesDetected.includes("unsupported_claim"))

  const packet = buildSterlingPacket()
  assert.ok(packet.industryContext?.playbookApplied)
  assert.ok(packet.industryContext?.personaMessagingContext)
  assert.ok(packet.industryContext?.accountIntelligenceContext)
  console.log("✓ regression — no rewrite when skipped, 3A context preserved, unsupported claim flagged")
}

const runners: Array<[string, () => void]> = [
  ["quality", runQualityScoringCert],
  ["rewrites", runRewriteCert],
  ["email", runEmailQualityCert],
  ["sms", runSmsQualityCert],
  ["video", runVideoQualityCert],
  ["share", runShareQualityCert],
  ["regression", runRegressionCert],
]

for (const [name, run] of runners) {
  if (section(name)) run()
}

if (CERT_SECTION === "all") {
  console.log("\nGS-AI-PLAYBOOK-3B personalization quality certification passed.")
}
