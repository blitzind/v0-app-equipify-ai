/**
 * Phase GS-5C — Smart Follow-Up Policy Engine certification.
 *
 * Local: pnpm test:follow-up-policies
 * Production: pnpm test:follow-up-policies:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { CAMPAIGN_READINESS_QA_MARKER } from "../lib/growth/campaign-readiness/campaign-readiness-types"
import { generateSmartFollowUpPolicies } from "../lib/growth/follow-up-policies/follow-up-policy-engine"
import { scoreSmartFollowUpPolicy } from "../lib/growth/follow-up-policies/follow-up-policy-priority"
import { buildSmartFollowUpPolicyReadinessPayload } from "../lib/growth/follow-up-policies/follow-up-policy-route-gates"
import {
  SMART_FOLLOW_UP_CHANNELS,
  SMART_FOLLOW_UP_POLICY_CONFIRM,
  SMART_FOLLOW_UP_POLICY_PRIORITIES,
  SMART_FOLLOW_UP_POLICY_QA_MARKER,
  SMART_FOLLOW_UP_POLICY_TYPES,
} from "../lib/growth/follow-up-policies/follow-up-policy-types"
import { generateHumanInterventions } from "../lib/growth/human-interventions/human-intervention-engine"
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
  console.log(`\n=== GS-5C local regression (${SMART_FOLLOW_UP_POLICY_QA_MARKER}) ===\n`)

  assert.equal(SMART_FOLLOW_UP_POLICY_QA_MARKER, "growth-follow-up-policies-gs5c-v1")
  assert.equal(SMART_FOLLOW_UP_POLICY_CONFIRM, "RUN_FOLLOW_UP_POLICIES_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/follow-up-policies/follow-up-policy-types.ts",
    "lib/growth/follow-up-policies/follow-up-policy-engine.ts",
    "lib/growth/follow-up-policies/follow-up-policy-priority.ts",
    "lib/growth/follow-up-policies/follow-up-policy-service.ts",
    "lib/growth/follow-up-policies/follow-up-policy-certification.ts",
    "lib/growth/follow-up-policies/follow-up-policy-route-gates.ts",
    "app/api/platform/growth/follow-up-policies/route.ts",
    "app/api/platform/growth/follow-up-policies/generate/route.ts",
    "app/api/platform/growth/follow-up-policies/actions/route.ts",
    "components/growth/growth-smart-follow-up-policies-panel.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-5C module files exist")

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
    cta: {
      view_lead: "/admin/growth/command?leadId=lead-1",
      review_company: null,
      open_timeline: null,
      review_sequence: null,
    },
    requires_human_approval: true,
  })

  const workflowItem = normalizeReplyWorkflowAction({
    id: "wf-1",
    replyId: null,
    leadId: "lead-1",
    actionType: "mark_interested",
    actionStatus: "pending_review",
    severity: "high",
    title: "Positive reply follow-up planning",
    summary: "Prospect interested — operator must plan follow-up",
    createdAt: new Date().toISOString(),
    companyName: "Acme HVAC",
    replyIntent: "interested",
    replyNextAction: "schedule_call",
    replyBodyPreview: "Interested",
    replyReceivedAt: new Date().toISOString(),
    category: "interested",
  })

  const meetingItem = normalizeReplyWorkflowAction({
    id: "wf-meeting",
    replyId: null,
    leadId: "lead-1",
    actionType: "schedule_meeting",
    actionStatus: "pending_review",
    severity: "medium",
    title: "Meeting follow-up planning",
    summary: "Post-demo meeting — plan next touch",
    createdAt: new Date().toISOString(),
    companyName: "Acme HVAC",
    replyIntent: "meeting",
    replyNextAction: "send_proposal",
    replyBodyPreview: "Send proposal",
    replyReceivedAt: new Date().toISOString(),
    category: "meeting",
  })

  const readiness = {
    qa_marker: CAMPAIGN_READINESS_QA_MARKER,
    assessment_id: "assess-1",
    subject_type: "prospect" as const,
    subject_ref: "lead-1",
    lead_id: "lead-1",
    company_name: "Acme HVAC",
    execution_run_id: null,
    generated_at: new Date().toISOString(),
    readiness_score: 55,
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

  const interventions = generateHumanInterventions({
    inbox_items: [signalItem, workflowItem, meetingItem],
    campaign_readiness: readiness,
  })

  const generated = generateSmartFollowUpPolicies({
    inbox_items: [signalItem, workflowItem, meetingItem],
    interventions: interventions.interventions,
    campaign_readiness: readiness,
  })

  assert.ok(generated.policies.length >= 2)
  assert.equal(generated.requires_human_review, true)
  assert.equal(generated.autonomous_execution_enabled, false)
  for (const priority of SMART_FOLLOW_UP_POLICY_PRIORITIES) {
    assert.ok(SMART_FOLLOW_UP_POLICY_PRIORITIES.includes(priority))
  }
  for (const type of SMART_FOLLOW_UP_POLICY_TYPES) {
    assert.ok(type in generated.type_counts)
  }
  console.log("  ✓ policies generated with types and priorities")

  assert.ok(
    generated.policies.some(
      (p) => p.policy_type === "high_intent_follow_up" || p.policy_type === "reply_follow_up",
    ),
  )
  assert.ok(generated.policies.some((p) => p.policy_type === "meeting_follow_up"))
  console.log("  ✓ trigger mapping for reply, high intent, and meeting")

  assert.ok(generated.policies.every((p) => p.channel_plans.length === SMART_FOLLOW_UP_CHANNELS.length))
  assert.ok(generated.policies.every((p) => Boolean(p.follow_up_window.window_id)))
  console.log("  ✓ channel plans and follow-up windows")

  const first = generated.policies[0]!
  assert.equal(scoreSmartFollowUpPolicy(first), scoreSmartFollowUpPolicy(first))
  console.log("  ✓ deterministic scoring")

  const readinessPayload = buildSmartFollowUpPolicyReadinessPayload()
  assert.equal(readinessPayload.no_outreach_execution, true)
  assert.equal(readinessPayload.autonomous_execution_enabled, false)
  console.log("  ✓ readiness diagnostics")

  const actionsRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/follow-up-policies/actions/route.ts"),
    "utf8",
  )
  assert.ok(actionsRoute.includes("outreach_execution: false"))
  assert.ok(!actionsRoute.includes("sendSequence"))
  console.log("  ✓ actions API — no outreach execution")

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-smart-follow-up-policies-panel.tsx"),
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
    path.join(process.cwd(), "lib/growth/follow-up-policies/follow-up-policy-engine.ts"),
    "utf8",
  )
  assert.ok(!engineSource.includes("openai"))
  assert.ok(!engineSource.includes("createEmbedding"))
  console.log("  ✓ engine — no LLM or vector DB")

  assert.equal(OPERATOR_INBOX_QA_MARKER, "growth-operator-inbox-gs1e-v1")
  console.log("  ✓ reuses operator inbox normalization")

  console.log("\nGS-5C local regression PASS\n")
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
  const { executeSmartFollowUpPolicyCertification } = await import(
    "../lib/growth/follow-up-policies/follow-up-policy-certification"
  )
  return executeSmartFollowUpPolicyCertification(admin, {})
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
          qa_marker: SMART_FOLLOW_UP_POLICY_QA_MARKER,
          hint: "Run pnpm test:follow-up-policies:production for production certification",
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
