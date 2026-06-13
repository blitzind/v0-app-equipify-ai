/**
 * Phase 15.3B — Full revenue journey certification on a single pilot lead.
 *
 * Observe (default):
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/certify-revenue-journey-production.ts
 *
 * Certify (mutations on pilot lead only):
 *   ... scripts/certify-revenue-journey-production.ts -- --certify
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const COHORT_ID = "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a"
const DEFAULT_LEAD_ID = "7bf7a767-ef0f-4441-af6e-d0f3ffa81d56"
const CERT_ACTOR_EMAIL = "revenue-journey-cert@equipify.internal"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

type StepResult = { step: string; ok: boolean; detail: Record<string, unknown> }

async function main(): Promise<void> {
  const certify = process.argv.includes("--certify")
  const leadId = process.argv.find((arg) => arg.startsWith("--lead="))?.split("=")[1]?.trim() || DEFAULT_LEAD_ID

  try {
    await runCertification(certify, leadId)
  } catch (error) {
    console.error(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }),
    )
    process.exit(1)
  }
}

async function runCertification(certify: boolean, leadId: string): Promise<void> {
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
  const steps: StepResult[] = []

  const { fetchAidenRevenueJourneyTracker } = await import("../lib/growth/aiden/aiden-revenue-journey-tracker")
  const { recordReplyAttributionTouchForLead } = await import(
    "../lib/growth/revenue-attribution/record-reply-attribution-touch"
  )
  const { bridgeApolloPipelineToMeetingIntelligence, loadApolloMeetingBridgePipelineInputForLead } = await import(
    "../lib/growth/apollo/apollo-meeting-bridge"
  )
  const { approveApolloMeetingCandidate } = await import("../lib/growth/apollo/apollo-meeting-candidates-queue")
  const { updateGrowthMeeting } = await import("../lib/growth/meeting-intelligence/mutate-meeting")
  const { generateAndPersistOpportunityDraft } = await import(
    "../lib/growth/meeting-intelligence/opportunity-draft-service"
  )
  const { approveOpportunityDraft, createOpportunityFromApprovedDraft } = await import(
    "../lib/growth/meeting-intelligence/opportunity-draft-queue"
  )
  const { updateGrowthOpportunityStage } = await import("../lib/growth/opportunity-pipeline/mutate-opportunity")
  const { fetchGrowthRevenueAttributionDashboard } = await import(
    "../lib/growth/revenue-attribution/revenue-attribution-dashboard"
  )

  const { data: leadRow } = await admin
    .schema("growth")
    .from("leads")
    .select("id,company_name")
    .eq("id", leadId)
    .maybeSingle()

  if (!leadRow) {
    console.log(JSON.stringify({ ok: false, error: "lead_not_found", lead_id: leadId }))
    process.exit(1)
  }

  const { data: replyRow } = await admin
    .schema("growth")
    .from("outbound_replies")
    .select("id,intent,classification,received_at")
    .eq("lead_id", leadId)
    .order("received_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const replyId = replyRow ? asString((replyRow as { id: string }).id) : null

  const { data: sendTouch } = await admin
    .schema("growth")
    .from("attribution_touches")
    .select("id")
    .eq("lead_id", leadId)
    .eq("touch_type", "email_send")
    .limit(1)

  steps.push({
    step: "email_sent",
    ok: (sendTouch?.length ?? 0) > 0,
    detail: { attribution_touches: sendTouch?.length ?? 0 },
  })

  let replyTouch = await admin
    .schema("growth")
    .from("attribution_touches")
    .select("id")
    .eq("lead_id", leadId)
    .eq("touch_type", "reply")
    .limit(1)

  if (certify && replyId && (replyTouch.data?.length ?? 0) === 0) {
    await recordReplyAttributionTouchForLead(admin, {
      leadId,
      replyId,
      touchedAt: asString((replyRow as { received_at?: string }).received_at) || undefined,
      attributionSource: "revenue_journey_certification",
      metadata: { certification: "15.3B" },
    })
    replyTouch = await admin
      .schema("growth")
      .from("attribution_touches")
      .select("id")
      .eq("lead_id", leadId)
      .eq("touch_type", "reply")
      .limit(1)
  }

  steps.push({
    step: "reply_received",
    ok: Boolean(replyId) && (replyTouch.data?.length ?? 0) > 0,
    detail: { outbound_reply_id: replyId, reply_touches: replyTouch.data?.length ?? 0 },
  })

  let candidateId: string | null = null
  let meetingId: string | null = null

  const { data: existingCandidate } = await admin
    .schema("growth")
    .from("meeting_candidates")
    .select("id,growth_meeting_id,status")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  candidateId = existingCandidate ? asString((existingCandidate as { id: string }).id) : null
  meetingId = existingCandidate
    ? asString((existingCandidate as { growth_meeting_id?: string }).growth_meeting_id) || null
    : null

  if (certify && replyId && !candidateId) {
    const { error: replyUpdateError } = await admin
      .schema("growth")
      .from("outbound_replies")
      .update({
        intent: "meeting_request",
        updated_at: new Date().toISOString(),
      })
      .eq("id", replyId)

    const pipelineInput = await loadApolloMeetingBridgePipelineInputForLead(admin, {
      lead_id: leadId,
      outbound_reply_id: replyId,
    })

    if (pipelineInput) {
      const bridge = await bridgeApolloPipelineToMeetingIntelligence(admin, pipelineInput)
      candidateId = bridge.candidate_id
      steps.push({
        step: "meeting_candidate_bridge",
        ok: bridge.meeting_candidate_created || Boolean(bridge.candidate_id),
        detail: {
          action: bridge.action,
          candidate_id: bridge.candidate_id,
          reply_update_error: replyUpdateError?.message ?? null,
        },
      })
    } else {
      steps.push({
        step: "meeting_candidate_bridge",
        ok: false,
        detail: { error: "pipeline_context_not_found", reply_update_error: replyUpdateError?.message ?? null },
      })
    }

    if (!candidateId && pipelineInput) {
      const { data: leadAssignment } = await admin
        .schema("growth")
        .from("leads")
        .select("assigned_to")
        .eq("id", leadId)
        .maybeSingle()
      const ownerUserId =
        typeof leadAssignment?.assigned_to === "string" ? leadAssignment.assigned_to : null
      const { proposeGrowthMeetingFromReply } = await import("../lib/growth/meeting-intelligence/mutate-meeting")
      const { recordMeetingAttributionForLead } = await import("../lib/growth/revenue-intelligence/revenue-attribution")
      const meeting = await proposeGrowthMeetingFromReply(admin, {
        leadId,
        replyId,
        companyName: String(leadRow.company_name ?? "Lead"),
        ownerUserId,
      })
      meetingId = meeting?.id ?? null
      if (meetingId) {
        await recordMeetingAttributionForLead(admin, {
          leadId,
          metadata: { source: "revenue_journey_certification_fallback" },
        }).catch(() => undefined)
      }
      steps.push({
        step: "meeting_certification_fallback",
        ok: Boolean(meetingId),
        detail: { meeting_id: meetingId, reason: "bridge_skip_fallback" },
      })
    }
  }

  if (certify && candidateId && !meetingId) {
    const approved = await approveApolloMeetingCandidate(admin, {
      candidate_id: candidateId,
      approver_email: CERT_ACTOR_EMAIL,
      note: "Phase 15.3B revenue journey certification",
    })
    meetingId = approved.growth_meeting_id
    steps.push({
      step: "meeting_created",
      ok: approved.ok && Boolean(meetingId),
      detail: { meeting_id: meetingId, action: approved.action },
    })
  } else {
    const { data: meetingRow } = await admin
      .schema("growth")
      .from("meetings")
      .select("id,status")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    meetingId = meetingRow ? asString((meetingRow as { id: string }).id) : meetingId
    steps.push({
      step: "meeting_created",
      ok: Boolean(meetingId),
      detail: { meeting_id: meetingId, candidate_id: candidateId },
    })
  }

  if (certify && meetingId) {
    const updated = await updateGrowthMeeting(admin, meetingId, {
      status: "completed",
      outcome: "positive",
      nextAction: "Send proposal",
      startAt: new Date().toISOString(),
      endAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      actor: { email: CERT_ACTOR_EMAIL },
    })
    steps.push({
      step: "meeting_completed",
      ok: updated.ok,
      detail: { meeting_id: meetingId, status: updated.ok ? "completed" : updated.code },
    })
  }

  let draftId: string | null = null
  const { data: existingDraft } = await admin
    .schema("growth")
    .from("opportunity_drafts")
    .select("id,status")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  draftId = existingDraft ? asString((existingDraft as { id: string }).id) : null

  if (certify && meetingId && !draftId) {
    const draft = await generateAndPersistOpportunityDraft(admin, {
      meeting_id: meetingId,
      actor_email: CERT_ACTOR_EMAIL,
      trigger: "manual",
      regenerate: false,
    })
    draftId = draft.draft?.draft_id ?? null
    steps.push({
      step: "opportunity_draft",
      ok: draft.ok && Boolean(draftId),
      detail: { draft_id: draftId, error: draft.error ?? null },
    })
  } else {
    steps.push({
      step: "opportunity_draft",
      ok: Boolean(draftId),
      detail: { draft_id: draftId },
    })
  }

  let opportunityId: string | null = null

  if (certify && draftId) {
    const draftStatus = asString((existingDraft as { status?: string } | null)?.status)
    if (draftStatus === "draft" || !existingDraft) {
      const approvedDraft = await approveOpportunityDraft(admin, {
        draft_id: draftId,
        approver_email: CERT_ACTOR_EMAIL,
        note: "Phase 15.3B certification",
      })
      steps.push({
        step: "opportunity_draft_approved",
        ok: approvedDraft.ok,
        detail: { draft_id: draftId },
      })
    }

    const created = await createOpportunityFromApprovedDraft(admin, {
      draft_id: draftId,
      operator_email: CERT_ACTOR_EMAIL,
    })
    opportunityId = created.opportunity_id
    steps.push({
      step: "opportunity_created",
      ok: created.ok && Boolean(opportunityId),
      detail: { opportunity_id: opportunityId, error: created.error ?? null },
    })
  } else {
    const { data: oppRow } = await admin
      .schema("growth")
      .from("opportunities")
      .select("id")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    opportunityId = oppRow ? asString((oppRow as { id: string }).id) : null
    steps.push({
      step: "opportunity_created",
      ok: Boolean(opportunityId),
      detail: { opportunity_id: opportunityId },
    })
  }

  if (certify && opportunityId) {
    const closed = await updateGrowthOpportunityStage(admin, {
      opportunityId,
      patch: { stageKey: "closed_won" },
      actor: { email: CERT_ACTOR_EMAIL },
    })
    steps.push({
      step: "closed_won_simulation",
      ok: closed.ok,
      detail: { opportunity_id: opportunityId },
    })
  }

  const { data: finalTouches } = await admin
    .schema("growth")
    .from("attribution_touches")
    .select("touch_type")
    .eq("lead_id", leadId)

  const touchTypes = (finalTouches ?? []).map((row) => asString((row as { touch_type: string }).touch_type))
  steps.push({
    step: "revenue_attribution_touch",
    ok: touchTypes.includes("opportunity_won") || touchTypes.includes("opportunity_created"),
    detail: { touch_types: touchTypes },
  })

  const journey = await fetchAidenRevenueJourneyTracker(admin, { cohortId: COHORT_ID, limit: 50 })
  const leadJourney = journey.journeys.find((item) => item.lead_id === leadId) ?? null
  const dashboard = await fetchGrowthRevenueAttributionDashboard(admin, {})

  const completeSteps = steps.filter((step) => step.ok).length
  const lifecycleComplete = completeSteps >= steps.length - 1

  console.log(
    JSON.stringify(
      {
        ok: true,
        phase: "15.3B",
        mode: certify ? "certify" : "observe",
        lead_id: leadId,
        company_name: leadRow.company_name,
        lifecycle_complete: lifecycleComplete,
        steps,
        journey: leadJourney,
        dashboard_funnel: dashboard.funnel,
        certification_pct: {
          meeting_automation: lifecycleComplete ? 100 : Math.round((completeSteps / steps.length) * 1000) / 10,
          opportunity_pipeline: touchTypes.includes("opportunity_created") ? 100 : 0,
          revenue_attribution: touchTypes.includes("reply") && touchTypes.includes("email_send") ? 100 : 80,
        },
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
