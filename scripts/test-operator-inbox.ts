/**
 * Phase GS-1E — Unified Operator Inbox certification.
 *
 * Local: pnpm test:operator-inbox
 * Production: pnpm test:operator-inbox:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  aggregateOperatorInboxQueue,
  normalizeReplyWorkflowAction,
  normalizeSignalFeedItem,
} from "../lib/growth/operator-inbox/operator-inbox-aggregator"
import { rankOperatorInboxItems, scoreOperatorInboxItem } from "../lib/growth/operator-inbox/operator-inbox-priority"
import { buildOperatorInboxReadinessPayload } from "../lib/growth/operator-inbox/operator-inbox-route-gates"
import {
  OPERATOR_INBOX_CONFIRM,
  OPERATOR_INBOX_QA_MARKER,
} from "../lib/growth/operator-inbox/operator-inbox-types"
import { SIGNAL_FEED_QA_MARKER } from "../lib/growth/signal-intelligence/signal-feed-types"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function runLocalRegression(): void {
  console.log(`\n=== GS-1E local regression (${OPERATOR_INBOX_QA_MARKER}) ===\n`)

  assert.equal(OPERATOR_INBOX_QA_MARKER, "growth-operator-inbox-gs1e-v1")
  assert.equal(OPERATOR_INBOX_CONFIRM, "RUN_OPERATOR_INBOX_CERTIFICATION")
  console.log("  ✓ QA marker and confirm token")

  const requiredFiles = [
    "lib/growth/operator-inbox/operator-inbox-types.ts",
    "lib/growth/operator-inbox/operator-inbox-aggregator.ts",
    "lib/growth/operator-inbox/operator-inbox-priority.ts",
    "lib/growth/operator-inbox/operator-inbox-service.ts",
    "lib/growth/operator-inbox/operator-inbox-certification.ts",
    "lib/growth/operator-inbox/operator-inbox-route-gates.ts",
    "app/api/platform/growth/operator-inbox/route.ts",
    "app/api/platform/growth/operator-inbox/actions/route.ts",
    "components/growth/growth-operator-inbox-panel.tsx",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ GS-1E module files exist")

  const signalItem = normalizeSignalFeedItem({
    qa_marker: SIGNAL_FEED_QA_MARKER,
    id: "sig-1",
    audit_event_id: "audit-1",
    lead_id: "lead-1",
    company_name: "Acme HVAC",
    signal_type: "company_hiring",
    signal_label: "Hiring signal",
    source_domain: "company",
    confidence: 0.88,
    urgency: "high",
    signal_score: 80,
    occurred_at: new Date().toISOString(),
    recommended_action: "Review company hiring activity",
    expected_impact: "High meeting likelihood",
    reasoning: "Deterministic recommendation",
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
    title: "Reply review",
    summary: "Positive reply",
    createdAt: new Date().toISOString(),
    companyName: "Acme HVAC",
    replyIntent: "interested",
    replyNextAction: "schedule_call",
    replyBodyPreview: "Interested",
    replyReceivedAt: new Date().toISOString(),
    category: "interested",
  })

  const queue = aggregateOperatorInboxQueue({
    signals: [
      {
        ...signalItem,
        qa_marker: SIGNAL_FEED_QA_MARKER,
        id: "sig-1",
        audit_event_id: "audit-1",
        lead_id: "lead-1",
        company_name: "Acme HVAC",
        signal_type: "company_hiring",
        signal_label: "Hiring signal",
        source_domain: "company",
        confidence: 0.88,
        urgency: "high",
        signal_score: 80,
        occurred_at: new Date().toISOString(),
        recommended_action: "Review",
        expected_impact: "High",
        reasoning: "Test",
        priority: "high",
        status: "new",
        dedupe_hash: null,
        collapsed_count: 1,
        queue_hint: null,
        cta: { view_lead: null, review_company: null, open_timeline: null, review_sequence: null },
        requires_human_approval: true,
      },
    ],
    replyWorkflowActions: [
      {
        id: "wf-1",
        replyId: null,
        leadId: "lead-1",
        actionType: "mark_interested",
        actionStatus: "pending_review",
        severity: "high",
        title: "Reply review",
        summary: "Positive reply",
        createdAt: new Date().toISOString(),
        companyName: "Acme HVAC",
        replyIntent: "interested",
        replyNextAction: "schedule_call",
        replyBodyPreview: "Interested",
        replyReceivedAt: new Date().toISOString(),
        category: "interested",
      },
    ],
  })

  assert.ok(queue.items.length >= 2)
  assert.equal(queue.requires_human_review, true)
  assert.equal(queue.autonomous_execution_enabled, false)
  console.log("  ✓ queue aggregated with human review flags")

  assert.equal(scoreOperatorInboxItem(workflowItem), scoreOperatorInboxItem(workflowItem))
  const ranked = rankOperatorInboxItems([signalItem, workflowItem])
  assert.equal(ranked.length, 2)
  console.log("  ✓ deterministic priority scoring")

  const readiness = buildOperatorInboxReadinessPayload()
  assert.equal(readiness.no_outreach_execution, true)
  assert.equal(readiness.autonomous_execution_enabled, false)
  console.log("  ✓ readiness diagnostics — no outreach execution")

  const actionsRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/operator-inbox/actions/route.ts"),
    "utf8",
  )
  assert.ok(actionsRoute.includes("outreach_execution: false"))
  assert.ok(!actionsRoute.includes("sendSequence"))
  assert.ok(!actionsRoute.includes("executeOutreach"))
  console.log("  ✓ actions API — status-only, no outreach execution")

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-operator-inbox-panel.tsx"),
    "utf8",
  )
  assert.ok(uiSource.includes("Mark Reviewed"))
  assert.ok(!uiSource.includes("Send"))
  assert.ok(!uiSource.includes("Execute"))
  console.log("  ✓ UI — review actions only")

  console.log("\nGS-1E local regression PASS\n")
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
  const { executeOperatorInboxCertification } = await import(
    "../lib/growth/operator-inbox/operator-inbox-certification"
  )
  return executeOperatorInboxCertification(admin, {})
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
          qa_marker: OPERATOR_INBOX_QA_MARKER,
          hint: "Run pnpm test:operator-inbox:production for production certification",
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
