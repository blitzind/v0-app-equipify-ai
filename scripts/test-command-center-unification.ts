/**
 * Phase GS-6A — Command Center Unification certification.
 *
 * Local: pnpm test:command-center-unification
 * Production: pnpm test:command-center-unification:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { CAMPAIGN_READINESS_QA_MARKER } from "../lib/growth/campaign-readiness/campaign-readiness-types"
import {
  buildGrowthCommandCenterMetrics,
  buildGrowthCommandCenterTimeline,
  buildGrowthCommandCenterWorkspace,
  buildGrowthLeadWorkspace,
} from "../lib/growth/command-center-unification/command-center-unification-engine"
import { buildCommandCenterUnificationReadinessPayload } from "../lib/growth/command-center-unification/command-center-unification-route-gates"
import {
  COMMAND_CENTER_UNIFICATION_CONFIRM,
  COMMAND_CENTER_UNIFICATION_QA_MARKER,
  COMMAND_CENTER_VIEW_IDS,
  COMMAND_CENTER_WORKSPACE_STATUSES,
} from "../lib/growth/command-center-unification/command-center-unification-types"
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
    id: "pat-unify-1",
    key: "local_unification",
    label: "Local Unification Pattern",
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
        patternId: "pat-unify-1",
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
  console.log(`\n=== GS-6A local regression (${COMMAND_CENTER_UNIFICATION_QA_MARKER}) ===\n`)

  assert.equal(COMMAND_CENTER_UNIFICATION_QA_MARKER, "growth-command-center-unification-gs6a-v1")
  assert.equal(COMMAND_CENTER_UNIFICATION_CONFIRM, "RUN_COMMAND_CENTER_UNIFICATION_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/command-center-unification/command-center-unification-types.ts",
    "lib/growth/command-center-unification/command-center-unification-engine.ts",
    "lib/growth/command-center-unification/command-center-unification-service.ts",
    "lib/growth/command-center-unification/command-center-unification-certification.ts",
    "lib/growth/command-center-unification/command-center-unification-route-gates.ts",
    "app/api/platform/growth/command-center-unification/route.ts",
    "app/api/platform/growth/command-center-unification/lead/route.ts",
    "app/api/platform/growth/command-center-unification/actions/route.ts",
    "components/growth/growth-command-center-unified-workspace.tsx",
    "components/growth/growth-lead-workspace-panel.tsx",
    "components/growth/growth-command-center-timeline-panel.tsx",
    "components/growth/growth-command-center-metrics-panel.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-6A module files exist")

  const readiness = {
    qa_marker: CAMPAIGN_READINESS_QA_MARKER,
    assessment_id: "assess-1",
    subject_type: "prospect" as const,
    subject_ref: "lead-1",
    lead_id: "lead-1",
    company_name: "Acme HVAC",
    execution_run_id: null,
    generated_at: new Date().toISOString(),
    readiness_score: 72,
    readiness_status: "partially_ready" as const,
    dimensions: [],
    blockers: [],
    recommendations: [],
    missing_assets: [],
    missing_channels: [],
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

  const ctx = {
    lead_id: "lead-1",
    company_name: "Acme HVAC",
    campaign_readiness: readiness,
    sequence_previews: previews,
    campaign_builder: wizards,
  }

  const workspace = buildGrowthCommandCenterWorkspace(ctx)
  const leadWorkspace = buildGrowthLeadWorkspace(ctx)
  const metrics = buildGrowthCommandCenterMetrics(ctx)
  const timeline = buildGrowthCommandCenterTimeline(ctx)

  assert.ok(workspace.sections.length >= 8)
  assert.equal(workspace.requires_human_review, true)
  assert.equal(workspace.autonomous_execution_enabled, false)
  assert.equal(workspace.outreach_execution, false)
  assert.equal(workspace.enrollment_execution, false)
  for (const status of COMMAND_CENTER_WORKSPACE_STATUSES) {
    assert.ok(typeof workspace.workspace_status === "string")
    void status
  }
  console.log("  ✓ workspace aggregation with statuses")

  assert.equal(workspace.views.length, COMMAND_CENTER_VIEW_IDS.length)
  assert.ok(leadWorkspace.sections.length >= 8)
  assert.ok(timeline.length >= 2)
  assert.ok(typeof metrics.blocked_campaigns === "number")
  console.log("  ✓ lead workspace, views, timeline, metrics")

  const readinessPayload = buildCommandCenterUnificationReadinessPayload()
  assert.equal(readinessPayload.no_outreach_execution, true)
  assert.equal(readinessPayload.autonomous_execution_enabled, false)
  console.log("  ✓ readiness diagnostics")

  const actionsRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/command-center-unification/actions/route.ts"),
    "utf8",
  )
  assert.ok(actionsRoute.includes("outreach_execution: false"))
  assert.ok(!actionsRoute.includes("enrollLeadInSequence"))
  console.log("  ✓ actions API — no outreach or enrollment")

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-command-center-unified-workspace.tsx"),
    "utf8",
  )
  assert.ok(uiSource.includes("View Details"))
  assert.ok(uiSource.includes("Mark Reviewed"))
  assert.ok(uiSource.includes("Open Related Item"))
  assert.ok(!uiSource.match(/\bSend\b/))
  assert.ok(!uiSource.includes("Launch"))
  assert.ok(!uiSource.includes("Enroll"))
  assert.ok(!uiSource.includes("Book Meeting"))
  console.log("  ✓ UI — human-gated actions only")

  const engineSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/command-center-unification/command-center-unification-engine.ts"),
    "utf8",
  )
  assert.ok(!engineSource.includes("openai"))
  assert.ok(!engineSource.includes("createEmbedding"))
  console.log("  ✓ engine — no LLM or vector DB")

  console.log("\nGS-6A local regression PASS\n")
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
  const { executeCommandCenterUnificationCertification } = await import(
    "../lib/growth/command-center-unification/command-center-unification-certification"
  )
  return executeCommandCenterUnificationCertification(admin, {})
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
          qa_marker: COMMAND_CENTER_UNIFICATION_QA_MARKER,
          hint: "Run pnpm test:command-center-unification:production for production certification",
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
