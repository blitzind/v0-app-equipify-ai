/**
 * Phase GS-2D — Signal-aware prospect recommendations certification.
 *
 * Local: pnpm test:prospect-recommendations
 * Production: pnpm test:prospect-recommendations:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  buildProspectPriorityScore,
  buildProspectPriorityScoreInputFromCompany,
  detectFundingSignalStrength,
  detectHiringSignalStrength,
} from "../lib/growth/prospect-discovery/prospect-priority-scoring"
import {
  collapseProspectRecommendations,
  generateProspectRecommendations,
} from "../lib/growth/prospect-discovery/prospect-recommendation-engine"
import {
  PROSPECT_RECOMMENDATION_CONFIRM,
  PROSPECT_RECOMMENDATION_QA_MARKER,
  PROSPECT_RECOMMENDATION_TYPE_LABELS,
} from "../lib/growth/prospect-discovery/prospect-recommendation-types"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function sampleCompany(): GrowthProspectSearchCompanyResult {
  return {
    id: "sample-abc-biomedical",
    source_type: "external_discovered",
    company_name: "ABC Biomedical",
    website: "https://abc-biomedical.example",
    industry: "Biomedical",
    subindustry: "Diagnostics",
    employees: "250-500",
    revenue_range: "$25M-$50M",
    location: "Boston, MA",
    intent_score: 82,
    buying_stage: "evaluation",
    buying_stage_confidence: 78,
    buying_stage_reason: null,
    buying_stage_last_assessed_at: null,
    lead_score: 88,
    lead_engine_score: 91,
    lead_engine_score_label: "High",
    lead_engine_score_explanation: null,
    lead_engine_last_run_at: null,
    confidence: 0.91,
    company_match_confidence: 0.9,
    decision_maker_coverage: 72,
    verification_status: "verified",
    signals: ["Hiring Surge", "Funding Event", "Pricing Page Visit", "Strong Fit"],
    search_intent_category: "biomedical",
    lead_inbox_id: null,
    growth_lead_id: "7bf7a767-ef0f-4441-af6e-d0f3ffa81d56",
    prospect_id: null,
    customer_id: null,
    rank_score: 92,
    match_reasoning: ["Strong biomedical playbook fit"],
    signal_momentum_score: 88,
    signal_momentum_label: "surge",
    growth_signal_score: 86,
    growth_signal_tier: "hot",
  }
}

function runLocalRegression(): void {
  console.log(`\n=== GS-2D local regression (${PROSPECT_RECOMMENDATION_QA_MARKER}) ===\n`)

  assert.equal(PROSPECT_RECOMMENDATION_QA_MARKER, "growth-prospect-recommendations-gs2d-v1")
  assert.equal(PROSPECT_RECOMMENDATION_CONFIRM, "RUN_PROSPECT_RECOMMENDATIONS_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/prospect-discovery/prospect-recommendation-types.ts",
    "lib/growth/prospect-discovery/prospect-priority-scoring.ts",
    "lib/growth/prospect-discovery/prospect-recommendation-engine.ts",
    "lib/growth/prospect-discovery/prospect-recommendation-repository.ts",
    "lib/growth/prospect-discovery/prospect-recommendation-certification.ts",
    "app/api/platform/growth/prospect-recommendations/route.ts",
    "app/api/platform/growth/prospect-recommendations/[executionRunId]/route.ts",
    "app/api/platform/growth/prospect-recommendations/actions/route.ts",
    "app/api/platform/growth/prospect-recommendations/execute/route.ts",
    "components/growth/top-prospect-opportunities-panel.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-2D module files exist")

  const company = sampleCompany()
  assert.ok(detectHiringSignalStrength(company.signals, company) >= 50)
  assert.ok(detectFundingSignalStrength(company.signals, company) >= 50)
  console.log("  ✓ signal strength detectors")

  const scoreInput = buildProspectPriorityScoreInputFromCompany(company, "biomedical")
  const priority = buildProspectPriorityScore(scoreInput)
  assert.equal(priority.priority, "urgent")
  assert.ok(priority.confidence >= 85)
  console.log("  ✓ priority scoring (urgent / high confidence)")

  const recommendations = generateProspectRecommendations({
    execution_run_id: "local-cert-run",
    companies: [company],
    qualified_company_ids: [company.id],
    search_industry_hint: "biomedical",
  })
  assert.ok(recommendations.length >= 4)
  assert.ok(recommendations.some((r) => r.recommendation_type === "review_company"))
  assert.ok(recommendations.some((r) => r.recommendation_type === "run_company_intelligence"))
  assert.ok(recommendations.every((r) => r.enrollment_enabled === false))
  assert.ok(recommendations.every((r) => r.outreach_enabled === false))
  console.log("  ✓ recommendations generated without enrollment/outreach")

  const duplicateCollapse = collapseProspectRecommendations([
    ...recommendations,
    ...recommendations.map((item, index) => ({ ...item, recommendation_id: `${item.recommendation_id}-dup-${index}` })),
  ])
  assert.ok(duplicateCollapse.items.length < recommendations.length * 2)
  console.log("  ✓ duplicate recommendations collapse")

  assert.ok(
    recommendations.some(
      (r) => PROSPECT_RECOMMENDATION_TYPE_LABELS[r.recommendation_type] === "Recommend Executive Outreach Sequence",
    ),
  )
  console.log("  ✓ sequence recommendation is label-only")

  const actionsRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/prospect-recommendations/actions/route.ts"),
    "utf8",
  )
  assert.ok(actionsRoute.includes("PROSPECT_RECOMMENDATION_ACTIONS"))
  assert.ok(actionsRoute.includes("applyProspectRecommendationAction"))
  assert.ok(!actionsRoute.includes("enrollProspect"))
  assert.ok(!actionsRoute.includes("send_outreach"))
  console.log("  ✓ actions API is status-only")

  console.log("\nGS-2D local regression PASS\n")
}

async function runProductionCertification(): Promise<Record<string, unknown>> {
  process.env.VERCEL_ENV = process.env.VERCEL_ENV ?? "production"

  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) return { ok: false, final_verdict: "FAIL", error: "supabase_unavailable" }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { executeProspectRecommendationsCertification } = await import(
    "../lib/growth/prospect-discovery/prospect-recommendation-certification"
  )
  return executeProspectRecommendationsCertification(admin, {
    execution_run_id: "0f95e732-e0a7-4d84-8d1d-d7e8ea1978a0",
  })
}

async function main(): Promise<void> {
  const productionOnly = process.argv.includes("--production")
  runLocalRegression()

  if (!productionOnly) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          local_only: true,
          qa_marker: PROSPECT_RECOMMENDATION_QA_MARKER,
          hint: "Run pnpm test:prospect-recommendations:production for production certification",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== GS-2D production certification (${PROSPECT_RECOMMENDATION_QA_MARKER}) ===\n`)
  const report = await runProductionCertification()
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})