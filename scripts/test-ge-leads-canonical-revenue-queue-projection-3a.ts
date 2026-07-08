/**
 * GE-LEADS-CANONICAL-3A — Static regression checks for Revenue Queue canonical projection.
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-ge-leads-canonical-revenue-queue-projection-3a.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_LEAD_STATUSES } from "../lib/growth/types"
import {
  mapLeadStatusToInboxQueueStatus,
  mapResearchPriorityToInboxPriority,
} from "../lib/growth/revenue-queue/revenue-queue-inbox-display-map"
import { buildRevenueQueueCardProjectionFromLead } from "../lib/growth/revenue-queue/revenue-queue-card-projection"
import { buildRevenueQueueLeadProjection } from "../lib/growth/revenue-queue/revenue-queue-projection"
import {
  GROWTH_REVENUE_QUEUE_PROJECTION_QA_MARKER,
  GROWTH_REVENUE_QUEUE_PROJECTION_CERT_QA_MARKER,
} from "../lib/growth/revenue-queue/revenue-queue-projection-types"
import {
  GROWTH_REVENUE_QUEUE_FIELD_COMPATIBILITY_QA_MARKER,
  REVENUE_QUEUE_CARD_PARITY_FIELDS,
  REVENUE_QUEUE_FIELD_COMPATIBILITY,
  REVENUE_QUEUE_MISSING_PROJECTION_DEPENDENCIES,
} from "../lib/growth/revenue-queue/revenue-queue-field-compatibility"
import { buildRevenueQueueDashboardSectionsFromLeads } from "../lib/growth/revenue-queue/revenue-queue-section-projection"
import type { GrowthLead } from "../lib/growth/types"

assert.equal(GROWTH_REVENUE_QUEUE_PROJECTION_QA_MARKER, "growth-revenue-queue-canonical-projection-v1")
assert.equal(GROWTH_REVENUE_QUEUE_PROJECTION_CERT_QA_MARKER, "growth-revenue-queue-projection-cert-v1")
assert.equal(
  GROWTH_REVENUE_QUEUE_FIELD_COMPATIBILITY_QA_MARKER,
  "growth-revenue-queue-field-compatibility-v1",
)

const loaderSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/revenue-queue/revenue-queue-projection-loader.ts"),
  "utf8",
)
assert.match(loaderSource, /loadRevenueQueueProjections/)
assert.match(loaderSource, /listGrowthLeads/)
assert.doesNotMatch(loaderSource, /loadLeadInbox\(|\.from\("lead_inbox"\)/)

const certSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/revenue-queue/revenue-queue-projection-cert.ts"),
  "utf8",
)
assert.match(certSource, /certifyRevenueQueueProjectionParity/)
assert.match(certSource, /buildLeadInboxCardView/)
assert.match(certSource, /buildRevenueQueueLeadProjection/)

const routeSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/lead-inbox/route.ts"),
  "utf8",
)
assert.match(routeSource, /loadRevenueQueueDashboardPayload/)
assert.match(routeSource, /parseRevenueQueueApiSource/)
assert.match(routeSource, /queue_source/)
assert.doesNotMatch(routeSource, /source=canonical/)

const bridgeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/revenue-queue/revenue-queue-api-bridge.ts"),
  "utf8",
)
assert.match(bridgeSource, /loadCanonicalRevenueQueueDashboardPayload/)
assert.match(bridgeSource, /loadLegacyRevenueQueueDashboardPayload/)
assert.match(bridgeSource, /listGrowthLeads/)

const dashboardSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/lead-operator/growth-lead-inbox-dashboard.tsx"),
  "utf8",
)
assert.match(dashboardSource, /\/api\/platform\/growth\/lead-inbox\?sort=/)
assert.doesNotMatch(dashboardSource, /source=legacy/)

assert.ok(REVENUE_QUEUE_FIELD_COMPATIBILITY.length >= 10)
assert.ok(REVENUE_QUEUE_MISSING_PROJECTION_DEPENDENCIES.length >= 4)
assert.ok(REVENUE_QUEUE_CARD_PARITY_FIELDS.length >= 10)

for (const status of GROWTH_LEAD_STATUSES) {
  assert.ok(mapLeadStatusToInboxQueueStatus(status))
}

assert.equal(mapResearchPriorityToInboxPriority("critical"), "urgent")
assert.equal(mapResearchPriorityToInboxPriority("low"), "low")

const sampleLead: GrowthLead = {
  id: "lead-1",
  sourceKind: "manual",
  sourceDetail: null,
  externalRef: null,
  companyName: "Acme HVAC",
  contactName: "Jane Doe",
  contactEmail: "jane@acme.test",
  contactPhone: null,
  website: "https://www.acme.test",
  addressLine1: null,
  city: null,
  state: null,
  postalCode: null,
  country: null,
  status: "new",
  promotedOrganizationId: null,
  promotedProspectId: null,
  promotedAt: null,
  score: 42,
  notes: null,
  metadata: {
    buying_stage_summary: { detected_stage: "purchase_ready", stage_confidence: 0.8 },
  },
  latestResearchRunId: null,
  lastResearchedAt: null,
  latestProspectResearchRunId: null,
  lastProspectResearchedAt: null,
  prospectRecommendedNextAction: null,
  researchPriority: "high",
  callDisposition: null,
  callDispositionAt: null,
  lastCallAt: null,
  followUpAt: null,
  callPriorityScore: null,
  callPriorityTier: null,
  callPriorityComputedAt: null,
  callPriorityOverride: null,
  lastHumanTouchAt: null,
  decisionMakerStatus: "likely",
  primaryDecisionMakerId: null,
  nextBestAction: "place_call",
  nextBestActionReason: "High intent",
  nextBestActionComputedAt: null,
  estimatedAnnualRevenue: null,
  estimatedEmployeeCount: null,
  fleetSizeEstimate: null,
  crmDetected: null,
  fieldServiceStackDetected: null,
  momentumScore: null,
  momentumTier: null,
  momentumWhySummary: null,
  momentumComputedAt: null,
  workflowHealth: "active",
  workflowHealthReason: null,
  workflowHealthComputedAt: null,
  sourceChannel: "manual",
  sourceCampaign: null,
  sourceImportBatchId: null,
  sourceVendor: null,
  agingDays: null,
  agingBucket: null,
  firstHumanTouchAt: null,
  timeToFirstTouchHours: null,
  contactTemperature: "warm",
  callAttemptCount: 0,
  voicemailCount: 0,
  connectedCallCount: 0,
  engagementScore: 30,
  engagementTier: null,
  engagementLastActivityAt: null,
  engagementSummary: null,
  engagementTopSignals: [],
  engagementDormancyExemptUntil: null,
  engagementComputedAt: null,
  relationshipStrengthScore: null,
  relationshipStrengthTier: null,
  relationshipLastMeaningfulTouchAt: null,
  relationshipSummary: null,
  relationshipTopSignals: [],
  relationshipTrend: null,
  relationshipPreviousScore: null,
  relationshipOwnerAttentionLevel: "normal",
  relationshipRecoveryAttemptCount: 0,
  relationshipComputedAt: null,
  opportunityReadinessScore: null,
  opportunityReadinessTier: "ready",
  opportunityReadinessSummary: null,
  opportunityReadinessTopSignals: [],
  opportunityBlockers: [],
  opportunityAccelerators: [],
  opportunityReadinessTrend: null,
  opportunityReadinessPreviousScore: null,
  opportunityBuyingSignalStrength: "moderate",
  opportunityReadinessConfidence: 0.72,
  opportunityAgeBucket: "fresh",
  opportunityReadinessComputedAt: null,
  revenueProbabilityScore: null,
  revenueProbabilityTier: null,
  revenueProbabilitySummary: null,
  revenueProbabilityTopSignals: [],
  revenueProbabilityConfidence: 0,
  revenueProbabilityPreviousScore: null,
  revenueTrajectory: "stable",
  revenueProbabilityVolatility: 0,
  forecastContributionWeight: 0,
  forecastAttentionLevel: "normal",
  forecastAttentionLastChangedAt: null,
  revenueForecastComputedAt: null,
  executivePriorityScore: null,
  executivePriorityTier: null,
  executivePrioritySummary: null,
  executivePriorityTopSignals: [],
  executivePriorityVolatility: 0,
  executivePriorityPreviousScore: null,
  intelligenceConflicts: [],
  intelligenceConflictSeverityScore: 0,
  executiveRecommendation: null,
  executiveOwner: null,
  executiveInterventionOpenedAt: null,
  executiveInterventionAgeBucket: "none",
  executiveOperatingComputedAt: null,
  operationalCapacityScore: null,
  operationalCapacityTier: null,
  operationalCapacitySummary: null,
  operationalCapacityTopConstraints: [],
  capacityPressureLevel: 0,
  capacityPressureVolatility: 0,
  protectedPipelineCoverage: 0,
  operationalConstraints: [],
  capacityConflicts: [],
  capacityProtectionRecommendation: null,
  constraintOpenedAt: null,
  constraintAgeBucket: "none",
  capacityRecoveryDirection: "stable",
  operationalCapacityPreviousScore: null,
  operationalCapacityComputedAt: null,
  conversationHealthScore: null,
  conversationHealthTier: "healthy",
  conversationSummary: null,
  conversationTopSignals: [],
  conversationSentiment: null,
  conversationUrgencyLevel: null,
  conversationBuyingIntent: null,
  conversationObjectionProfile: "none",
  conversationCompetitorMentions: [],
  conversationCompetitorPressure: null,
  conversationLastMeaningfulConversationAt: null,
  conversationPreviousScore: null,
  conversationTrend: null,
  conversationConfidence: null,
  conversationMomentum: null,
  conversationResponsePattern: null,
  conversationComputedAt: null,
  recommendedSequencePatternId: null,
  recommendedSequenceReason: null,
  recommendedSequenceConfidence: null,
  recommendedSequenceNextStep: {},
  sequenceFatigueRisk: null,
  recommendedSequenceComputedAt: null,
  activeSequenceEnrollmentId: null,
  archivedAt: null,
  archivedBy: null,
  archiveReason: null,
  createdBy: null,
  assignedTo: null,
  assignedAt: null,
  assignedBy: null,
  assignmentSource: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const card = buildRevenueQueueCardProjectionFromLead(sampleLead)
assert.equal(card.id, "lead-1")
assert.equal(card.company_name, "Acme HVAC")
assert.equal(card.candidate_priority, "high")
assert.equal(card.is_purchase_ready, true)
assert.ok(card.intent_score > 0)

const projection = buildRevenueQueueLeadProjection(sampleLead)
assert.equal(projection.growth_lead_id, "lead-1")
assert.equal(projection.next_best_action, "place_call")
assert.equal(projection.card_view.company_name, "Acme HVAC")

const sections = buildRevenueQueueDashboardSectionsFromLeads([sampleLead])
assert.equal(sections.length, 6)
const allCards = sections.flatMap((s) => s.items)
assert.equal(allCards.length, 1)

console.log("GE-LEADS-CANONICAL-3A projection tests passed.")
