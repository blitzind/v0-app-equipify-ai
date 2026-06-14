/**
 * Phase GS-1B — Signal Event Router certification (local regression + production observe).
 *
 * Local:
 *   pnpm test:signal-event-router
 *
 * Production (Vercel production env only — no .env.local):
 *   pnpm test:signal-event-router:production
 */
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { REVENUE_PATH_HENRY_LEAD_ID } from "../lib/growth/qa/revenue-path-validation-types"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER,
  assertLeadSignalEventShape,
} from "../lib/growth/signal-intelligence/lead-signal-event-types"
import {
  buildMeetingBookedLeadSignalEvent,
  buildOpportunityCreatedLeadSignalEvent,
  buildReplyLeadSignalEvents,
} from "../lib/growth/signal-intelligence/lead-signal-producers"
import { buildLeadSignalDedupeHash } from "../lib/growth/signal-intelligence/signal-event-dedupe"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

type CertCheck = { id: string; pass: boolean; detail: Record<string, unknown> }

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10
}

function runLocalRegression(): void {
  console.log(`\n=== GS-1B local regression (${LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER}) ===\n`)

  assert.equal(LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER, "growth-signal-event-router-gs1b-v1")
  console.log("  ✓ QA marker")

  const requiredFiles = [
    "lib/growth/signal-intelligence/lead-signal-event-types.ts",
    "lib/growth/signal-intelligence/route-lead-signal-event.ts",
    "lib/growth/signal-intelligence/signal-event-dedupe.ts",
    "lib/growth/signal-intelligence/signal-event-scoring.ts",
    "lib/growth/signal-intelligence/signal-event-audit.ts",
    "lib/growth/signal-intelligence/lead-signal-producers.ts",
    "lib/growth/signal-intelligence/index.ts",
  ]
  for (const relativePath of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ signal-intelligence module files exist")

  const wiredProducers = [
    { file: "lib/growth/replies/finalize-ingested-reply-intelligence.ts", needle: "routeLeadSignalEvents" },
    { file: "lib/growth/meeting-intelligence/mutate-meeting.ts", needle: "buildMeetingBookedLeadSignalEvent" },
    { file: "lib/growth/opportunity-pipeline/mutate-opportunity.ts", needle: "buildOpportunityCreatedLeadSignalEvent" },
  ]
  for (const { file, needle } of wiredProducers) {
    const content = fs.readFileSync(path.join(process.cwd(), file), "utf8")
    assert.ok(content.includes(needle), `${file} missing ${needle}`)
  }
  console.log("  ✓ reply/meeting/opportunity producers wired")

  const replyEvents = buildReplyLeadSignalEvents({
    leadId: "lead-test",
    replyId: "reply-test",
    intent: "meeting_request",
    confidence: 0.82,
  })
  assert.ok(replyEvents.some((e) => e.signalType === "reply_received"))
  assert.ok(replyEvents.some((e) => e.signalType === "meeting_requested"))
  assert.ok(replyEvents.some((e) => e.signalType === "positive_reply"))
  for (const event of replyEvents) assertLeadSignalEventShape(event)
  console.log("  ✓ reply producer builds multi-signal batch")

  const meetingEvent = buildMeetingBookedLeadSignalEvent({
    leadId: "lead-test",
    meetingId: "meeting-test",
  })
  const hashA = buildLeadSignalDedupeHash(meetingEvent)
  const hashB = buildLeadSignalDedupeHash(meetingEvent)
  assert.equal(hashA, hashB)
  assert.equal(hashA.length, 64)
  console.log("  ✓ dedupe hash is stable SHA-256")

  console.log("\n  Local regression: PASS\n")
}

async function fetchSignalAuditRow(
  admin: SupabaseClient,
  auditEventId: string | null,
): Promise<Record<string, unknown> | null> {
  if (!auditEventId) return null
  const { data } = await admin
    .schema("growth")
    .from("signal_events")
    .select("id, event_type, event_payload, occurred_at")
    .eq("id", auditEventId)
    .maybeSingle()
  return (data as Record<string, unknown> | null) ?? null
}

async function countRouterTimelineEvents(
  admin: SupabaseClient,
  leadId: string,
  signalType: string,
  sinceIso: string,
): Promise<number> {
  const { data } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("id, payload, occurred_at")
    .eq("lead_id", leadId)
    .gte("occurred_at", sinceIso)
    .order("occurred_at", { ascending: false })
    .limit(50)

  return (data ?? []).filter((row) => {
    const payload = row.payload as Record<string, unknown> | null
    return (
      payload?.qa_marker === LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER &&
      payload?.signal_type === signalType
    )
  }).length
}

async function runProductionCertification(): Promise<{
  ok: boolean
  checks: CertCheck[]
  certification_pct: number
}> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })

  if (!boot) {
    return {
      ok: false,
      checks: [{ id: "production_env", pass: false, detail: { error: "supabase_unavailable" } }],
      certification_pct: 0,
    }
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { routeLeadSignalEvent } = await import("../lib/growth/signal-intelligence/route-lead-signal-event")
  const leadId = REVENUE_PATH_HENRY_LEAD_ID
  const runStartedAt = new Date().toISOString()
  const checks: CertCheck[] = []

  // Reply signal
  const replyId = randomUUID()
  const replyEvent = buildReplyLeadSignalEvents({
    leadId,
    replyId,
    intent: "positive_interest",
    confidence: 0.88,
    occurredAt: runStartedAt,
  })[0]!

  const replyResult = await routeLeadSignalEvent(admin, replyEvent)
  const replyAudit = await fetchSignalAuditRow(admin, replyResult.audit_event_id)
  const replyTimelineCount = await countRouterTimelineEvents(
    admin,
    leadId,
    "reply_received",
    runStartedAt,
  )

  checks.push({
    id: "reply_event_audit_timeline_recompute",
    pass:
      !replyResult.duplicate &&
      replyResult.audit_event_id !== null &&
      replyAudit?.event_type === "routed" &&
      replyTimelineCount >= 1 &&
      replyResult.recompute_succeeded,
    detail: {
      audit_event_id: replyResult.audit_event_id,
      timeline_count: replyTimelineCount,
      recompute_succeeded: replyResult.recompute_succeeded,
      dedupe_hash: replyResult.dedupe_hash,
    },
  })

  const replyDuplicate = await routeLeadSignalEvent(admin, replyEvent)
  const duplicateAudit = await fetchSignalAuditRow(admin, replyDuplicate.audit_event_id)
  checks.push({
    id: "duplicate_events_ignored",
    pass:
      replyDuplicate.duplicate &&
      replyDuplicate.timeline_emitted === false &&
      duplicateAudit?.event_type === "rejected_duplicate",
    detail: {
      duplicate: replyDuplicate.duplicate,
      audit_event_id: replyDuplicate.audit_event_id,
      audit_event_type: duplicateAudit?.event_type ?? null,
    },
  })

  // Meeting signal
  const meetingId = randomUUID()
  const meetingResult = await routeLeadSignalEvent(
    admin,
    buildMeetingBookedLeadSignalEvent({ leadId, meetingId, occurredAt: runStartedAt }),
  )
  const meetingAudit = await fetchSignalAuditRow(admin, meetingResult.audit_event_id)
  const meetingTimelineCount = await countRouterTimelineEvents(
    admin,
    leadId,
    "meeting_booked",
    runStartedAt,
  )

  checks.push({
    id: "meeting_event_audit_timeline_recompute",
    pass:
      meetingResult.audit_event_id !== null &&
      meetingAudit?.event_type === "routed" &&
      meetingTimelineCount >= 1 &&
      meetingResult.recompute_succeeded,
    detail: {
      audit_event_id: meetingResult.audit_event_id,
      timeline_count: meetingTimelineCount,
      recompute_succeeded: meetingResult.recompute_succeeded,
    },
  })

  // Opportunity signal
  const opportunityId = randomUUID()
  const opportunityResult = await routeLeadSignalEvent(
    admin,
    buildOpportunityCreatedLeadSignalEvent({ leadId, opportunityId, occurredAt: runStartedAt }),
  )
  const opportunityAudit = await fetchSignalAuditRow(admin, opportunityResult.audit_event_id)
  const opportunityTimelineCount = await countRouterTimelineEvents(
    admin,
    leadId,
    "opportunity_created",
    runStartedAt,
  )

  checks.push({
    id: "opportunity_event_audit_timeline_recompute",
    pass:
      opportunityResult.audit_event_id !== null &&
      opportunityAudit?.event_type === "routed" &&
      opportunityTimelineCount >= 1 &&
      opportunityResult.recompute_succeeded,
    detail: {
      audit_event_id: opportunityResult.audit_event_id,
      timeline_count: opportunityTimelineCount,
      recompute_succeeded: opportunityResult.recompute_succeeded,
    },
  })

  // Failed recompute preserves audit (forced failure via cert-only metadata flag)
  const forcedFailEvent = {
    ...buildReplyLeadSignalEvents({
      leadId,
      replyId: randomUUID(),
      intent: "not_interested",
      confidence: 0.5,
      occurredAt: runStartedAt,
    })[0]!,
    metadata: { __gs1b_force_recompute_fail: true },
  }
  const forcedFailResult = await routeLeadSignalEvent(admin, forcedFailEvent)
  const forcedFailAudit = await fetchSignalAuditRow(admin, forcedFailResult.audit_event_id)

  checks.push({
    id: "failed_recompute_preserves_audit",
    pass:
      forcedFailResult.audit_event_id !== null &&
      forcedFailAudit?.event_type === "routed" &&
      forcedFailResult.recompute_succeeded === false,
    detail: {
      audit_event_id: forcedFailResult.audit_event_id,
      recompute_succeeded: forcedFailResult.recompute_succeeded,
    },
  })

  const passCount = checks.filter((c) => c.pass).length
  const certification_pct = pct(passCount, checks.length)

  return {
    ok: passCount === checks.length,
    checks,
    certification_pct,
  }
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
          qa_marker: LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER,
          hint: "Run pnpm test:signal-event-router:production for production certification",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== GS-1B production certification (${LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER}) ===\n`)

  const production = await runProductionCertification()
  const report = {
    phase: "GS-1B",
    qa_marker: LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER,
    henry_lead_id: REVENUE_PATH_HENRY_LEAD_ID,
    certification_pct: production.certification_pct,
    certification_checks: production.checks,
    final_verdict: production.ok ? "PASS" : "FAIL",
  }

  console.log(JSON.stringify(report, null, 2))

  if (!production.ok) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
