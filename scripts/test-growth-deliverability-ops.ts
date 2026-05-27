/**
 * Regression checks for Deliverability Operations Center (Phase 2R).
 * Run: pnpm test:growth-deliverability-ops
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  aggregateDeliverabilityScores,
  buildEvidenceSnippet,
  highestSeverity,
  severityRank,
} from "../lib/growth/deliverability-ops/deliverability-aggregator"
import {
  aggregateDomainAuthenticationScore,
  buildDomainReputationSnapshot,
  computeDomainReputationTrend,
  domainReputationHealthTier,
} from "../lib/growth/deliverability-ops/domain-reputation"
import {
  generateDeliverabilityRecommendations,
  hasMinimumRecommendationEvidence,
} from "../lib/growth/deliverability-ops/recommendation-engine"
import {
  buildRemediationTasksFromRecommendation,
  buildRemediationTasksFromRisk,
  checklistCompletionPct,
} from "../lib/growth/deliverability-ops/remediation-tasks"
import { detectDeliverabilityRisks } from "../lib/growth/deliverability-ops/risk-detector"
import {
  GROWTH_DELIVERABILITY_OPS_PRIVACY_NOTE,
  GROWTH_DELIVERABILITY_OPS_QA_MARKER,
  GROWTH_DELIVERABILITY_OPS_STATUSES,
  GROWTH_DELIVERABILITY_RECOMMENDATION_TYPES,
  GROWTH_DELIVERABILITY_RISK_TYPES,
  maskDomainLabel,
  maskSenderEntityLabel,
} from "../lib/growth/deliverability-ops/deliverability-ops-types"

const GROWTH_DELIVERABILITY_OPS_SCHEMA_MIGRATION = "20270423120000_growth_deliverability_ops.sql" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_DELIVERABILITY_OPS_QA_MARKER, "growth-deliverability-ops-v1")
  assert.match(GROWTH_DELIVERABILITY_OPS_PRIVACY_NOTE, /advisory/i)
  assert.match(GROWTH_DELIVERABILITY_OPS_PRIVACY_NOTE, /No autonomous DNS/i)
  assert.match(GROWTH_DELIVERABILITY_OPS_PRIVACY_NOTE, /compliance bypass/i)
  assert.equal(GROWTH_DELIVERABILITY_RISK_TYPES.length, 14)
  assert.equal(GROWTH_DELIVERABILITY_RECOMMENDATION_TYPES.length, 12)
  assert.equal(GROWTH_DELIVERABILITY_OPS_STATUSES.length, 5)

  const migration = readSource(`supabase/migrations/${GROWTH_DELIVERABILITY_OPS_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth\.deliverability_ops_snapshots/)
  assert.match(migration, /growth\.deliverability_recommendations/)
  assert.match(migration, /growth\.deliverability_risk_events/)
  assert.match(migration, /growth\.deliverability_remediation_tasks/)
  assert.match(migration, /growth\.deliverability_domain_reputation_history/)
  assert.match(migration, /spf_failure/)
  assert.match(migration, /pause_sender/)
  assert.match(migration, /deliverability_recommendation_created/)
  assert.match(migration, /service role only/i)

  const scores = aggregateDeliverabilityScores({
    senderReputationAvg: 82,
    domainHealthAvg: 78,
    providerHealthAvg: 85,
    bounceRate: 6,
    complaintRate: 0.2,
    unsubscribeRate: 1.8,
    openRiskCount: 2,
  })
  assert.ok(scores.overallDeliverability >= 0 && scores.overallDeliverability <= 100)
  assert.equal(scores.riskAlerts, 2)
  assert.ok(severityRank("critical") > severityRank("low"))
  assert.equal(highestSeverity(["low", "high", "medium"]), "high")

  const evidence = [
    buildEvidenceSnippet("Bounce rate", "8.2%", "compliance"),
    buildEvidenceSnippet("Threshold", "5%", "risk_detector"),
  ]
  assert.ok(hasMinimumRecommendationEvidence(evidence))

  const risks = detectDeliverabilityRisks({
    entityType: "sender",
    entityId: "s1",
    entityLabel: "Alice",
    spfValid: false,
    bounceRate: 12,
    complaintRate: 0.5,
    unsubscribeRate: 2.5,
    previousOpenRate: 30,
    openRate: 10,
    fatigueScore: 80,
    warmupEnabled: true,
    warmupProgress: 40,
    recentVolume: 200,
    rateLimitUtilizationPct: 88,
  })
  assert.ok(risks.some((r) => r.riskType === "spf_failure"))
  assert.ok(risks.some((r) => r.riskType === "bounce_spike"))
  assert.ok(risks.some((r) => r.riskType === "warmup_mismatch"))
  assert.ok(risks.some((r) => r.riskType === "rate_limit_pressure"))

  const recommendations = generateDeliverabilityRecommendations(risks)
  assert.ok(recommendations.length > 0)
  assert.ok(recommendations.every((rec) => rec.evidence.length >= 2))
  assert.ok(recommendations.some((rec) => rec.recommendationType === "fix_spf"))

  const task = buildRemediationTasksFromRecommendation(recommendations[0]!)
  assert.ok(task.checklist.length >= 3)
  const riskTask = buildRemediationTasksFromRisk(risks[0]!)
  assert.ok(riskTask.checklist.length >= 2)
  assert.equal(checklistCompletionPct([{ id: "a", label: "A", completed: true }, { id: "b", label: "B", completed: false }]), 50)

  assert.equal(computeDomainReputationTrend(80, 70), "improving")
  assert.equal(computeDomainReputationTrend(50, 70), "declining")
  assert.equal(aggregateDomainAuthenticationScore({ spfValid: true, dkimValid: true, dmarcValid: false }), 70)
  const domainSnap = buildDomainReputationSnapshot({
    domainId: "d1",
    domain: "mail.example.com",
    reputationScore: 72,
    bounceRate: 4,
    complaintRate: 0.1,
    authenticationScore: 70,
    previousReputationScore: 85,
  })
  assert.equal(domainSnap.trend, "declining")
  assert.match(domainSnap.domainLabel, /\*\*\*\.example\.com/)
  assert.equal(domainReputationHealthTier(80), "healthy")

  assert.equal(maskSenderEntityLabel("alice@example.com", "Alice"), "Alice")
  assert.match(maskSenderEntityLabel("alice@example.com"), /\*\*\*@example\.com/)
  assert.match(maskDomainLabel("mail.example.com"), /\*\*\*\.example\.com/)

  const routesSource = readSource("app/api/platform/growth/deliverability-ops/dashboard/route.ts")
  assert.match(routesSource, /requireGrowthEnginePlatformAccess/)
  assert.match(routesSource, /isGrowthDeliverabilityOpsSchemaReady/)

  const ackSource = readSource(
    "app/api/platform/growth/deliverability-ops/recommendations/[id]/acknowledge/route.ts",
  )
  assert.match(ackSource, /humanApprovalConfirmed/)
  assert.match(ackSource, /human_approval_required/)

  const navSource = readSource("lib/growth/navigation/growth-navigation-destinations.ts")
  assert.match(navSource, /deliverability-ops/)
  assert.match(navSource, /Deliverability Ops/)

  const deliverySource = readSource("components/growth/growth-provider-delivery-dashboard.tsx")
  assert.match(deliverySource, /deliverability-ops/)

  const poolsSource = readSource("components/growth/growth-sender-pools-dashboard.tsx")
  assert.match(poolsSource, /deliverability-ops/)

  const complianceSource = readSource("components/growth/growth-compliance-dashboard.tsx")
  assert.match(complianceSource, /deliverability-ops/)

  const warmupSource = readSource("components/growth/growth-warmup-dashboard.tsx")
  assert.match(warmupSource, /deliverability-ops/)

  console.log("growth deliverability ops checks passed")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
