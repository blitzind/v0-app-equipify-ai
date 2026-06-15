/**
 * Phase GS-2E — Campaign Readiness Engine certification.
 *
 * Local: pnpm test:campaign-readiness
 * Production: pnpm test:campaign-readiness:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { evaluateCampaignReadiness } from "../lib/growth/campaign-readiness/campaign-readiness-engine"
import { buildCampaignReadinessReadinessPayload } from "../lib/growth/campaign-readiness/campaign-readiness-route-gates"
import {
  CAMPAIGN_READINESS_CONFIRM,
  CAMPAIGN_READINESS_QA_MARKER,
  CAMPAIGN_READINESS_STATUSES,
} from "../lib/growth/campaign-readiness/campaign-readiness-types"
import { buildProspectSearchEngineReadiness } from "../lib/growth/prospect-search/prospect-search-engine-readiness"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== GS-2E local regression (${CAMPAIGN_READINESS_QA_MARKER}) ===\n`)

  assert.equal(CAMPAIGN_READINESS_QA_MARKER, "growth-campaign-readiness-gs2e-v1")
  assert.equal(CAMPAIGN_READINESS_CONFIRM, "RUN_CAMPAIGN_READINESS_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/campaign-readiness/campaign-readiness-types.ts",
    "lib/growth/campaign-readiness/campaign-readiness-engine.ts",
    "lib/growth/campaign-readiness/campaign-readiness-service.ts",
    "lib/growth/campaign-readiness/campaign-readiness-certification.ts",
    "lib/growth/campaign-readiness/campaign-readiness-route-gates.ts",
    "app/api/platform/growth/campaign-readiness/route.ts",
    "app/api/platform/growth/campaign-readiness/generate/route.ts",
    "app/api/platform/growth/campaign-readiness/readiness/route.ts",
    "app/api/platform/growth/campaign-readiness/execute/route.ts",
    "components/growth/growth-campaign-readiness-panel.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-2E module files exist")

  const engineReadiness = buildProspectSearchEngineReadiness({
    company: { contact_intelligence: undefined, canonical_company_id: null, is_suppressed: false },
  })

  for (const status of CAMPAIGN_READINESS_STATUSES) {
    const assessment =
      status === "not_ready"
        ? evaluateCampaignReadiness({
            assessment_id: "cert-not-ready",
            subject_type: "prospect",
            subject_ref: "lead-blocked",
            is_suppressed: true,
            engine_readiness: engineReadiness,
          })
        : status === "ready"
          ? evaluateCampaignReadiness({
              assessment_id: "cert-ready",
              subject_type: "prospect",
              subject_ref: "lead-ready",
              engine_readiness: {
                ...engineReadiness,
                overall: { ...engineReadiness.overall, score: 90 },
                channel: { ...engineReadiness.channel, score: 85 },
                committee: { ...engineReadiness.committee, score: 82 },
                company_intelligence: { ...engineReadiness.company_intelligence, score: 80 },
                contactability: { ...engineReadiness.contactability, score: 85 },
                reachable_decision_maker_count: 2,
              },
              knowledge_document_count: 12,
              has_account_playbook: true,
              sequence_pattern_count: 2,
              voice_drop_pattern_ready: true,
              compliance_orchestration_enabled: true,
              human_approval_pending_count: 0,
            })
          : evaluateCampaignReadiness({
              assessment_id: "cert-partial",
              subject_type: "account",
              subject_ref: "account-partial",
              engine_readiness: engineReadiness,
              knowledge_document_count: 4,
              compliance_orchestration_enabled: true,
            })

    assert.ok(CAMPAIGN_READINESS_STATUSES.includes(assessment.readiness_status))
    assert.equal(assessment.requires_human_review, true)
    assert.equal(assessment.autonomous_execution_enabled, false)
    assert.equal(assessment.dimensions.length, 9)
  }
  console.log("  ✓ all readiness statuses evaluated with human review flags")

  const blocked = evaluateCampaignReadiness({
    assessment_id: "cert-blockers",
    subject_type: "cohort",
    subject_ref: "cohort-1",
    is_suppressed: true,
    engine_readiness: engineReadiness,
  })
  assert.ok(blocked.blockers.length > 0)
  assert.ok(blocked.recommendations.length > 0)
  console.log("  ✓ blockers and recommendations generated")

  const scoreA = evaluateCampaignReadiness({
    assessment_id: "det-a",
    subject_type: "account",
    subject_ref: "acct",
    knowledge_document_count: 7,
    engine_readiness: engineReadiness,
  })
  const scoreB = evaluateCampaignReadiness({
    assessment_id: "det-b",
    subject_type: "account",
    subject_ref: "acct",
    knowledge_document_count: 7,
    engine_readiness: engineReadiness,
  })
  assert.equal(scoreA.readiness_score, scoreB.readiness_score)
  console.log("  ✓ deterministic scoring")

  const readiness = buildCampaignReadinessReadinessPayload()
  assert.equal(readiness.no_outreach_execution, true)
  assert.equal(readiness.no_enrollment_execution, true)
  assert.equal(readiness.autonomous_execution_enabled, false)
  console.log("  ✓ readiness diagnostics — no outreach or enrollment execution")

  const generateRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/campaign-readiness/generate/route.ts"),
    "utf8",
  )
  assert.ok(generateRoute.includes("outreach_enabled: false"))
  assert.ok(generateRoute.includes("enrollment_enabled: false"))
  assert.ok(!generateRoute.includes("sendSequence"))
  assert.ok(!generateRoute.includes("executeOutreach"))
  console.log("  ✓ generate API — advisory only, no outreach execution")

  const executeRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/campaign-readiness/execute/route.ts"),
    "utf8",
  )
  assert.ok(executeRoute.includes("executeCampaignReadinessCertification"))
  assert.ok(!executeRoute.includes("enroll"))
  console.log("  ✓ execute API — certification only")

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-campaign-readiness-panel.tsx"),
    "utf8",
  )
  assert.ok(uiSource.includes("Mark Reviewed"))
  assert.ok(uiSource.includes("View Details"))
  assert.ok(uiSource.includes("Open Related Asset"))
  assert.ok(!uiSource.match(/\bSend\b/))
  assert.ok(!uiSource.includes("Launch Campaign"))
  assert.ok(!uiSource.includes("Enroll"))
  assert.ok(!uiSource.includes("Execute Outreach"))
  console.log("  ✓ UI — human-gated actions only")

  const engineSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/campaign-readiness/campaign-readiness-engine.ts"),
    "utf8",
  )
  assert.ok(!engineSource.includes("openai"))
  assert.ok(!engineSource.includes("createEmbedding"))
  assert.ok(!engineSource.includes("vectorStore"))
  assert.ok(!engineSource.includes("@/lib/ai"))
  console.log("  ✓ engine — no LLM, embeddings, or vector DB")

  console.log("\nGS-2E local regression PASS\n")
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
  const { executeCampaignReadinessCertification } = await import(
    "../lib/growth/campaign-readiness/campaign-readiness-certification"
  )
  return executeCampaignReadinessCertification(admin, {})
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
          qa_marker: CAMPAIGN_READINESS_QA_MARKER,
          hint: "Run pnpm test:campaign-readiness:production for production certification",
        },
        null,
        2,
      ),
    )
    return
  }

  const report = await runProductionCertification()
  console.log(JSON.stringify(report, null, 2))
  if (report.final_verdict !== "PASS") {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
