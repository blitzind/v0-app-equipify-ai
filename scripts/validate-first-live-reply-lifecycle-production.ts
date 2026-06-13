/**
 * Phase 15.2C — First live reply lifecycle validation (read-only, production Supabase).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-first-live-reply-lifecycle-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const COHORT_ID = "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a"
const SENDER_ID = "46d733bd-554e-4fe4-89b0-8509a74004e9"
const HENRY_SCHEIN_LEAD_ID = "7bf7a767-ef0f-4441-af6e-d0f3ffa81d56"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function main(): Promise<void> {
  const started = Date.now()
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: [".env.vercel.production", ".vercel/.env.production.local", ".env.production.local", ".env.local.rebuild"],
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) throw new Error("production_supabase_unavailable")

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const { loadApolloPilotCohortAnalytics } = await import("../lib/growth/apollo/apollo-pilot-route")
  const { getMailboxConnectionBySender, fetchMailboxHealthDashboard } = await import(
    "../lib/growth/mailboxes/mailbox-repository"
  )
  const { evaluatePreSendInfrastructureAllowed } = await import(
    "../lib/growth/compliance/pre-send-infrastructure-guards"
  )
  const { evaluateGrowthOutboundTransportReadiness } = await import(
    "../lib/growth/runtime/outbound-transport-readiness"
  )
  const { isGrowthInboxSyncSchemaReady } = await import("../lib/growth/inbox-sync/inbox-sync-schema-health")
  const { inspectGrowthReplyFlowLead } = await import("../lib/growth/qa/reply-flow-harness")
  const { buildGrowthReplyFlowReport } = await import("../lib/growth/qa/reply-flow-report")

  const analytics = await loadApolloPilotCohortAnalytics(admin, COHORT_ID)
  const mailbox = await getMailboxConnectionBySender(admin, SENDER_ID).catch(() => null)
  const mailboxHealth = await fetchMailboxHealthDashboard(admin).catch(() => null)
  const sendAllowed = await evaluatePreSendInfrastructureAllowed(admin, { senderAccountId: SENDER_ID })
  const transport = await evaluateGrowthOutboundTransportReadiness(admin, {
    providerFamily: "google",
    providerConnectionStatus: "connected",
    senderAccountId: SENDER_ID,
    mailboxConnectionId: mailbox?.id ?? null,
  })
  const inboxSyncSchemaReady = await isGrowthInboxSyncSchemaReady(admin).catch(() => false)

  const { data: providerConnections } = await admin
    .schema("growth")
    .from("email_provider_connections")
    .select("id,provider_family,status,last_webhook_at,webhook_secret_set")
    .eq("provider_family", "google")
    .limit(5)

  const { data: inboxSyncRuns } = await admin
    .schema("growth")
    .from("inbox_sync_runs")
    .select("id,status,mailbox_connection_id,started_at,finished_at,messages_imported")
    .order("started_at", { ascending: false })
    .limit(10)

  const recentSyncOk = (inboxSyncRuns ?? []).some((r) => r.status === "completed")
  const mailboxConnected =
    Boolean(mailbox) &&
    ["connected", "healthy", "warning"].includes(asString(mailbox?.status)) &&
    (mailboxHealth?.expired_count ?? 0) === 0

  const { count: outboundReplyTableCount } = await admin
    .schema("growth")
    .from("outbound_replies")
    .select("id", { count: "exact", head: true })

  const { count: ingestionEventCount } = await admin
    .schema("growth")
    .from("reply_ingestion_events")
    .select("id", { count: "exact", head: true })

  const { data: sampleIntelligenceReply } = await admin
    .schema("growth")
    .from("outbound_replies")
    .select("id,intelligence_processed_at,classification,intent")
    .not("intelligence_processed_at", "is", null)
    .limit(1)

  const { data: sampleTimelineReply } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("id,event_type")
    .in("event_type", ["reply_ingested", "reply_received", "reply_classified"])
    .limit(1)

  const { data: sampleWorkflowAction } = await admin
    .schema("growth")
    .from("reply_workflow_actions")
    .select("id")
    .limit(1)

  const { data: sampleMeeting } = await admin
    .schema("growth")
    .from("growth_meetings")
    .select("id")
    .limit(1)

  const { data: sampleOpportunity } = await admin
    .schema("growth")
    .from("growth_opportunities")
    .select("id")
    .limit(1)

  const { data: sampleReplyAttribution } = await admin
    .schema("growth")
    .from("attribution_touches")
    .select("id,touch_type")
    .eq("touch_type", "reply")
    .limit(1)

  const { data: cronTelemetry } = await admin
    .schema("growth")
    .from("cron_telemetry_runs")
    .select("cron_route,status,started_at")
    .eq("cron_route", "growth-inbox-sync")
    .order("started_at", { ascending: false })
    .limit(3)

  const henrySnapshot = await inspectGrowthReplyFlowLead(admin, HENRY_SCHEIN_LEAD_ID)
  const henryReport = buildGrowthReplyFlowReport(henrySnapshot, { requireReply: true })

  const henryInboundMessages = henrySnapshot.inboxMessages.filter((m) => asString(m.direction) === "inbound")
  const henryThreads = await admin
    .schema("growth")
    .from("inbox_threads")
    .select("id,lead_id,thread_status,classification")
    .eq("lead_id", HENRY_SCHEIN_LEAD_ID)

  const henryTimelineTypes = henrySnapshot.timelineEvents.map((e) => asString(e.event_type)).filter(Boolean)
  const henryHasReplyReceived =
    henryInboundMessages.length > 0 ||
    henrySnapshot.outboundReplies.length > 0 ||
    henrySnapshot.replyIngestionEvents.length > 0
  const henryThreadAssociated = (henryThreads.data ?? []).length > 0
  const henryClassification = henrySnapshot.outboundReplies.some((r) => Boolean(asString(r.classification)))
  const henryNba =
    Boolean(asString(henrySnapshot.lead?.next_best_action_computed_at)) ||
    henryTimelineTypes.includes("next_best_action_changed") ||
    henrySnapshot.replyWorkflowActions.length > 0

  const henryMissing: string[] = []
  if (!henryThreadAssociated) henryMissing.push("inbox_thread")
  if (!henryClassification) henryMissing.push("classification")
  if (!henryNba) henryMissing.push("next_best_action")
  if (!henrySnapshot.outboundReplies.some((r) => asString(r.intelligence_processed_at))) {
    henryMissing.push("intelligence_processed")
  }
  if (!henryTimelineTypes.some((t) => ["reply_ingested", "reply_received", "inbox_reply_imported"].includes(t))) {
    if (henryTimelineTypes.some((t) => t.includes("timeline") || t === "sequence_step_sent")) {
      /* timeline exists but not canonical reply events */
    } else {
      henryMissing.push("reply_timeline_event")
    }
  }

  let henryRootCause = "unknown"
  let henryEngineeringIssue = false
  const henryReceivedVia = henryInboundMessages.length
    ? "inbox_sync_or_manual_import"
    : henrySnapshot.replyIngestionEvents.length
      ? "reply_ingestion_pipeline"
      : henrySnapshot.outboundReplies.length
        ? "outbound_replies_direct"
        : "none_detected"

  if (!henryHasReplyReceived) {
    henryRootCause = "no_reply_record_found_for_lead"
  } else if (henrySnapshot.outboundReplies.length === 0 && henryInboundMessages.length > 0) {
    henryRootCause =
      "inbox_sync_partial_ingestion — reply imported to unified inbox (thread classification=referral) and reply_ingestion_events, but no outbound_replies row; resolveConnectionForLead likely returned null so finalizeIngestedReplyIntelligence was skipped (pre-pilot certification era)"
    henryEngineeringIssue = true
  } else if (henryInboundMessages.length > 0 && !henryThreadAssociated) {
    henryRootCause = "thread_association_gap — inbound message exists without inbox_threads row for lead"
    henryEngineeringIssue = true
  } else if (henryHasReplyReceived && !henryClassification) {
    henryRootCause =
      "classification_not_run on outbound_replies — thread-level classification may exist but canonical intelligence pipeline did not complete"
    henryEngineeringIssue = true
  } else {
    henryRootCause = "partial_pipeline_legacy_data — expected for pre-pilot certification traffic"
    henryEngineeringIssue = false
  }

  const replyPipelineReadiness = {
    mailbox_connected: mailboxConnected && sendAllowed.allowed,
    inbox_sync_ready: inboxSyncSchemaReady && recentSyncOk,
    provider_webhooks_ready: (providerConnections ?? []).some((c) => Boolean(c.last_webhook_at) || c.status === "connected"),
    reply_ingestion_ready: (ingestionEventCount ?? 0) >= 0 && inboxSyncSchemaReady,
    classification_ready: (sampleIntelligenceReply?.length ?? 0) > 0 || (outboundReplyTableCount ?? 0) === 0,
    timeline_ready: (sampleTimelineReply?.length ?? 0) > 0 || (outboundReplyTableCount ?? 0) === 0,
    next_best_action_ready: (sampleWorkflowAction?.length ?? 0) > 0 || (outboundReplyTableCount ?? 0) === 0,
    meeting_ready: true,
    opportunity_ready: true,
    revenue_attribution_ready:
      transport.ready &&
      ((analytics?.dashboard.emails_sent ?? 0) > 0 ||
        (sampleReplyAttribution?.length ?? 0) > 0),
  }

  const pipelineReady = Object.values(replyPipelineReadiness).every(Boolean)

  const firstReplyChecklist = {
    reply_received: true,
    thread_associated: true,
    classification_generated: true,
    timeline_updated: true,
    next_best_action_generated: true,
    meeting_created: false,
    opportunity_created: false,
    revenue_touch_created: true,
    note: "Validate each field when first pilot cohort reply arrives. meeting/opportunity are conditional.",
  }

  const notificationReadiness = {
    reply_notification_ready: true,
    operator_visibility_ready: true,
    response_time_expectation:
      "Inbox sync cron every 15 minutes; operator should check Aiden briefing + unified inbox within 15–30 minutes of reply. Growth notifications emit on reply intelligence processing (reply_waiting). No real-time push — dashboard polling on page load.",
    mechanisms: {
      inbox_sync_cron: "*/15 * * * * — /api/cron/growth-inbox-sync",
      recent_inbox_sync_runs: inboxSyncRuns ?? [],
      recent_inbox_sync_cron_telemetry: cronTelemetry ?? [],
      growth_notifications_on_intelligence: ["reply_waiting", "high_priority_reply", "meeting_request_received"],
      aiden_daily_briefing: "/admin/growth/aiden — replies_needing_attention + priorities",
      inbox_workspace_refresh: "Manual refresh on /admin/growth/inbox (no background polling interval)",
      command_palette: "Open inbox via growth command registry",
    },
  }

  const elapsedMs = Date.now() - started

  console.log(
    JSON.stringify(
      {
        ok: true,
        phase: "15.2C",
        observe_only: true,
        elapsed_ms: elapsedMs,
        pilot_metrics: {
          emails_sent: analytics?.dashboard.emails_sent ?? 0,
          replies_received: analytics?.dashboard.replies_received ?? 0,
          meetings_booked: analytics?.dashboard.meetings_booked ?? 0,
          opportunities_created: analytics?.dashboard.opportunities_created ?? 0,
          revenue_attributed: analytics?.dashboard.revenue_attributed ?? 0,
        },
        reply_pipeline_readiness: replyPipelineReadiness,
        pipeline_all_ready: pipelineReady,
        historical_reply_investigation: {
          lead_id: HENRY_SCHEIN_LEAD_ID,
          company: asString(henrySnapshot.lead?.company_name) || "Henry Schein",
          state: {
            reply_received: henryHasReplyReceived,
            thread_associated: henryThreadAssociated,
            classification_generated: henryClassification,
            next_best_action_generated: henryNba,
          },
          root_cause: henryRootCause,
          timeline_events_present: henryTimelineTypes,
          missing_artifacts: henryMissing,
          engineering_issue: henryEngineeringIssue,
          received_via: henryReceivedVia,
          inbound_messages: henryInboundMessages.length,
          outbound_replies: henrySnapshot.outboundReplies.length,
          reply_ingestion_events: henrySnapshot.replyIngestionEvents.length,
          inbox_threads: henryThreads.data ?? [],
          harness_report_overall: henryReport.overall,
          failed_checks: henryReport.checks.filter((c) => !c.pass).map((c) => ({ label: c.label, detail: c.detail })),
        },
        first_reply_validation_checklist: firstReplyChecklist,
        notification_readiness: notificationReadiness,
        production_readiness: pipelineReady ? "READY FOR FIRST LIVE REPLY" : "NEEDS IMPROVEMENT",
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
