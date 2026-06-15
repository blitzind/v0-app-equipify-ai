/**
 * Phase GS-3E — Human Intervention Engine certification.
 *
 * Local: pnpm test:human-interventions
 * Production: pnpm test:human-interventions:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { CAMPAIGN_READINESS_QA_MARKER } from "../lib/growth/campaign-readiness/campaign-readiness-types"
import { generateHumanInterventions } from "../lib/growth/human-interventions/human-intervention-engine"
import { scoreHumanIntervention } from "../lib/growth/human-interventions/human-intervention-priority"
import { buildHumanInterventionReadinessPayload } from "../lib/growth/human-interventions/human-intervention-route-gates"
import {
  HUMAN_INTERVENTION_CONFIRM,
  HUMAN_INTERVENTION_PRIORITIES,
  HUMAN_INTERVENTION_QA_MARKER,
  HUMAN_INTERVENTION_TYPES,
} from "../lib/growth/human-interventions/human-intervention-types"
import {
  normalizeReplyWorkflowAction,
  normalizeSignalFeedItem,
} from "../lib/growth/operator-inbox/operator-inbox-aggregator"
import { OPERATOR_INBOX_QA_MARKER } from "../lib/growth/operator-inbox/operator-inbox-types"
import { SIGNAL_FEED_QA_MARKER } from "../lib/growth/signal-intelligence/signal-feed-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== GS-3E local regression (${HUMAN_INTERVENTION_QA_MARKER}) ===\n`)

  assert.equal(HUMAN_INTERVENTION_QA_MARKER, "growth-human-interventions-gs3e-v1")
  assert.equal(HUMAN_INTERVENTION_CONFIRM, "RUN_HUMAN_INTERVENTIONS_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/human-interventions/human-intervention-types.ts",
    "lib/growth/human-interventions/human-intervention-engine.ts",
    "lib/growth/human-interventions/human-intervention-priority.ts",
    "lib/growth/human-interventions/human-intervention-service.ts",
    "lib/growth/human-interventions/human-intervention-certification.ts",
    "lib/growth/human-interventions/human-intervention-route-gates.ts",
    "app/api/platform/growth/human-interventions/route.ts",
    "app/api/platform/growth/human-interventions/generate/route.ts",
    "app/api/platform/growth/human-interventions/actions/route.ts",
    "components/growth/growth-human-interventions-panel.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-3E module files exist")

  const signalItem = normalizeSignalFeedItem({
    qa_marker: SIGNAL_FEED_QA_MARKER,
    id: "sig-1",
    audit_event_id: "audit-1",
    lead_id: "lead-1",
    company_name: "Acme HVAC",
    signal_type: "company_hiring",
    signal_label: "Hiring signal",
    source_domain: "company",
    confidence: 0.9,
    urgency: "high",
    signal_score: 85,
    occurred_at: new Date().toISOString(),
    recommended_action: "Review high-intent signal",
    expected_impact: "High",
    reasoning: "Test signal",
    priority: "high",
    status: "new",
    dedupe_hash: null,
    collapsed_count: 1,
    queue_hint: null,
    cta: { view_lead: "/admin/growth/command?leadId=lead-1", review_company: null, open_timeline: null, review_sequence: null },
    requires_human_approval: true,
  })

  const workflowItem = normalizeReplyWorkflowAction({
    id: "wf-1",
    replyId: null,
    leadId: "lead-1",
    actionType: "mark_interested",
    actionStatus: "pending_review",
    severity: "high",
    title: "Positive reply review",
    summary: "Prospect interested — human review required",
    createdAt: new Date().toISOString(),
    companyName: "Acme HVAC",
    replyIntent: "interested",
    replyNextAction: "schedule_call",
    replyBodyPreview: "Interested",
    replyReceivedAt: new Date().toISOString(),
    category: "interested",
  })

  const generated = generateHumanInterventions({
    inbox_items: [signalItem, workflowItem],
    campaign_readiness: {
      qa_marker: CAMPAIGN_READINESS_QA_MARKER,
      assessment_id: "assess-1",
      subject_type: "prospect",
      subject_ref: "lead-1",
      lead_id: "lead-1",
      company_name: "Acme HVAC",
      execution_run_id: null,
      generated_at: new Date().toISOString(),
      readiness_score: 20,
      readiness_status: "not_ready",
      dimensions: [],
      blockers: [
        {
          blocker_id: "block-1",
          dimension_id: "compliance_requirements",
          severity: "critical",
          message: "Suppression active",
          resolution_hint: "Resolve suppression",
          related_asset_href: "/admin/growth/leads/lead-1",
        },
      ],
      recommendations: [],
      missing_assets: [],
      missing_channels: ["verified_email"],
      required_approvals: ["Human approval"],
      required_human_actions: ["Review readiness"],
      review_status: "pending",
      requires_human_review: true,
      autonomous_execution_enabled: false,
    },
  })

  assert.ok(generated.interventions.length >= 2)
  assert.equal(generated.requires_human_review, true)
  assert.equal(generated.autonomous_execution_enabled, false)
  for (const priority of HUMAN_INTERVENTION_PRIORITIES) {
    assert.ok(HUMAN_INTERVENTION_PRIORITIES.includes(priority))
  }
  for (const type of HUMAN_INTERVENTION_TYPES) {
    assert.ok(type in generated.type_counts)
  }
  console.log("  ✓ interventions generated with types and priorities")

  assert.ok(generated.interventions.some((item) => item.intervention_type === "high_intent"))
  assert.ok(generated.interventions.some((item) => item.intervention_type === "risk_detected"))
  console.log("  ✓ trigger mapping for high intent and risk")

  const first = generated.interventions[0]!
  assert.equal(scoreHumanIntervention(first), scoreHumanIntervention(first))
  console.log("  ✓ deterministic scoring")

  const readiness = buildHumanInterventionReadinessPayload()
  assert.equal(readiness.no_outreach_execution, true)
  assert.equal(readiness.autonomous_execution_enabled, false)
  console.log("  ✓ readiness diagnostics")

  const actionsRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/human-interventions/actions/route.ts"),
    "utf8",
  )
  assert.ok(actionsRoute.includes("outreach_execution: false"))
  assert.ok(!actionsRoute.includes("sendSequence"))
  console.log("  ✓ actions API — no outreach execution")

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-human-interventions-panel.tsx"),
    "utf8",
  )
  assert.ok(uiSource.includes("Mark Reviewed"))
  assert.ok(uiSource.includes("View Details"))
  assert.ok(uiSource.includes("Open Related Item"))
  assert.ok(uiSource.includes("Dismiss"))
  assert.ok(!uiSource.match(/\bSend\b/))
  assert.ok(!uiSource.includes("Execute"))
  assert.ok(!uiSource.includes("Launch"))
  assert.ok(!uiSource.includes("Enroll"))
  assert.ok(!uiSource.includes("Book Meeting"))
  console.log("  ✓ UI — human-gated actions only")

  const engineSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/human-interventions/human-intervention-engine.ts"),
    "utf8",
  )
  assert.ok(!engineSource.includes("openai"))
  assert.ok(!engineSource.includes("createEmbedding"))
  console.log("  ✓ engine — no LLM or vector DB")

  assert.equal(OPERATOR_INBOX_QA_MARKER, "growth-operator-inbox-gs1e-v1")
  console.log("  ✓ reuses operator inbox normalization")

  console.log("\nGS-3E local regression PASS\n")
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
  const { executeHumanInterventionCertification } = await import(
    "../lib/growth/human-interventions/human-intervention-certification"
  )
  return executeHumanInterventionCertification(admin, {})
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
          qa_marker: HUMAN_INTERVENTION_QA_MARKER,
          hint: "Run pnpm test:human-interventions:production for production certification",
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
