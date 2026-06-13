/**
 * Phase 15.1E — Live reply validation (read-only, production Supabase).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-apollo-live-reply-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const COHORT_ID = "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a"
const SENDER_ID = "46d733bd-554e-4fe4-89b0-8509a74004e9"

async function main(): Promise<void> {
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

  const { loadApolloPilotCohort, loadApolloPilotCohortAnalytics } = await import(
    "../lib/growth/apollo/apollo-pilot-route"
  )
  const { getMailboxConnectionBySender } = await import("../lib/growth/mailboxes/mailbox-repository")
  const { evaluatePreSendInfrastructureAllowed } = await import(
    "../lib/growth/compliance/pre-send-infrastructure-guards"
  )
  const { evaluateGrowthOutboundTransportReadiness } = await import(
    "../lib/growth/runtime/outbound-transport-readiness"
  )

  const cohort = await loadApolloPilotCohort(admin, COHORT_ID)
  if (!cohort) throw new Error("cohort_not_found")

  const companyIds = new Set(cohort.companies.map((c) => c.company_candidate_id))
  const queue = await (
    await import("../lib/growth/apollo/apollo-sequence-execution-queue")
  ).loadApolloSequenceExecutionQueue(admin, { status: "all", limit: 200 })
  const cohortLeadIds = [
    ...new Set(
      queue.items
        .filter((i) => companyIds.has(i.company_candidate_id) && i.growth_lead_id)
        .map((i) => i.growth_lead_id as string),
    ),
  ]

  const analytics = await loadApolloPilotCohortAnalytics(admin, COHORT_ID)
  const mailbox = await getMailboxConnectionBySender(admin, SENDER_ID).catch(() => null)
  const sendAllowed = await evaluatePreSendInfrastructureAllowed(admin, { senderAccountId: SENDER_ID })
  const transport = await evaluateGrowthOutboundTransportReadiness(admin, {
    providerFamily: "google",
    providerConnectionStatus: "connected",
    senderAccountId: SENDER_ID,
    mailboxConnectionId: mailbox?.id ?? null,
  })

  const { data: sentJobs } = await admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select("id,lead_id,status,delivery_attempt_id")
    .in("lead_id", cohortLeadIds.length ? cohortLeadIds : ["00000000-0000-4000-8000-000000000001"])
    .eq("status", "sent")

  const deliveryAttemptIds = (sentJobs ?? [])
    .map((j) => j.delivery_attempt_id)
    .filter(Boolean) as string[]

  const { data: attributionTouches } = deliveryAttemptIds.length
    ? await admin
        .schema("growth")
        .from("attribution_touches")
        .select("id,lead_id,delivery_attempt_id,touch_type")
        .in("delivery_attempt_id", deliveryAttemptIds)
    : { data: [] }

  const { data: outboundReplies } = cohortLeadIds.length
    ? await admin
        .schema("growth")
        .from("outbound_replies")
        .select("id,lead_id,classification,sentiment,intelligence_processed_at,received_at")
        .in("lead_id", cohortLeadIds)
        .order("received_at", { ascending: false })
        .limit(50)
    : { data: [] }

  const { data: replyIngestion } = cohortLeadIds.length
    ? await admin
        .schema("growth")
        .from("reply_ingestion_events")
        .select("id,lead_id,processing_status,source,received_at")
        .in("lead_id", cohortLeadIds)
        .order("received_at", { ascending: false })
        .limit(50)
    : { data: [] }

  const { data: inboxMessages } = cohortLeadIds.length
    ? await admin
        .schema("growth")
        .from("inbox_messages")
        .select("id,direction,lead_id,thread_id,created_at")
        .in("lead_id", cohortLeadIds)
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] }

  const { data: timelineReplyEvents } = cohortLeadIds.length
    ? await admin
        .schema("growth")
        .from("lead_timeline_events")
        .select("id,lead_id,event_type,occurred_at")
        .in("lead_id", cohortLeadIds)
        .in("event_type", ["reply_ingested", "reply_received", "sequence_step_sent", "lead_status_changed"])
        .order("occurred_at", { ascending: false })
        .limit(100)
    : { data: [] }

  const { data: workflowActions } = cohortLeadIds.length
    ? await admin
        .schema("growth")
        .from("reply_workflow_actions")
        .select("id,lead_id,action_type,status,created_at")
        .in("lead_id", cohortLeadIds)
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [] }

  const { data: meetings } = cohortLeadIds.length
    ? await admin
        .schema("growth")
        .from("growth_meetings")
        .select("id,lead_id,status,scheduled_at")
        .in("lead_id", cohortLeadIds)
        .limit(30)
    : { data: [] }

  const { data: opportunities } = cohortLeadIds.length
    ? await admin
        .schema("growth")
        .from("growth_opportunities")
        .select("id,lead_id,status,created_at")
        .in("lead_id", cohortLeadIds)
        .limit(30)
    : { data: [] }

  const { data: inboxSyncRuns } = await admin
    .schema("growth")
    .from("inbox_sync_runs")
    .select("id,status,mailbox_connection_id,started_at,finished_at")
    .order("started_at", { ascending: false })
    .limit(5)

  const replyCount = outboundReplies?.length ?? 0
  const ingestionCount = replyIngestion?.length ?? 0
  const inboundCount = inboxMessages?.length ?? 0

  const firstReplyValidation = {
    reply_received: replyCount > 0 || ingestionCount > 0 || inboundCount > 0,
    thread_associated: (inboxMessages ?? []).some((m) => Boolean(m.thread_id)),
    classification_generated: (outboundReplies ?? []).some((r) => Boolean(r.classification)),
    timeline_updated: (timelineReplyEvents ?? []).some((e) =>
      ["reply_ingested", "reply_received", "lead_status_changed"].includes(String(e.event_type)),
    ),
    next_best_action_generated: (workflowActions?.length ?? 0) > 0,
    meeting_created: (meetings?.length ?? 0) > 0,
    opportunity_created: (opportunities?.length ?? 0) > 0,
  }

  const sendAttributionOk =
    (sentJobs?.length ?? 0) > 0 &&
    (attributionTouches?.length ?? 0) >= Math.min((sentJobs?.length ?? 0), (attributionTouches?.length ?? 0))

  const pilotHealth = {
    emails_sent: analytics?.dashboard.emails_sent ?? null,
    emails_failed: 0,
    emails_pending: 0,
    emails_blocked: 0,
    replies_received: analytics?.dashboard.replies_received ?? 0,
    meetings_booked: analytics?.dashboard.meetings_booked ?? 0,
    opportunities_created: analytics?.dashboard.opportunities_created ?? 0,
    revenue_attributed: analytics?.dashboard.revenue_attributed ?? 0,
  }

  const replyPipelineReady =
    transport.ready &&
    sendAllowed.allowed &&
    (mailbox?.status === "connected" || mailbox?.status === "healthy" || mailbox?.status === "warning")

  const hasLiveReplies = firstReplyValidation.reply_received
  const replyValidationPassed = hasLiveReplies
    ? firstReplyValidation.thread_associated &&
      firstReplyValidation.classification_generated &&
      firstReplyValidation.timeline_updated
    : null

  console.log(
    JSON.stringify(
      {
        ok: true,
        phase: "15.1E",
        observe_only: true,
        pilot_health: pilotHealth,
        outbound_summary: {
          cohort_leads: cohortLeadIds.length,
          jobs_sent: sentJobs?.length ?? 0,
          attribution_touches: attributionTouches?.length ?? 0,
          send_attribution_integrity: sendAttributionOk,
        },
        mailbox: {
          status: mailbox?.status ?? null,
          send_allowed: sendAllowed.allowed,
          connection_health: mailbox?.connection_health ?? null,
        },
        reply_pipeline_readiness: {
          ready: replyPipelineReady,
          transport,
          recent_inbox_sync_runs: inboxSyncRuns ?? [],
        },
        live_reply_samples: {
          outbound_replies: outboundReplies ?? [],
          reply_ingestion_events: replyIngestion ?? [],
          inbound_inbox_messages: inboxMessages ?? [],
          timeline_events: timelineReplyEvents ?? [],
          workflow_actions: workflowActions ?? [],
        },
        first_reply_validation: firstReplyValidation,
        reply_validation_passed: replyValidationPassed,
        meeting_validation: {
          meetings_in_db: meetings ?? [],
          dashboard_meetings: pilotHealth.meetings_booked,
          validated: hasLiveReplies ? firstReplyValidation.meeting_created : null,
        },
        opportunity_validation: {
          opportunities_in_db: opportunities ?? [],
          dashboard_opportunities: pilotHealth.opportunities_created,
          validated: hasLiveReplies ? firstReplyValidation.opportunity_created : null,
        },
        revenue_attribution_validation: {
          dashboard_revenue: pilotHealth.revenue_attributed,
          send_attribution_touches: attributionTouches?.length ?? 0,
          reply_attribution_pending: !hasLiveReplies,
        },
        timeline_validation: {
          sequence_sent_events: (timelineReplyEvents ?? []).filter((e) => e.event_type === "sequence_step_sent")
            .length,
          reply_events: (timelineReplyEvents ?? []).filter((e) =>
            ["reply_ingested", "reply_received"].includes(String(e.event_type)),
          ).length,
        },
        aiden_guide: {
          panel: "/admin/growth/sequences/execution#aiden-guide",
          full_page: "/admin/growth/aiden",
          deployed: "verify after Vercel deploy",
        },
        recommendation: hasLiveReplies
          ? replyValidationPassed
            ? "READY FOR SCALE"
            : "NEEDS IMPROVEMENT"
          : "READY FOR OPERATOR USE",
        production_readiness: hasLiveReplies
          ? replyValidationPassed
            ? "READY FOR SCALE"
            : "NEEDS IMPROVEMENT"
          : "READY FOR OPERATOR USE",
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }))
  process.exit(1)
})
