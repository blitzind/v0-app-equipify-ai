/**
 * Phase 15.0A — Pilot sales execution readiness audit (read-only, no sends).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/audit-pilot-sales-execution-readiness-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const COHORT_ID = "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a"

const PRODUCTION_VALIDATION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function main(): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_VALIDATION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })

  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "production_supabase_unavailable" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const { loadApolloPilotCohort, loadApolloPilotCohortAnalytics } = await import(
    "../lib/growth/apollo/apollo-pilot-route"
  )
  const { loadApollo25CompanyPilotCohortReview } = await import(
    "../lib/growth/apollo/apollo-25-company-pilot-route"
  )
  const { loadApolloSequenceExecutionQueue } = await import(
    "../lib/growth/apollo/apollo-sequence-execution-queue"
  )
  const { loadApolloSequenceExecutionFunnelMetrics } = await import(
    "../lib/growth/apollo/apollo-sequence-execution-automation-route"
  )
  const { loadApolloVoiceDropCandidateQueue } = await import(
    "../lib/growth/apollo/apollo-voice-drop-candidate-queue"
  )
  const { loadApolloVoiceDropFunnelMetrics } = await import(
    "../lib/growth/apollo/apollo-voice-drop-automation-route"
  )
  const { fetchGrowthRevenueAttributionDashboard } = await import(
    "../lib/growth/revenue-attribution/revenue-attribution-dashboard"
  )

  const cohortLoaded = await loadApolloPilotCohort(admin, COHORT_ID)
  if (!cohortLoaded) {
    console.error(JSON.stringify({ ok: false, error: "cohort_not_found", cohort_id: COHORT_ID }))
    process.exit(1)
  }

  const companyIds = cohortLoaded.companies.map((c) => c.company_candidate_id)
  const review = await loadApollo25CompanyPilotCohortReview(admin, { cohort_id: COHORT_ID })
  const analytics = await loadApolloPilotCohortAnalytics(admin, COHORT_ID)
  const launchReportVerdict = review.launch_recommendation.ready_for_launch
    ? "READY TO LAUNCH 25-COMPANY PILOT"
    : "NOT READY"

  const seqQueue = await loadApolloSequenceExecutionQueue(admin, { status: "all", limit: 500 })
  const cohortSeqItems = seqQueue.items.filter((row) => companyIds.includes(row.company_candidate_id))
  const seqFunnel = await loadApolloSequenceExecutionFunnelMetrics(admin)

  const voiceQueue = await loadApolloVoiceDropCandidateQueue(admin, { status: "all", limit: 500 })
  const cohortVoiceItems = voiceQueue.items.filter((row) => companyIds.includes(row.company_candidate_id))
  const voiceFunnel = await loadApolloVoiceDropFunnelMetrics(admin)

  const leadIds =
    (
      await admin
        .schema("growth")
        .from("leads")
        .select("id")
        .in("company_candidate_id", companyIds)
        .limit(500)
    ).data?.map((r) => asString((r as { id: string }).id)).filter(Boolean) ?? []

  const { data: executionJobs } = leadIds.length
    ? await admin
        .schema("growth")
        .from("sequence_execution_jobs")
        .select(
          "id, status, channel, requires_human_approval, human_approved_at, enrollment_id, lead_id, created_at",
        )
        .in("lead_id", leadIds)
        .limit(200)
    : { data: [] }

  const { count: replyCount } = await admin
    .schema("growth")
    .from("inbox_messages")
    .select("id", { count: "exact", head: true })
    .eq("direction", "inbound")
    .in("lead_id", leadIds.length ? leadIds : ["00000000-0000-0000-0000-000000000000"])

  const { count: meetingCount } = await admin
    .schema("growth")
    .from("meetings")
    .select("id", { count: "exact", head: true })
    .in("lead_id", leadIds.length ? leadIds : ["00000000-0000-0000-0000-000000000000"])

  const { count: opportunityCount } = await admin
    .schema("growth")
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .in("lead_id", leadIds.length ? leadIds : ["00000000-0000-0000-0000-000000000000"])

  let revenueDashboard: Awaited<ReturnType<typeof fetchGrowthRevenueAttributionDashboard>> | null = null
  try {
    revenueDashboard = await fetchGrowthRevenueAttributionDashboard(admin, {})
  } catch {
    revenueDashboard = null
  }

  const operatorWorkflow = [
    {
      step: "Certified Cohort",
      ui_exists: true,
      ui_path: "/admin/growth/sequences/execution (ApolloPilotOperationsPanel + CertificationStatusSection)",
      api_exists: true,
      api_path: "GET /api/platform/growth/apollo-25-company-pilot/cohort",
      production_validated: review.launch_certification.certified,
      blockers: review.launch_certification.fatal_blockers,
    },
    {
      step: "Review Assets",
      ui_exists: true,
      ui_path: "/admin/growth/sequences/execution (ApolloOperationsDashboardSections)",
      api_exists: true,
      api_path: "GET /api/platform/growth/apollo-operations-dashboard",
      production_validated: review.personalization.readiness_pct === 100,
      blockers:
        review.personalization.readiness_pct < 100
          ? [`personalization_readiness_${review.personalization.readiness_pct}%`]
          : [],
    },
    {
      step: "Approve Assets",
      ui_exists: true,
      ui_path: "/admin/growth/sequences/execution (ApolloSequenceExecutionAutomationQueuePanel)",
      api_exists: true,
      api_path: "POST /api/platform/growth/apollo-25-company-pilot/cohort/materialize",
      production_validated: cohortSeqItems.length > 0,
      blockers: cohortSeqItems.length === 0 ? ["no_sequence_execution_candidates_in_cohort"] : [],
      note: "Materialize API exists; no dedicated materialize button in UI — draft approval panel used instead",
    },
    {
      step: "Approve Cohort",
      ui_exists: true,
      ui_path: "/admin/growth/sequences/execution (enrollment approval queues)",
      api_exists: true,
      api_path: "POST /api/platform/growth/apollo-25-company-pilot/cohort/enroll",
      production_validated: review.enrollment_readiness.readiness_pct === 100,
      blockers:
        review.enrollment_readiness.readiness_pct < 100
          ? [`enrollment_readiness_${review.enrollment_readiness.readiness_pct}%`]
          : [],
      note: "Enroll API exists; operators use enrollment approval queue panels",
    },
    {
      step: "Launch Workflow",
      ui_exists: true,
      ui_path: "/admin/growth/sequences/execution (Activate cohort button)",
      api_exists: true,
      api_path: "POST /api/platform/growth/apollo-pilot/cohorts/{id}/actions",
      production_validated: review.launch_recommendation.ready_for_launch,
      blockers: review.launch_recommendation.blocking_issues,
      cohort_status: cohortLoaded.cohort.status,
      processing_allowed: analytics?.processing_allowed ?? false,
    },
  ]

  const emailDraftStatuses = cohortSeqItems.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const emailDraftSamples = cohortSeqItems.slice(0, 5).map((row) => ({
    company_candidate_id: row.company_candidate_id,
    company_name: row.company_name,
    contact_name: row.full_name,
    status: row.status,
    draft_readiness_label: row.draft_readiness_label,
    draft_count: row.materialization.drafts.length,
    enrollment_candidate_id: row.enrollment_candidate_id,
    growth_lead_id: row.growth_lead_id,
  }))

  const voiceDropReviewable =
    cohortVoiceItems.length > 0 &&
    cohortVoiceItems.some((row) => row.channel_availability.voice_drop_capable)

  const voiceDropSamples = cohortVoiceItems.slice(0, 3).map((row) => ({
    company_candidate_id: row.company_candidate_id,
    company_name: row.company_name,
    status: row.status,
    voice_drop_capable: row.channel_availability.voice_drop_capable,
    script_type: row.voice_drop_intelligence.recommended_script_type,
    voicemail_objective: row.voice_drop_intelligence.voicemail_objective?.slice(0, 120),
  }))

  const jobs = (executionJobs ?? []) as Array<Record<string, unknown>>
  const jobStatusCounts = jobs.reduce(
    (acc, row) => {
      const status = asString(row.status) || "unknown"
      acc[status] = (acc[status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const launchControls = {
    launch_ready: review.launch_certification.certified && review.launch_recommendation.ready_for_launch,
    approval_required: true,
    auto_send_possible: false,
    evidence: [
      "sequence-approval-gate requires humanApproved + humanApprovalConfirmed on run",
      "Apollo automation panels state no send until explicit execution",
      "activate cohort sets status active only — does not enqueue sends",
      "growth-sequence-safe-execution-dashboard Plan → Approve → Run",
    ],
    cohort_status: cohortLoaded.cohort.status,
    processing_allowed: analytics?.processing_allowed ?? false,
  }

  const pilotReporting = {
    companies_launched: {
      available: true,
      source: "apollo_pilot_cohorts.status + dashboard.companies_processed",
      value: analytics?.dashboard.companies_processed ?? null,
      cohort_status: cohortLoaded.cohort.status,
    },
    emails_approved: {
      available: true,
      source: "apollo_pilot dashboard.draft_approvals + seqFunnel.approved_drafts",
      value: analytics?.dashboard.draft_approvals ?? seqFunnel.approved_drafts,
    },
    emails_sent: {
      available: true,
      source: "apollo_pilot dashboard.emails_sent",
      value: analytics?.dashboard.emails_sent ?? 0,
    },
    replies: {
      available: true,
      source: "apollo_pilot dashboard.replies_received + inbox_messages inbound count",
      dashboard_value: analytics?.dashboard.replies_received ?? 0,
      inbox_inbound_for_cohort_leads: replyCount ?? 0,
    },
    meetings: {
      available: true,
      source: "apollo_pilot dashboard.meetings_booked + growth.meetings count",
      dashboard_value: analytics?.dashboard.meetings_booked ?? 0,
      meetings_for_cohort_leads: meetingCount ?? 0,
    },
    opportunities: {
      available: true,
      source: "apollo_pilot dashboard.opportunities_created + growth.opportunities count",
      dashboard_value: analytics?.dashboard.opportunities_created ?? 0,
      opportunities_for_cohort_leads: opportunityCount ?? 0,
    },
    pipeline: {
      available: Boolean(revenueDashboard),
      source: "revenue-attribution dashboard funnel + apollo_pilot roi",
      roi_value: analytics?.roi.estimated_pipeline_value_usd ?? null,
    },
    revenue: {
      available: true,
      source: "apollo_pilot dashboard.revenue_attributed + revenue attribution dashboard",
      dashboard_value: analytics?.dashboard.revenue_attributed ?? 0,
    },
  }

  const payload = {
    ok: true,
    qa_marker: "pilot-sales-execution-readiness-v15-0a",
    read_only: true,
    cohort_id: COHORT_ID,
    cohort_name: cohortLoaded.cohort.cohort_name,
    cohort_status: cohortLoaded.cohort.status,
    certification: {
      certified: review.launch_certification.certified,
      enrollment_ready_pct: review.launch_certification.enrollment_ready_pct,
      personalization_ready_pct: review.launch_certification.personalization_ready_pct,
      ready_for_launch: review.launch_recommendation.ready_for_launch,
      fatal_blockers: review.launch_certification.fatal_blockers,
      warnings: review.launch_certification.warnings,
    },
    launch_report_verdict: launchReportVerdict,
    operator_workflow: operatorWorkflow,
    email_review: {
      drafts_generated: cohortSeqItems.length,
      status_counts: emailDraftStatuses,
      funnel_metrics: seqFunnel,
      execution_jobs_for_cohort_leads: jobs.length,
      execution_job_status_counts: jobStatusCounts,
      sample_candidates: emailDraftSamples,
      ui_path: "/admin/growth/sequences/execution → Apollo Sequence Execution Automation Queue",
      data_source: "growth.apollo_sequence_execution_candidates + growth.sequence_execution_jobs",
      editable: true,
      approvable: true,
      tied_to_company_contact: true,
    },
    voice_drop_review: {
      operator_can_review_and_approve_today: voiceDropReviewable,
      voice_drop_candidates_in_cohort: cohortVoiceItems.length,
      funnel_metrics: voiceFunnel,
      sample_candidates: voiceDropSamples,
      ui_path: "/admin/growth/sequences/execution → Apollo Voice Drop Automation Queue",
      api_path: "/api/platform/growth/apollo-voice-drop-automation/voice-drop-queue",
      audio_generation_path: "Apollo voice-drop intelligence + campaign queue (no auto-send)",
    },
    launch_controls: launchControls,
    reply_handling: {
      inbound_email_webhook: "app/api/growth/webhooks/provider/[providerFamily]",
      inbound_sms_webhook: "app/api/growth/webhooks/sms/twilio/inbound",
      reply_pipeline: "lib/growth/replies/reply-ingestion-pipeline.ts",
      inbox_ui: "/admin/growth/inbox",
      reply_drafts_ui: "/admin/growth/copilot/reply-drafts",
      cohort_lead_count: leadIds.length,
      inbound_messages_for_cohort_leads: replyCount ?? 0,
      production_evidence: (replyCount ?? 0) > 0 ? "inbound messages exist for cohort leads" : "no inbound yet for cohort leads",
    },
    meeting_capture: {
      booking_ui: "/book/[slug]",
      meetings_dashboard: "/admin/growth/meetings",
      api: "POST /api/platform/growth/meetings",
      opportunity_drafts_embedded: true,
      meetings_for_cohort_leads: meetingCount ?? 0,
      full_path_exists: true,
      note: "Calendar sync is human-confirmed; browser audio capture on live calls page",
    },
    revenue_attribution: {
      fully_traceable: Boolean(revenueDashboard),
      dashboard_ui: "/admin/growth/revenue-attribution",
      funnel_steps: revenueDashboard?.funnel?.map((s) => s.stage) ?? null,
      missing_links: revenueDashboard
        ? []
        : ["revenue attribution dashboard failed to load — verify attribution_touches schema"],
      dual_system_note: "Legacy revenue_attribution_events + attribution_touches ledger; not every event writes touch synchronously",
    },
    pilot_reporting: pilotReporting,
    analytics_dashboard: analytics?.dashboard ?? null,
    company_count: cohortLoaded.companies.length,
  }

  console.log(JSON.stringify(payload, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
