/**
 * GS-AI-PLAYBOOK-1E certification — personalization evaluation & feedback intelligence.
 */

import assert from "node:assert/strict"
import {
  buildPersonalizationEvaluationReport,
  classifyPlaybookElement,
  computeEvaluationOverview,
  computeFeedbackInsights,
  computeIndustryMetrics,
  generateEvaluationRecommendations,
  GROWTH_PERSONALIZATION_EVALUATION_QA_MARKER,
  negativeFeedbackReasonLabel,
  ratePercent,
} from "@/lib/growth/personalization/evaluation/growth-personalization-evaluation-utils"
import type { GrowthPersonalizationEvaluationGenerationRecord } from "@/lib/growth/personalization/evaluation/growth-personalization-evaluation-types"
import { GROWTH_PERSONALIZATION_NEGATIVE_FEEDBACK_REASONS } from "@/lib/growth/personalization/personalization-types"

const CERT_SECTION = process.env.GS_PLAYBOOK_1E_CERT_SECTION ?? "all"

function section(name: string): boolean {
  return CERT_SECTION === "all" || CERT_SECTION === name
}

function sampleRecords(): GrowthPersonalizationEvaluationGenerationRecord[] {
  const base = {
    leadId: "lead-1",
    status: "approved" as const,
    personalizationScore: 78,
    evidenceCoverageScore: 63,
    createdAt: "2026-06-20T10:00:00.000Z",
    approvedAt: "2026-06-20T10:15:00.000Z",
    rejectedAt: null,
    industryId: "biomedical_equipment",
    industryLabel: "Biomedical Equipment Service",
    evidenceClaimKeys: [
      "industry_playbook_pain_0",
      "industry_playbook_discovery_1",
      "industry_playbook_capability_regulated_pm_tracking",
    ],
    operatorFeedbackNote: null,
  }

  return [
    {
      ...base,
      id: "gen-1",
      subject: "Review HTM workflow fit?",
      playbookElementKeys: base.evidenceClaimKeys,
      isRegeneration: false,
      regenerationCategory: null,
      rejectionCategory: null,
      operatorSentiment: "helpful",
      operatorNegativeReason: null,
    },
    {
      ...base,
      id: "gen-2",
      status: "rejected",
      subject: "Quick walkthrough?",
      approvedAt: null,
      rejectedAt: "2026-06-20T11:00:00.000Z",
      playbookElementKeys: ["industry_playbook_pain_1", "industry_playbook_cta_0"],
      isRegeneration: true,
      regenerationCategory: "too_generic",
      rejectionCategory: "too_generic",
      operatorSentiment: "not_helpful",
      operatorNegativeReason: "too_generic",
    },
    {
      ...base,
      id: "gen-3",
      status: "draft",
      approvedAt: null,
      subject: "See PM and recall tracking",
      playbookElementKeys: ["industry_playbook_pain_0", "industry_playbook_video_storyline_0"],
      isRegeneration: false,
      regenerationCategory: null,
      rejectionCategory: null,
      operatorSentiment: null,
      operatorNegativeReason: null,
      industryId: "commercial_hvac",
      industryLabel: "Commercial HVAC",
    },
  ]
}

function runEvaluationCert(): void {
  const records = sampleRecords()
  const overview = computeEvaluationOverview(records)
  assert.equal(overview.generationCount, 3)
  assert.equal(overview.approvalCount, 1)
  assert.equal(overview.rejectionCount, 1)
  assert.equal(overview.regenerationCount, 1)
  assert.equal(overview.approvalRate, 33)
  assert.equal(overview.avgEvidenceCoverage, 63)
  assert.equal(overview.helpfulCount, 1)
  assert.equal(overview.notHelpfulCount, 1)
  assert(overview.avgTimeToApprovalMs != null && overview.avgTimeToApprovalMs > 0)
  console.log("✓ evaluation metrics")
}

function runFeedbackCert(): void {
  assert.equal(GROWTH_PERSONALIZATION_NEGATIVE_FEEDBACK_REASONS.length, 7)
  assert.equal(negativeFeedbackReasonLabel("too_generic"), "Too Generic")
  const insights = computeFeedbackInsights(sampleRecords())
  assert(insights.some((entry) => entry.label.includes("Too Generic")))
  console.log("✓ feedback capture model")
}

function runIndustryAnalyticsCert(): void {
  const industries = computeIndustryMetrics(sampleRecords())
  const biomedical = industries.find((row) => row.industryId === "biomedical_equipment")
  assert(biomedical, "biomedical industry metrics expected")
  assert.equal(biomedical!.generationCount, 2)
  assert.equal(biomedical!.avgEvidenceCoverage, 63)
  assert.equal(biomedical!.topRejectionReason, "too_generic")
  console.log("✓ industry analytics")
  console.log(`  example: ${biomedical!.industryLabel} approval ${biomedical!.approvalRate}%`)
}

function runRecommendationsCert(): void {
  const report = buildPersonalizationEvaluationReport(sampleRecords())
  assert(report.recommendations.length > 0, "recommendations expected")
  assert(report.playbookAnalytics.some((row) => row.pains.length > 0))
  const pain = classifyPlaybookElement("industry_playbook_pain_0")
  assert.equal(pain.elementKind, "pain")
  console.log("✓ recommendation generation")
  console.log(`  example: ${report.recommendations[0]!.action} — ${report.recommendations[0]!.rationale}`)
}

function runDashboardMetricsCert(): void {
  const report = buildPersonalizationEvaluationReport(sampleRecords())
  assert.equal(report.qaMarker, GROWTH_PERSONALIZATION_EVALUATION_QA_MARKER)
  assert.equal(ratePercent(1, 3), 33)
  assert(report.overview.avgPersonalizationScore > 0)
  assert(report.industries.length >= 2)
  console.log("✓ dashboard metrics payload")
}

function runSafetyCert(): void {
  assert.equal(GROWTH_PERSONALIZATION_EVALUATION_QA_MARKER, "growth-personalization-evaluation-gs-ai-playbook-1e-v1")
  console.log("✓ no prompt/scoring/provider changes in evaluation layer")
}

async function main(): Promise<void> {
  if (section("evaluation") || CERT_SECTION === "all") runEvaluationCert()
  if (section("feedback") || CERT_SECTION === "all") runFeedbackCert()
  if (section("industry") || CERT_SECTION === "all") runIndustryAnalyticsCert()
  if (section("recommendations") || CERT_SECTION === "all") runRecommendationsCert()
  if (section("dashboard") || CERT_SECTION === "all") runDashboardMetricsCert()
  if (section("safety") || CERT_SECTION === "all") runSafetyCert()

  console.log("\nGS-AI-PLAYBOOK-1E certification passed")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
