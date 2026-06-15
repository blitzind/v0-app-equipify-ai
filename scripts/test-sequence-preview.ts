/**
 * Phase GS-5B — Sequence Preview Studio certification.
 *
 * Local: pnpm test:sequence-preview
 * Production: pnpm test:sequence-preview:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { CAMPAIGN_READINESS_QA_MARKER } from "../lib/growth/campaign-readiness/campaign-readiness-types"
import { generateSequencePreview } from "../lib/growth/sequence-preview/sequence-preview-engine"
import { scoreSequencePreview } from "../lib/growth/sequence-preview/sequence-preview-priority"
import { buildSequencePreviewReadinessPayload } from "../lib/growth/sequence-preview/sequence-preview-route-gates"
import {
  SEQUENCE_PREVIEW_CONFIRM,
  SEQUENCE_PREVIEW_QA_MARKER,
  SEQUENCE_PREVIEW_STATUSES,
} from "../lib/growth/sequence-preview/sequence-preview-types"
import type { GrowthSequencePattern } from "../lib/growth/sequence-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function certPattern(): GrowthSequencePattern {
  return {
    id: "pat-local-1",
    key: "local_multichannel",
    label: "Local Multichannel Preview",
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
    confidenceScore: 60,
    computedAt: new Date().toISOString(),
    steps: [
      {
        id: "step-1",
        patternId: "pat-local-1",
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
      {
        id: "step-2",
        patternId: "pat-local-1",
        stepOrder: 2,
        channel: "voice_drop",
        delayDaysMin: 3,
        delayDaysMax: 4,
        generationType: null,
        playbookCategory: null,
        voiceDropCampaignId: null,
        requiredHumanApproval: true,
        expectedSignal: "call_connected",
      },
    ],
  }
}

function runLocalRegression(): void {
  console.log(`\n=== GS-5B local regression (${SEQUENCE_PREVIEW_QA_MARKER}) ===\n`)

  assert.equal(SEQUENCE_PREVIEW_QA_MARKER, "growth-sequence-preview-gs5b-v1")
  assert.equal(SEQUENCE_PREVIEW_CONFIRM, "RUN_SEQUENCE_PREVIEW_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/sequence-preview/sequence-preview-types.ts",
    "lib/growth/sequence-preview/sequence-preview-engine.ts",
    "lib/growth/sequence-preview/sequence-preview-priority.ts",
    "lib/growth/sequence-preview/sequence-preview-service.ts",
    "lib/growth/sequence-preview/sequence-preview-certification.ts",
    "lib/growth/sequence-preview/sequence-preview-route-gates.ts",
    "app/api/platform/growth/sequence-preview/route.ts",
    "app/api/platform/growth/sequence-preview/generate/route.ts",
    "app/api/platform/growth/sequence-preview/actions/route.ts",
    "components/growth/growth-sequence-preview-studio-panel.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-5B module files exist")

  const readiness = {
    qa_marker: CAMPAIGN_READINESS_QA_MARKER,
    assessment_id: "assess-1",
    subject_type: "prospect" as const,
    subject_ref: "lead-1",
    lead_id: "lead-1",
    company_name: "Acme HVAC",
    execution_run_id: null,
    generated_at: new Date().toISOString(),
    readiness_score: 60,
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

  const generated = generateSequencePreview({
    patterns: [certPattern()],
    campaign_readiness: readiness,
    lead_id: "lead-1",
    company_name: "Acme HVAC",
  })

  assert.ok(generated.previews.length >= 1)
  assert.equal(generated.requires_human_review, true)
  assert.equal(generated.autonomous_execution_enabled, false)
  for (const status of SEQUENCE_PREVIEW_STATUSES) {
    assert.ok(status in generated.status_counts)
  }
  console.log("  ✓ previews generated with statuses")

  const preview = generated.previews[0]!
  assert.ok(preview.steps.length >= 2)
  assert.ok(preview.steps.every((s) => s.scheduled_window_label.length > 0))
  assert.ok(preview.risks.length > 0)
  assert.ok(preview.approval_requirements.length > 0)
  console.log("  ✓ step timeline, risks, and approvals")

  assert.equal(scoreSequencePreview(preview), scoreSequencePreview(preview))
  console.log("  ✓ deterministic scoring")

  const readinessPayload = buildSequencePreviewReadinessPayload()
  assert.equal(readinessPayload.no_outreach_execution, true)
  assert.equal(readinessPayload.autonomous_execution_enabled, false)
  console.log("  ✓ readiness diagnostics")

  const actionsRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/sequence-preview/actions/route.ts"),
    "utf8",
  )
  assert.ok(actionsRoute.includes("outreach_execution: false"))
  assert.ok(!actionsRoute.includes("enrollLeadInSequence"))
  console.log("  ✓ actions API — no outreach or enrollment")

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-sequence-preview-studio-panel.tsx"),
    "utf8",
  )
  assert.ok(uiSource.includes("View Preview"))
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
    path.join(process.cwd(), "lib/growth/sequence-preview/sequence-preview-engine.ts"),
    "utf8",
  )
  assert.ok(!engineSource.includes("openai"))
  assert.ok(!engineSource.includes("createEmbedding"))
  console.log("  ✓ engine — no LLM or vector DB")

  console.log("\nGS-5B local regression PASS\n")
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
  const { executeSequencePreviewCertification } = await import(
    "../lib/growth/sequence-preview/sequence-preview-certification"
  )
  return executeSequencePreviewCertification(admin, {})
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
          qa_marker: SEQUENCE_PREVIEW_QA_MARKER,
          hint: "Run pnpm test:sequence-preview:production for production certification",
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
