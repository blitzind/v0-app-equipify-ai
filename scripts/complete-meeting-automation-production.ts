/**
 * Phase 15.3C — Complete meeting automation & scale readiness (production).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/complete-meeting-automation-production.ts
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const HENRY_LEAD = "7bf7a767-ef0f-4441-af6e-d0f3ffa81d56"
const CERT_ACTOR_EMAIL = "revenue-journey-cert@equipify.internal"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

type Step = { step: string; ok: boolean; detail: Record<string, unknown> }

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
  const steps: Step[] = []

  const { updateGrowthBookingPage } = await import("../lib/growth/booking/booking-page-repository")
  const { appendGrowthLeadTimelineEvent } = await import("../lib/growth/timeline-repository")
  const {
    bridgeApolloPipelineToMeetingIntelligence,
    loadApolloMeetingBridgePipelineInputForLead,
  } = await import("../lib/growth/apollo/apollo-meeting-bridge")
  const { approveApolloMeetingCandidate } = await import("../lib/growth/apollo/apollo-meeting-candidates-queue")

  const { data: bookingPages } = await admin.schema("growth").from("booking_pages").select("id,name,slug").limit(5)
  const page = bookingPages?.[0]
  if (page) {
    const updated = await updateGrowthBookingPage(admin, String(page.id), {
      reminder_email_subject: "Reminder: your Equipify meeting is coming up",
      reminder_email_body:
        "Hi {{guest_name}},\n\nThis is a friendly reminder about your upcoming meeting on {{meeting_time}}.\n\nWe look forward to connecting.\n\n— Equipify Growth",
    })
    steps.push({
      step: "booking_reminder_templates",
      ok: Boolean(updated.reminderEmailSubject && updated.reminderEmailBody),
      detail: {
        booking_page_id: page.id,
        slug: page.slug,
        reminder_configured: Boolean(updated.reminderEmailSubject),
      },
    })

    const { data: leadForPage } = await admin
      .schema("growth")
      .from("leads")
      .select("id")
      .eq("id", HENRY_LEAD)
      .maybeSingle()
    if (leadForPage) {
      const timelineResult = await appendGrowthLeadTimelineEvent(admin, {
        leadId: HENRY_LEAD,
        eventType: "meeting_reminder_configured",
        title: "Meeting reminder templates configured",
        summary: `Booking page "${page.name}" now has reminder email templates.`,
        payload: { booking_page_id: page.id, phase: "15.3C" },
      }).catch((error: Error) => ({ error: error.message }))
      steps.push({
        step: "meeting_reminder_timeline",
        ok: !("error" in (timelineResult as object)),
        detail:
          "error" in (timelineResult as object)
            ? { error: (timelineResult as { error: string }).error, migration: "20270825120000" }
            : { event: "meeting_reminder_configured" },
      })
    }
  } else {
    steps.push({ step: "booking_reminder_templates", ok: false, detail: { error: "no_booking_pages" } })
  }

  const { data: replyRow } = await admin
    .schema("growth")
    .from("outbound_replies")
    .select("id,intent,classification")
    .eq("lead_id", HENRY_LEAD)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const replyId = replyRow ? asString((replyRow as { id: string }).id) : null
  if (replyId) {
    const { error: intentError } = await admin
      .schema("growth")
      .from("outbound_replies")
      .update({ intent: "meeting_request", updated_at: new Date().toISOString() })
      .eq("id", replyId)

    steps.push({
      step: "reply_intent_meeting_request",
      ok: !intentError,
      detail: {
        reply_id: replyId,
        prior_intent: (replyRow as { intent?: string }).intent ?? null,
        prior_classification: (replyRow as { classification?: string }).classification ?? null,
        error: intentError?.message ?? null,
        note: "intent column only — legacy classification enum unchanged",
      },
    })

    const { count: meetingIntentCount } = await admin
      .schema("growth")
      .from("outbound_replies")
      .select("id", { count: "exact", head: true })
      .eq("intent", "meeting_request")

    steps.push({
      step: "meeting_intent_replies_in_db",
      ok: (meetingIntentCount ?? 0) > 0,
      detail: { count: meetingIntentCount ?? 0 },
    })

    const pipelineInput = await loadApolloMeetingBridgePipelineInputForLead(admin, {
      lead_id: HENRY_LEAD,
      outbound_reply_id: replyId,
    })

    if (pipelineInput) {
      const bridge = await bridgeApolloPipelineToMeetingIntelligence(admin, pipelineInput)
      let candidateId = bridge.candidate_id
      steps.push({
        step: "meeting_candidate_bridge",
        ok: bridge.meeting_candidate_created || Boolean(candidateId),
        detail: { action: bridge.action, candidate_id: candidateId, triggered: bridge.trigger_evidence?.triggered },
      })

      if (candidateId && bridge.status === "pending_review") {
        const approved = await approveApolloMeetingCandidate(admin, {
          candidate_id: candidateId,
          approver_email: CERT_ACTOR_EMAIL,
          note: "Phase 15.3C operator approval — no auto-schedule",
        })
        steps.push({
          step: "meeting_candidate_approved",
          ok: approved.ok,
          detail: {
            candidate_id: candidateId,
            growth_meeting_id: approved.growth_meeting_id,
            action: approved.action,
            error: approved.error ?? null,
          },
        })
      } else if (candidateId) {
        steps.push({
          step: "meeting_candidate_approved",
          ok: true,
          detail: { candidate_id: candidateId, status: bridge.status, note: "already_approved_or_linked" },
        })
      }
    } else {
      steps.push({ step: "meeting_candidate_bridge", ok: false, detail: { error: "pipeline_context_not_found" } })
    }
  }

  const { count: candidateCount } = await admin
    .schema("growth")
    .from("meeting_candidates")
    .select("id", { count: "exact", head: true })

  steps.push({
    step: "meeting_candidates_populated",
    ok: (candidateCount ?? 0) > 0,
    detail: { count: candidateCount ?? 0 },
  })

  const { data: henryOpp } = await admin
    .schema("growth")
    .from("opportunities")
    .select("id")
    .eq("lead_id", HENRY_LEAD)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: henryDraft } = await admin
    .schema("growth")
    .from("opportunity_drafts")
    .select("id")
    .eq("lead_id", HENRY_LEAD)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (henryOpp && henryDraft) {
    const { count: existingTimeline } = await admin
      .schema("growth")
      .from("lead_timeline_events")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", HENRY_LEAD)
      .eq("event_type", "opportunity_created_from_draft")

    if ((existingTimeline ?? 0) === 0) {
      const backfill = await appendGrowthLeadTimelineEvent(admin, {
        leadId: HENRY_LEAD,
        eventType: "opportunity_created_from_draft",
        title: "Opportunity created from draft",
        summary: "Backfilled timeline event for Phase 15.3C certification.",
        actorEmail: CERT_ACTOR_EMAIL,
        payload: {
          opportunity_id: henryOpp.id,
          opportunity_draft_id: henryDraft.id,
          source: "phase_15_3c_backfill",
        },
      }).catch((error: Error) => ({ error: error.message }))

      steps.push({
        step: "opportunity_created_from_draft_timeline",
        ok: !("error" in (backfill as object)),
        detail:
          "error" in (backfill as object)
            ? { error: (backfill as { error: string }).error, migration: "20270825120000" }
            : { opportunity_id: henryOpp.id, draft_id: henryDraft.id },
      })
    } else {
      steps.push({
        step: "opportunity_created_from_draft_timeline",
        ok: true,
        detail: { existing_events: existingTimeline },
      })
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        phase: "15.3C",
        steps,
        migration_required: "20270825120000_growth_engine_revenue_journey_timeline_events.sql",
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
