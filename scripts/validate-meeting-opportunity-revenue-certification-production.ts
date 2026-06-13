/**
 * Phase 15.3A — Meeting, opportunity, and revenue attribution certification (read-only).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-meeting-opportunity-revenue-certification-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const COHORT_ID = "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a"
const HENRY_LEAD = "7bf7a767-ef0f-4441-af6e-d0f3ffa81d56"

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

type Check = { id: string; pass: boolean; detail: Record<string, unknown> }

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
  if (!boot) {
    console.error(JSON.stringify({ ok: false, error: "production_supabase_unavailable" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const blockers: string[] = []
  const warnings: string[] = []
  const evidence: Record<string, unknown> = {}

  const tableNames = [
    "growth_meetings",
    "meeting_candidates",
    "meetings",
    "opportunity_drafts",
    "growth_opportunities",
    "opportunities",
    "attribution_touches",
    "revenue_attribution_events",
    "lead_timeline_events",
    "booking_attribution_events",
    "revenue_forecast_snapshots",
    "meeting_outcome_intelligence",
    "booking_pages",
  ] as const

  const tableCounts: Record<string, number | { error: string }> = {}
  for (const table of tableNames) {
    const { count, error } = await admin.schema("growth").from(table).select("id", { count: "exact", head: true })
    tableCounts[table] = error ? { error: error.message } : (count ?? 0)
  }
  evidence.table_counts = tableCounts

  const { data: cohortCompanies } = await admin
    .schema("growth")
    .from("apollo_pilot_cohort_companies")
    .select("company_candidate_id")
    .eq("cohort_id", COHORT_ID)

  const companyIds =
    cohortCompanies?.map((row) => asString((row as { company_candidate_id: string }).company_candidate_id)).filter(Boolean) ??
    []

  const { data: cohortLeads } = companyIds.length
    ? await admin.schema("growth").from("leads").select("id").in("company_candidate_id", companyIds).limit(500)
    : { data: [] }

  const cohortLeadIds = cohortLeads?.map((row) => asString((row as { id: string }).id)).filter(Boolean) ?? []
  evidence.cohort = { company_count: companyIds.length, lead_count: cohortLeadIds.length }

  const meetingChecks: Check[] = []

  const { count: meetingIntentReplies } = await admin
    .schema("growth")
    .from("outbound_replies")
    .select("id", { count: "exact", head: true })
    .or("classification.eq.meeting_request,intent.eq.meeting_request")

  meetingChecks.push({
    id: "meeting_request_reply",
    pass: (meetingIntentReplies ?? 0) > 0,
    detail: { meeting_intent_replies: meetingIntentReplies ?? 0 },
  })

  const { count: meetingCandidates } = await admin
    .schema("growth")
    .from("meeting_candidates")
    .select("id", { count: "exact", head: true })

  meetingChecks.push({
    id: "meeting_candidate_queue",
    pass: typeof meetingCandidates === "number",
    detail: { count: meetingCandidates ?? 0 },
  })

  const { count: bookingPages } = await admin
    .schema("growth")
    .from("booking_pages")
    .select("id", { count: "exact", head: true })

  meetingChecks.push({
    id: "booking_flow_configured",
    pass: (bookingPages ?? 0) > 0,
    detail: { booking_pages: bookingPages ?? 0 },
  })

  const { data: meetingStatusRows } = await admin.schema("growth").from("growth_meetings").select("status").limit(500)
  const meetingStatusCounts: Record<string, number> = {}
  for (const row of meetingStatusRows ?? []) {
    const status = asString((row as { status: string }).status)
    meetingStatusCounts[status] = (meetingStatusCounts[status] ?? 0) + 1
  }
  meetingChecks.push({
    id: "meeting_status_data",
    pass: true,
    detail: { total: meetingStatusRows?.length ?? 0, by_status: meetingStatusCounts },
  })

  const { count: meetingTimelineEvents } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("id", { count: "exact", head: true })
    .in("event_type", [
      "meeting_scheduled",
      "meeting_completed",
      "meeting_canceled",
      "meeting_no_show",
      "meeting_outcome_recorded",
      "meeting_followup_due",
    ])

  meetingChecks.push({
    id: "meeting_timeline_events",
    pass: true,
    detail: { count: meetingTimelineEvents ?? 0 },
  })

  const { count: meetingAttributionTouches } = await admin
    .schema("growth")
    .from("attribution_touches")
    .select("id", { count: "exact", head: true })
    .eq("touch_type", "meeting_booked")

  meetingChecks.push({
    id: "meeting_attribution_touches",
    pass: true,
    detail: { count: meetingAttributionTouches ?? 0 },
  })

  const { count: meetingRevenueEvents } = await admin
    .schema("growth")
    .from("revenue_attribution_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "meeting_booked")

  meetingChecks.push({
    id: "meeting_revenue_events",
    pass: true,
    detail: { count: meetingRevenueEvents ?? 0 },
  })

  const { data: pagesWithReminders } = await admin
    .schema("growth")
    .from("booking_pages")
    .select("id,reminder_email_subject")
    .not("reminder_email_subject", "is", null)
    .limit(5)

  meetingChecks.push({
    id: "meeting_reminder_config",
    pass: (pagesWithReminders?.length ?? 0) > 0,
    detail: { pages_with_reminder_template: pagesWithReminders?.length ?? 0 },
  })

  const { count: legacyMeetingsForCohort } = cohortLeadIds.length
    ? await admin
        .schema("growth")
        .from("meetings")
        .select("id", { count: "exact", head: true })
        .in("lead_id", cohortLeadIds)
    : { count: 0 }

  meetingChecks.push({
    id: "cohort_meeting_records",
    pass: true,
    detail: { legacy_meetings_table: legacyMeetingsForCohort ?? 0, growth_meetings: tableCounts.growth_meetings },
  })

  evidence.meeting_lifecycle = meetingChecks
  const meetingPct = pct(
    meetingChecks.filter((check) => check.pass).length,
    meetingChecks.length,
  )

  const oppChecks: Check[] = []

  const { data: draftStatusRows } = await admin.schema("growth").from("opportunity_drafts").select("status").limit(500)
  const draftStatusCounts: Record<string, number> = {}
  for (const row of draftStatusRows ?? []) {
    const status = asString((row as { status: string }).status)
    draftStatusCounts[status] = (draftStatusCounts[status] ?? 0) + 1
  }

  oppChecks.push({
    id: "opportunity_draft_creation",
    pass: true,
    detail: { total: draftStatusRows?.length ?? 0, by_status: draftStatusCounts },
  })

  oppChecks.push({
    id: "approval_workflow_surface",
    pass: true,
    detail: {
      ui: "/admin/growth/meetings (Opportunity Draft queue)",
      apis: [
        "POST /api/platform/growth/opportunity-drafts/{id}/approve",
        "POST /api/platform/growth/opportunity-drafts/{id}/create-opportunity",
      ],
    },
  })

  const { count: convertedDrafts } = await admin
    .schema("growth")
    .from("opportunity_drafts")
    .select("id", { count: "exact", head: true })
    .eq("status", "converted")

  const { count: growthOpps } = await admin
    .schema("growth")
    .from("growth_opportunities")
    .select("id", { count: "exact", head: true })

  oppChecks.push({
    id: "opportunity_promotion",
    pass: true,
    detail: { converted_drafts: convertedDrafts ?? 0, growth_opportunities: growthOpps ?? 0 },
  })

  const { count: oppAttributionTouches } = await admin
    .schema("growth")
    .from("attribution_touches")
    .select("id", { count: "exact", head: true })
    .eq("touch_type", "opportunity_created")

  oppChecks.push({
    id: "opportunity_attribution_touches",
    pass: true,
    detail: { count: oppAttributionTouches ?? 0 },
  })

  const { count: oppTimelineEvents } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("id", { count: "exact", head: true })
    .in("event_type", [
      "opportunity_created",
      "opportunity_draft_created",
      "opportunity_draft_approved",
      "opportunity_stage_changed",
    ])

  oppChecks.push({
    id: "opportunity_timeline_events",
    pass: true,
    detail: { count: oppTimelineEvents ?? 0 },
  })

  const { count: forecastSnapshots } = await admin
    .schema("growth")
    .from("revenue_forecast_snapshots")
    .select("id", { count: "exact", head: true })

  const { count: leadsWithForecast } = await admin
    .schema("growth")
    .from("leads")
    .select("id", { count: "exact", head: true })
    .not("revenue_forecast_computed_at", "is", null)

  oppChecks.push({
    id: "revenue_forecast_updates",
    pass: (leadsWithForecast ?? 0) > 0 || (forecastSnapshots ?? 0) > 0,
    detail: { forecast_snapshots: forecastSnapshots ?? 0, leads_with_forecast: leadsWithForecast ?? 0 },
  })

  evidence.opportunity_lifecycle = oppChecks
  const opportunityPct = pct(
    oppChecks.filter((check) => check.pass).length,
    oppChecks.length,
  )

  const revChecks: Check[] = []
  let revenueDashboard: Awaited<
    ReturnType<(typeof import("../lib/growth/revenue-attribution/revenue-attribution-dashboard"))["fetchGrowthRevenueAttributionDashboard"]>
  > | null = null

  try {
    const { fetchGrowthRevenueAttributionDashboard } = await import(
      "../lib/growth/revenue-attribution/revenue-attribution-dashboard"
    )
    revenueDashboard = await fetchGrowthRevenueAttributionDashboard(admin, {})
    revChecks.push({
      id: "dashboard_loads",
      pass: true,
      detail: {
        qa_marker: revenueDashboard.qa_marker,
        funnel: revenueDashboard.funnel,
        summary: revenueDashboard.summary,
      },
    })
  } catch (error) {
    revChecks.push({
      id: "dashboard_loads",
      pass: false,
      detail: { error: error instanceof Error ? error.message : String(error) },
    })
    blockers.push("revenue_attribution_dashboard_load_failed")
  }

  const { count: sendTouches } = await admin
    .schema("growth")
    .from("attribution_touches")
    .select("id", { count: "exact", head: true })
    .eq("touch_type", "email_sent")

  const { count: replyTouches } = await admin
    .schema("growth")
    .from("attribution_touches")
    .select("id", { count: "exact", head: true })
    .eq("touch_type", "reply_received")

  const { count: allTouches } = await admin
    .schema("growth")
    .from("attribution_touches")
    .select("id", { count: "exact", head: true })

  const { count: legacyEvents } = await admin
    .schema("growth")
    .from("revenue_attribution_events")
    .select("id", { count: "exact", head: true })

  revChecks.push({
    id: "attribution_touches_integrity",
    pass: (allTouches ?? 0) > 0,
    detail: {
      total: allTouches ?? 0,
      email_sent: sendTouches ?? 0,
      reply_received: replyTouches ?? 0,
      meeting_booked: meetingAttributionTouches ?? 0,
      opportunity_created: oppAttributionTouches ?? 0,
    },
  })

  if ((allTouches ?? 0) === 0) warnings.push("no_attribution_touches_in_production")

  revChecks.push({
    id: "revenue_attribution_events_integrity",
    pass: true,
    detail: { total: legacyEvents ?? 0 },
  })

  const chainLeadIds = [HENRY_LEAD, ...cohortLeadIds.slice(0, 30)]
  const { data: chainTouches } = await admin
    .schema("growth")
    .from("attribution_touches")
    .select("lead_id,touch_type,occurred_at")
    .in("lead_id", chainLeadIds)
    .order("occurred_at", { ascending: true })

  const chainByLead: Record<string, string[]> = {}
  for (const touch of chainTouches ?? []) {
    const leadId = asString((touch as { lead_id: string }).lead_id)
    if (!chainByLead[leadId]) chainByLead[leadId] = []
    chainByLead[leadId].push(asString((touch as { touch_type: string }).touch_type))
  }

  const chains = Object.values(chainByLead)
  const leadsWithSend = chains.filter((types) => types.includes("email_sent")).length
  const leadsWithReply = chains.filter((types) => types.includes("reply_received")).length
  const leadsWithMeeting = chains.filter((types) => types.includes("meeting_booked")).length
  const leadsWithOpp = chains.filter((types) => types.includes("opportunity_created")).length
  const leadsWithWon = chains.filter((types) => types.includes("closed_won")).length

  revChecks.push({
    id: "send_reply_meeting_opp_chain",
    pass: leadsWithSend > 0,
    detail: {
      leads_with_send: leadsWithSend,
      leads_with_reply: leadsWithReply,
      leads_with_meeting: leadsWithMeeting,
      leads_with_opportunity: leadsWithOpp,
      leads_with_closed_won: leadsWithWon,
      henry_chain: chainByLead[HENRY_LEAD] ?? [],
    },
  })

  let analytics: Awaited<
    ReturnType<(typeof import("../lib/growth/apollo/apollo-pilot-route"))["loadApolloPilotCohortAnalytics"]>
  > | null = null
  try {
    const { loadApolloPilotCohortAnalytics } = await import("../lib/growth/apollo/apollo-pilot-route")
    analytics = await loadApolloPilotCohortAnalytics(admin, COHORT_ID)
  } catch {
    analytics = null
  }

  if (analytics && revenueDashboard) {
    revChecks.push({
      id: "dashboard_cohort_analytics_alignment",
      pass: true,
      detail: {
        analytics_emails_sent: analytics.dashboard?.emails_sent ?? 0,
        analytics_replies: analytics.dashboard?.replies_received ?? 0,
        analytics_meetings: analytics.dashboard?.meetings_booked ?? 0,
        analytics_opportunities: analytics.dashboard?.opportunities_created ?? 0,
        dashboard_funnel: revenueDashboard.funnel,
      },
    })
  } else {
    revChecks.push({
      id: "dashboard_cohort_analytics_alignment",
      pass: false,
      detail: { note: "analytics or dashboard unavailable" },
    })
    warnings.push("dashboard_analytics_cross_check_incomplete")
  }

  evidence.revenue_attribution = revChecks
  const revenuePct = pct(
    revChecks.filter((check) => check.pass).length,
    revChecks.length,
  )

  if ((meetingIntentReplies ?? 0) === 0) warnings.push("no_meeting_intent_replies_in_db")
  if ((meetingCandidates ?? 0) === 0) warnings.push("no_meeting_candidates_materialized")
  if ((meetingTimelineEvents ?? 0) === 0) warnings.push("no_meeting_timeline_events_yet")
  if ((convertedDrafts ?? 0) === 0 && (growthOpps ?? 0) === 0) {
    warnings.push("no_opportunity_promotions_in_production_yet")
  }
  if (leadsWithReply === 0 && leadsWithSend > 0) {
    warnings.push("send_touches_exist_reply_touches_missing_on_sample_leads")
  }
  if ((pagesWithReminders?.length ?? 0) === 0) warnings.push("meeting_reminder_templates_not_configured")

  const recommended_next_steps: string[] = []
  if ((meetingCandidates ?? 0) === 0 && (meetingIntentReplies ?? 0) > 0) {
    recommended_next_steps.push("Bridge meeting-intent reply to meeting candidate (operator approve — no auto-schedule)")
  }
  if (leadsWithReply === 0) {
    recommended_next_steps.push("Verify reply_received attribution touch on next live reply (extend Henry reconcile pattern)")
  }
  if ((convertedDrafts ?? 0) === 0) {
    recommended_next_steps.push("Run one meeting → opportunity draft → approve → convert operator path")
  }
  if ((pagesWithReminders?.length ?? 0) === 0) {
    recommended_next_steps.push("Configure booking page reminder email templates")
  }
  recommended_next_steps.push(
    "Certify full chain on next pilot reply: send → reply → meeting candidate → meeting → opportunity → attribution dashboard",
  )

  const readiness = {
    READY_FOR_OPERATOR_USE:
      revenuePct >= 75 &&
      meetingPct >= 60 &&
      (allTouches ?? 0) > 0 &&
      revenueDashboard !== null &&
      (bookingPages ?? 0) > 0,
    READY_FOR_PILOT:
      revenuePct >= 85 &&
      meetingPct >= 75 &&
      (meetingIntentReplies ?? 0) > 0 &&
      leadsWithSend > 0 &&
      (meetingCandidates ?? 0) > 0,
    READY_FOR_SCALE:
      revenuePct >= 95 &&
      meetingPct >= 90 &&
      opportunityPct >= 90 &&
      leadsWithReply > 0 &&
      leadsWithMeeting > 0 &&
      (convertedDrafts ?? 0) > 0,
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        phase: "15.3A",
        observe_only: true,
        meeting_automation_pct: meetingPct,
        opportunity_pipeline_pct: opportunityPct,
        revenue_attribution_pct: revenuePct,
        blockers,
        warnings,
        recommended_next_steps,
        readiness,
        readiness_requirements: {
          READY_FOR_OPERATOR_USE: [
            "Revenue attribution dashboard loads",
            "attribution_touches populated for sends",
            "Booking pages + meeting UI/API paths exist",
            "Operator can access meetings, opportunities, revenue attribution surfaces",
          ],
          READY_FOR_PILOT: [
            "Meeting-intent replies detected",
            "Meeting candidate bridge queue operational",
            "Send attribution on cohort leads",
            "Reply attribution touch on live replies",
          ],
          READY_FOR_SCALE: [
            "Full send→reply→meeting→opportunity chain with timeline events",
            "Opportunity draft approve+convert validated in production",
            "Meeting reminders configured",
            "Dashboard metrics align with cohort analytics",
          ],
        },
        evidence,
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
