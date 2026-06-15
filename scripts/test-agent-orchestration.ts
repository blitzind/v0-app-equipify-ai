/**
 * Phase GS-4D — Agent Orchestration Framework certification.
 *
 * Local: pnpm test:agent-orchestration
 * Production: pnpm test:agent-orchestration:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { CAMPAIGN_READINESS_QA_MARKER } from "../lib/growth/campaign-readiness/campaign-readiness-types"
import {
  generateGrowthAgentPlan,
  resolveGrowthAgentDependencies,
  routeGrowthAgentTask,
} from "../lib/growth/agent-orchestration/agent-orchestration-engine"
import {
  rankGrowthAgentRecommendations,
  scoreGrowthAgentPlan,
} from "../lib/growth/agent-orchestration/agent-orchestration-priority"
import { buildAgentOrchestrationReadinessPayload } from "../lib/growth/agent-orchestration/agent-orchestration-route-gates"
import {
  AGENT_ORCHESTRATION_CONFIRM,
  AGENT_ORCHESTRATION_QA_MARKER,
  GROWTH_AGENT_PLAN_STATUSES,
} from "../lib/growth/agent-orchestration/agent-orchestration-types"
import { generateCampaignBuilderWizard } from "../lib/growth/campaign-builder/campaign-builder-engine"
import { generateSequencePreview } from "../lib/growth/sequence-preview/sequence-preview-engine"
import type { GrowthSequencePattern } from "../lib/growth/sequence-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function localPattern(): GrowthSequencePattern {
  return {
    id: "pat-orch-1",
    key: "local_orchestration",
    label: "Local Orchestration Pattern",
    description: null,
    patternKind: "catalog",
    sequenceVersion: 1,
    isActive: true,
    minTouches: 2,
    maxObservationDays: 21,
    attemptCount: 5,
    replyRate: 0.1,
    positiveReplyRate: 0.04,
    meetingSignalRate: 0.02,
    followUpCompletionRate: 0.35,
    sequenceAbandonmentRate: 0.08,
    opportunityLift: 0.05,
    revenueProbabilityLift: 0.04,
    conversationHealthLift: 0.03,
    averageTimeToReplyHours: 36,
    averageTouchesToPositiveSignal: 2,
    sequenceQualityScore: 68,
    sequenceFatigueRisk: "low",
    confidenceScore: 58,
    computedAt: new Date().toISOString(),
    steps: [
      {
        id: "step-1",
        patternId: "pat-orch-1",
        stepOrder: 1,
        channel: "email",
        delayDaysMin: 0,
        delayDaysMax: 0,
        generationType: "personalized",
        playbookCategory: "value_prop",
        voiceDropCampaignId: null,
        requiredHumanApproval: true,
        expectedSignal: "reply",
      },
    ],
  }
}

function runLocalRegression(): void {
  console.log(`\n=== GS-4D local regression (${AGENT_ORCHESTRATION_QA_MARKER}) ===\n`)

  assert.equal(AGENT_ORCHESTRATION_QA_MARKER, "growth-agent-orchestration-gs4d-v1")
  assert.equal(AGENT_ORCHESTRATION_CONFIRM, "RUN_AGENT_ORCHESTRATION_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/agent-orchestration/agent-orchestration-types.ts",
    "lib/growth/agent-orchestration/agent-orchestration-engine.ts",
    "lib/growth/agent-orchestration/agent-orchestration-priority.ts",
    "lib/growth/agent-orchestration/agent-orchestration-service.ts",
    "lib/growth/agent-orchestration/agent-orchestration-certification.ts",
    "lib/growth/agent-orchestration/agent-orchestration-route-gates.ts",
    "app/api/platform/growth/agent-orchestration/route.ts",
    "app/api/platform/growth/agent-orchestration/generate/route.ts",
    "app/api/platform/growth/agent-orchestration/actions/route.ts",
    "components/growth/growth-agent-orchestration-panel.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-4D module files exist")

  const readiness = {
    qa_marker: CAMPAIGN_READINESS_QA_MARKER,
    assessment_id: "assess-1",
    subject_type: "prospect" as const,
    subject_ref: "lead-1",
    lead_id: "lead-1",
    company_name: "Acme HVAC",
    execution_run_id: null,
    generated_at: new Date().toISOString(),
    readiness_score: 62,
    readiness_status: "partially_ready" as const,
    dimensions: [],
    blockers: [],
    recommendations: [],
    missing_assets: [],
    missing_channels: ["verified_email" as const],
    required_approvals: ["Human approval"],
    required_human_actions: ["Review readiness"],
    review_status: "pending" as const,
    requires_human_review: true as const,
    autonomous_execution_enabled: false as const,
  }

  const pattern = localPattern()
  const previews = generateSequencePreview({ patterns: [pattern], campaign_readiness: readiness, limit: 5 })
  const wizards = generateCampaignBuilderWizard({
    lead_id: "lead-1",
    company_name: "Acme HVAC",
    pattern_id: pattern.id,
    campaign_readiness: readiness,
    sequence_previews: previews.previews,
    patterns: [pattern],
  })

  const generated = generateGrowthAgentPlan({
    lead_id: "lead-1",
    company_name: "Acme HVAC",
    campaign_readiness: readiness,
    sequence_previews: previews.previews,
    campaign_wizards: wizards.wizards,
    sequence_pattern_count: 1,
  })

  assert.ok(generated.plans.length >= 1)
  assert.equal(generated.requires_human_review, true)
  assert.equal(generated.autonomous_execution_enabled, false)
  assert.equal(generated.outreach_execution, false)
  assert.equal(generated.enrollment_execution, false)
  for (const status of GROWTH_AGENT_PLAN_STATUSES) {
    assert.ok(status in generated.status_counts)
  }
  console.log("  ✓ plans generated with statuses")

  const plan = generated.plans[0]!
  assert.ok(plan.tasks.length >= 5)
  assert.ok(plan.execution_graph.nodes.length >= 5)
  assert.ok(plan.dependencies.length >= 3)
  assert.ok(plan.suggested_order.length >= 5)
  assert.ok(plan.risks.length >= 1)
  assert.ok(plan.required_approvals.length >= 2)
  console.log("  ✓ task graph, dependencies, order, risks, approvals")

  const deps = resolveGrowthAgentDependencies(plan.tasks)
  assert.ok(deps.length >= 3)
  console.log("  ✓ dependency resolution")

  const ranked = rankGrowthAgentRecommendations(plan.recommendations)
  assert.ok(ranked.length >= 1)
  console.log("  ✓ recommendation ranking")

  assert.equal(routeGrowthAgentTask(plan.tasks[0]!).requires_human_review, true)
  console.log("  ✓ task routing — human review required")

  assert.equal(scoreGrowthAgentPlan(plan), scoreGrowthAgentPlan(plan))
  console.log("  ✓ deterministic scoring")

  const readinessPayload = buildAgentOrchestrationReadinessPayload()
  assert.equal(readinessPayload.no_outreach_execution, true)
  assert.equal(readinessPayload.autonomous_execution_enabled, false)
  console.log("  ✓ readiness diagnostics")

  const actionsRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/agent-orchestration/actions/route.ts"),
    "utf8",
  )
  assert.ok(actionsRoute.includes("outreach_execution: false"))
  assert.ok(!actionsRoute.includes("enrollLeadInSequence"))
  console.log("  ✓ actions API — no outreach or enrollment")

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-agent-orchestration-panel.tsx"),
    "utf8",
  )
  assert.ok(uiSource.includes("View Plan"))
  assert.ok(uiSource.includes("Mark Reviewed"))
  assert.ok(uiSource.includes("Open Related Item"))
  assert.ok(uiSource.includes("Dismiss"))
  assert.ok(!uiSource.match(/\bSend\b/))
  assert.ok(!uiSource.includes("Launch"))
  assert.ok(!uiSource.includes("Enroll"))
  assert.ok(!uiSource.includes("Book Meeting"))
  console.log("  ✓ UI — human-gated actions only")

  const engineSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/agent-orchestration/agent-orchestration-engine.ts"),
    "utf8",
  )
  assert.ok(!engineSource.includes("openai"))
  assert.ok(!engineSource.includes("createEmbedding"))
  console.log("  ✓ engine — no LLM or vector DB")

  console.log("\nGS-4D local regression PASS\n")
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
  const { executeAgentOrchestrationCertification } = await import(
    "../lib/growth/agent-orchestration/agent-orchestration-certification"
  )
  return executeAgentOrchestrationCertification(admin, {})
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
          qa_marker: AGENT_ORCHESTRATION_QA_MARKER,
          hint: "Run pnpm test:agent-orchestration:production for production certification",
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
