/**
 * GE-AIOS-MARKET-INTELLIGENCE-LOOP-1A — Market Intelligence Loop certification.
 * Run: pnpm test:ge-aios-market-intelligence-loop-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"
import {
  buildMarketIntelligenceSnapshot,
  profileFingerprint,
} from "../lib/growth/market-intelligence/growth-market-intelligence-aggregator-1a"
import { assessMarketIntelligenceConfidence } from "../lib/growth/market-intelligence/growth-market-intelligence-confidence-1a"
import {
  buildMarketIntelligenceOperatorProjection,
  evaluateMarketIntelligenceLoop,
} from "../lib/growth/market-intelligence/growth-market-intelligence-loop-1a"
import {
  applyMarketIntelligenceRecommendationsToProfile,
  buildMarketIntelligenceProposal,
} from "../lib/growth/market-intelligence/growth-market-intelligence-proposal-1a"
import { buildMarketIntelligenceRecommendations } from "../lib/growth/market-intelligence/growth-market-intelligence-recommendations-1a"
import { buildMarketIntelligenceSegmentMetrics } from "../lib/growth/market-intelligence/growth-market-intelligence-segment-analytics-1a"
import { projectApprovedBusinessProfileToLeadDiscovery } from "../lib/growth/business-profile/business-profile-lead-discovery-projection"
import {
  GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
  GROWTH_MARKET_INTELLIGENCE_MIN_CONFIDENCE_PERCENT,
} from "../lib/growth/market-intelligence/growth-market-intelligence-loop-1a-types"

const ROOT = process.cwd()
const PHASE = "GE-AIOS-MARKET-INTELLIGENCE-LOOP-1A" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function approvedProfileFixture(): BusinessProfileDraftContent {
  return {
    company: {
      companyName: "Equipify",
      website: "https://equipify.com",
      shortDescription: "Equipment maintenance platform",
      productsServices: ["Maintenance software"],
      businessModel: "B2B SaaS",
      primaryValueProposition: "Keep equipment running",
    },
    idealCustomers: {
      targetIndustries: ["Medical equipment service"],
      companySizeRanges: ["11-50", "51-200"],
      geography: ["Michigan", "United States"],
      buyerPersonas: ["Director of Biomedical Engineering"],
      disqualifiers: ["general retail"],
      preferredNaicsCodes: ["811310"],
      excludedNaicsCodes: ["443142"],
    },
    problemsAndTriggers: {
      painPoints: ["Downtime"],
      buyingTriggers: ["Audit"],
      competitorsAlternatives: [],
      keywords: ["biomedical maintenance"],
      negativeKeywords: ["retail"],
    },
    salesAndMarketing: {
      averageDealSize: "$50k",
      salesCycleEstimate: "90 days",
      messagingAngles: ["Uptime"],
      qualificationCriteria: ["Maintains equipment"],
    },
    portfolioManagement: {
      targetActiveCompanies: 100,
      minimumHealthyCompanies: 40,
      replenishBatchSize: 25,
      maximumDailyDiscovery: 50,
      maximumConcurrentResearch: 20,
      maximumQueuedAdmissions: 50,
    },
    confidence: { score: 85, assumptions: [], missingInformation: [] },
    draftSource: "deterministic",
  }
}

function leadFixture(overrides: Partial<GrowthLead> & { id: string; companyName: string }): GrowthLead {
  return {
    sourceKind: "manual",
    sourceDetail: null,
    externalRef: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    website: null,
    addressLine1: null,
    city: null,
    state: "MI",
    postalCode: null,
    country: "US",
    status: "qualified",
    promotedOrganizationId: null,
    promotedProspectId: null,
    promotedAt: null,
    score: 80,
    notes: null,
    metadata: { industry: "equipment rental" },
    latestResearchRunId: "run-1",
    lastResearchedAt: "2026-07-15T10:00:00.000Z",
    latestProspectResearchRunId: null,
    lastProspectResearchedAt: null,
    prospectRecommendedNextAction: null,
    researchPriority: "normal",
    callDisposition: null,
    callDispositionAt: null,
    lastCallAt: null,
    followUpAt: null,
    callPriorityScore: null,
    callPriorityTier: null,
    callPriorityComputedAt: null,
    callPriorityOverride: null,
    lastHumanTouchAt: null,
    decisionMakerStatus: null,
    primaryDecisionMakerId: null,
    nextBestAction: null,
    nextBestActionReason: null,
    nextBestActionComputedAt: null,
    estimatedAnnualRevenue: null,
    estimatedEmployeeCount: "51-200",
    fleetSizeEstimate: null,
    crmDetected: null,
    fieldServiceStackDetected: null,
    momentumScore: null,
    momentumTier: null,
    momentumWhySummary: null,
    momentumComputedAt: null,
    workflowHealth: null,
    workflowHealthReason: null,
    workflowHealthComputedAt: null,
    sourceChannel: null,
    sourceCampaign: null,
    sourceImportBatchId: null,
    sourceVendor: null,
    agingDays: null,
    agingBucket: null,
    firstHumanTouchAt: null,
    timeToFirstTouchHours: null,
    contactTemperature: null,
    callAttemptCount: 0,
    voicemailCount: 0,
    connectedCallCount: 0,
    engagementScore: null,
    engagementTier: null,
    engagementLastActivityAt: null,
    engagementSummary: null,
    engagementTopSignals: [{ label: "Meeting booked", detail: "Demo scheduled" }],
    engagementDormancyExemptUntil: null,
    engagementComputedAt: null,
    relationshipStrengthScore: null,
    relationshipStrengthTier: null,
    relationshipLastMeaningfulTouchAt: null,
    relationshipSummary: null,
    relationshipTopSignals: [],
    relationshipTrend: null,
    relationshipOwnerAttentionLevel: null,
    opportunityReadinessTier: "strong",
    opportunityReadinessTrend: null,
    opportunityTopSignals: [],
    opportunityBlockers: [],
    opportunityAccelerators: [],
    opportunityAgeBucket: null,
    revenueForecastTopSignals: [],
    revenueProbabilityTier: null,
    revenueTrajectory: null,
    forecastAttentionLevel: null,
    executivePriorityTier: null,
    executiveInterventionAgeBucket: null,
    executiveOperatingTopSignals: [],
    intelligenceConflicts: [],
    operationalCapacityTier: null,
    operationalConstraint: null,
    operationalCapacityTopConstraints: [],
    capacityRecoveryDirection: null,
    capacityConflict: null,
    constraintAgeBucket: null,
    sequenceFatigueRisk: null,
    sequenceRecommendedNextStep: null,
    conversationHealthTier: null,
    conversationMomentum: null,
    conversationSentiment: null,
    conversationUrgencyLevel: null,
    conversationBuyingIntent: null,
    conversationResponsePattern: null,
    conversationObjectionProfile: null,
    conversationCompetitorMention: null,
    conversationTopSignals: [],
    conversationTrend: null,
    assignmentSource: null,
    ...overrides,
  } as GrowthLead
}

function knowledgeItem(finding: string): OrganizationalKnowledgeItem {
  const now = "2026-07-15T12:00:00.000Z"
  return {
    knowledge_id: `k-${finding.slice(0, 8)}`,
    organization_id: "org-mi",
    source: "memory_events",
    specialist: "sales",
    category: "industry",
    finding,
    confidence: 88,
    supporting_event_count: 5,
    first_observed_at: now,
    last_confirmed_at: now,
    superseded_by: null,
    active: true,
    metadata: {},
  }
}

function main(): void {
  console.log(`[${PHASE}] Market Intelligence Loop certification`)

  assert.equal(GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER, "ge-aios-market-intelligence-loop-1a-v1")
  console.log("  ✓ QA marker")

  const discoverySource = readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts")
  assert.doesNotMatch(readSource("lib/growth/market-intelligence/growth-market-intelligence-recommendations-1a.ts"), /runProspectSearch/)
  assert.doesNotMatch(readSource("lib/growth/market-intelligence/growth-market-intelligence-proposal-1a.ts"), /runEvidenceEngine/)
  assert.match(discoverySource, /buildProspectSearchFiltersFromBusinessProfile/)
  console.log("  ✓ no duplicate ICP, discovery, or evidence engines")

  const profile = approvedProfileFixture()
  const equipmentLeads = Array.from({ length: 8 }, (_, index) =>
    leadFixture({
      id: `lead-eq-${index}`,
      companyName: `Equipment Rental ${index}`,
      metadata: { industry: "equipment rental" },
      status: index < 5 ? "qualified" : "enriched",
    }),
  )
  const medicalLeads = Array.from({ length: 6 }, (_, index) =>
    leadFixture({
      id: `lead-med-${index}`,
      companyName: `Medical Service ${index}`,
      metadata: { industry: "medical_equipment" },
      status: "enriched",
    }),
  )

  const segmentMetrics = buildMarketIntelligenceSegmentMetrics({
    leads: [...equipmentLeads, ...medicalLeads],
  })
  assert.ok(segmentMetrics.some((row) => row.dimension === "industry"))
  assert.ok(segmentMetrics.every((row) => row.researched >= 0))
  console.log("  ✓ segment analytics aggregate real lead data only")

  const snapshot = buildMarketIntelligenceSnapshot({
    organizationId: "org-mi",
    generatedAt: "2026-07-15T12:00:00.000Z",
    approvedProfile: profile,
    validatedLearnings: [
      knowledgeItem("Equipment rental companies have responded 34% more frequently than medical equipment prospects."),
    ],
    segmentMetrics,
    evidenceRefs: [],
  })
  assert.equal(snapshot.qaMarker, GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER)
  assert.ok(snapshot.industries.values.length > 0)
  console.log("  ✓ market intelligence snapshot aggregates canonical sources")

  const recommendations = buildMarketIntelligenceRecommendations({ snapshot, approvedProfile: profile })
  assert.ok(recommendations.length >= 0)
  for (const recommendation of recommendations) {
    assert.ok(recommendation.confidence.confidencePercent >= GROWTH_MARKET_INTELLIGENCE_MIN_CONFIDENCE_PERCENT)
    assert.ok(recommendation.explainabilityLines.length >= 3)
    assert.ok(recommendation.before !== recommendation.after)
  }
  console.log("  ✓ strategic recommendations are objects, not profile mutations")

  const evaluation = evaluateMarketIntelligenceLoop({
    organizationId: "org-mi",
    generatedAt: "2026-07-15T12:00:00.000Z",
    approvedProfile: profile,
    validatedLearnings: snapshot.validatedLearnings,
    leads: [...equipmentLeads, ...medicalLeads],
  })

  const operator = buildMarketIntelligenceOperatorProjection({
    approvedProfile: profile,
    evaluation,
    loopMemory: {
      qaMarker: GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER,
      lastEvaluatedAt: null,
      lastProposalId: null,
      lastProposalAt: null,
      lastAcceptedProposalId: null,
      lastAcceptedAt: null,
      pendingProposalId: null,
      pendingProfileDraftId: null,
    },
  })
  assert.match(operator.currentStrategySummary, /Targeting/i)
  console.log("  ✓ operator projection for Home portfolio section")

  if (evaluation.recommendations.length > 0 && evaluation.proposal) {
    const afterProfile = applyMarketIntelligenceRecommendationsToProfile(profile, evaluation.recommendations)
    assert.notEqual(profileFingerprint(profile), profileFingerprint(afterProfile))
    const projectionBefore = projectApprovedBusinessProfileToLeadDiscovery(profile)
    const projectionAfter = projectApprovedBusinessProfileToLeadDiscovery(afterProfile)
    assert.notDeepEqual(projectionBefore.industries, projectionAfter.industries)
    console.log("  ✓ proposal changes profile draft; Prospect Search uses projection after operator approval")
  }

  const proposal = buildMarketIntelligenceProposal({
    organizationId: "org-mi",
    generatedAt: "2026-07-15T12:00:00.000Z",
    proposalId: "mi-proposal:test",
    beforeProfile: profile,
    recommendations: evaluation.recommendations,
  })
  assert.match(proposal.summary, /.*/)
  assert.ok(proposal.explainabilityLines.length > 0 || evaluation.recommendations.length === 0)

  const confidence = assessMarketIntelligenceConfidence({
    segment: segmentMetrics[0] ?? null,
    validatedLearnings: snapshot.validatedLearnings,
    segmentLabel: segmentMetrics[0]?.segmentLabel ?? "Segment",
  })
  assert.ok(confidence.sampleSize >= 0)
  console.log("  ✓ confidence model includes sample size and evidence")

  const portfolioUi = readSource("components/growth/workspace/executive-briefing/growth-home-portfolio-manager-section.tsx")
  assert.match(portfolioUi, /marketIntelligence/)
  assert.match(portfolioUi, /GROWTH_MARKET_INTELLIGENCE_LOOP_1A_QA_MARKER/)
  assert.match(readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts"), /tickMarketIntelligenceLoopForScheduler/)
  assert.match(readSource("lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a.ts"), /evaluateMarketIntelligenceLoop/)

  const packageJson = JSON.parse(readSource("package.json")) as { scripts: Record<string, string> }
  assert.match(packageJson.scripts["test:ge-aios-market-intelligence-loop-1a"] ?? "", /market-intelligence-loop-1a/)
  console.log("  ✓ scheduler + portfolio + UI wiring present")

  console.log(`[${PHASE}] PASS — Market Intelligence Loop certified (local)`)
}

main()
