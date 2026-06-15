/**
 * Phase GS-5D — Campaign Builder Wizard certification.
 *
 * Local: pnpm test:campaign-builder
 * Production: pnpm test:campaign-builder:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { CAMPAIGN_READINESS_QA_MARKER } from "../lib/growth/campaign-readiness/campaign-readiness-types"
import { generateCampaignBuilderWizard } from "../lib/growth/campaign-builder/campaign-builder-engine"
import { scoreCampaignBuilderWizard } from "../lib/growth/campaign-builder/campaign-builder-priority"
import { buildCampaignBuilderReadinessPayload } from "../lib/growth/campaign-builder/campaign-builder-route-gates"
import {
  CAMPAIGN_BUILDER_CONFIRM,
  CAMPAIGN_BUILDER_QA_MARKER,
  CAMPAIGN_BUILDER_STATUSES,
  CAMPAIGN_BUILDER_STEP_IDS,
} from "../lib/growth/campaign-builder/campaign-builder-types"
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
    id: "pat-wiz-1",
    key: "local_campaign",
    label: "Local Campaign Pattern",
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
        patternId: "pat-wiz-1",
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
  console.log(`\n=== GS-5D local regression (${CAMPAIGN_BUILDER_QA_MARKER}) ===\n`)

  assert.equal(CAMPAIGN_BUILDER_QA_MARKER, "growth-campaign-builder-gs5d-v1")
  assert.equal(CAMPAIGN_BUILDER_CONFIRM, "RUN_CAMPAIGN_BUILDER_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/campaign-builder/campaign-builder-types.ts",
    "lib/growth/campaign-builder/campaign-builder-engine.ts",
    "lib/growth/campaign-builder/campaign-builder-priority.ts",
    "lib/growth/campaign-builder/campaign-builder-service.ts",
    "lib/growth/campaign-builder/campaign-builder-certification.ts",
    "lib/growth/campaign-builder/campaign-builder-route-gates.ts",
    "app/api/platform/growth/campaign-builder/route.ts",
    "app/api/platform/growth/campaign-builder/generate/route.ts",
    "app/api/platform/growth/campaign-builder/actions/route.ts",
    "components/growth/growth-campaign-builder-wizard-panel.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-5D module files exist")

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
  const generated = generateCampaignBuilderWizard({
    lead_id: "lead-1",
    company_name: "Acme HVAC",
    pattern_id: pattern.id,
    campaign_readiness: readiness,
    sequence_previews: previews.previews,
    patterns: [pattern],
  })

  assert.ok(generated.wizards.length >= 1)
  assert.equal(generated.requires_human_review, true)
  assert.equal(generated.autonomous_execution_enabled, false)
  for (const status of CAMPAIGN_BUILDER_STATUSES) {
    assert.ok(status in generated.status_counts)
  }
  console.log("  ✓ wizards generated with statuses")

  const wizard = generated.wizards[0]!
  assert.equal(wizard.steps.length, CAMPAIGN_BUILDER_STEP_IDS.length)
  assert.ok(wizard.configuration.recommended_channels.length > 0)
  assert.ok(wizard.configuration.suggested_sequence_structure.length > 0)
  assert.ok(wizard.approval_requirements.length > 0)
  assert.ok(wizard.risks.length > 0)
  console.log("  ✓ configuration, steps, channels, risks, approvals")

  assert.equal(scoreCampaignBuilderWizard(wizard), scoreCampaignBuilderWizard(wizard))
  console.log("  ✓ deterministic scoring")

  const readinessPayload = buildCampaignBuilderReadinessPayload()
  assert.equal(readinessPayload.no_outreach_execution, true)
  assert.equal(readinessPayload.autonomous_execution_enabled, false)
  console.log("  ✓ readiness diagnostics")

  const actionsRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/campaign-builder/actions/route.ts"),
    "utf8",
  )
  assert.ok(actionsRoute.includes("outreach_execution: false"))
  assert.ok(!actionsRoute.includes("enrollLeadInSequence"))
  console.log("  ✓ actions API — no outreach or enrollment")

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-campaign-builder-wizard-panel.tsx"),
    "utf8",
  )
  assert.ok(uiSource.includes("View Wizard"))
  assert.ok(uiSource.includes("Mark Reviewed"))
  assert.ok(uiSource.includes("Open Related Asset"))
  assert.ok(uiSource.includes("Dismiss"))
  assert.ok(!uiSource.match(/\bSend\b/))
  assert.ok(!uiSource.includes("Execute"))
  assert.ok(!uiSource.includes("Launch"))
  assert.ok(!uiSource.includes("Enroll"))
  assert.ok(!uiSource.includes("Book Meeting"))
  console.log("  ✓ UI — human-gated actions only")

  const engineSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/campaign-builder/campaign-builder-engine.ts"),
    "utf8",
  )
  assert.ok(!engineSource.includes("openai"))
  assert.ok(!engineSource.includes("createEmbedding"))
  console.log("  ✓ engine — no LLM or vector DB")

  console.log("\nGS-5D local regression PASS\n")
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
  const { executeCampaignBuilderCertification } = await import(
    "../lib/growth/campaign-builder/campaign-builder-certification"
  )
  return executeCampaignBuilderCertification(admin, {})
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
          qa_marker: CAMPAIGN_BUILDER_QA_MARKER,
          hint: "Run pnpm test:campaign-builder:production for production certification",
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
