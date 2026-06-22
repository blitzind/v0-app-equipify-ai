import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listApolloPilotCohorts } from "@/lib/growth/apollo/apollo-pilot-route"
import { resolveApolloCohortLeadIds } from "@/lib/growth/apollo/resolve-apollo-cohort-lead-ids"
import {
  AIDEN_REVENUE_JOURNEY_STAGE_LABELS,
  buildAidenRevenueJourneyTracker,
  type AidenPilotLeadRevenueJourney,
  type AidenRevenueJourneyStage,
  type AidenRevenueJourneyStageKey,
  type AidenRevenueJourneyTracker,
} from "@/lib/growth/aiden/aiden-revenue-journey-types"
import {
  buildGrowthLeadHref,
  buildGrowthMeetingsHref,
  buildGrowthOpportunityHref,
  growthWorkspaceInboxHref,
} from "@/lib/growth/navigation/growth-workspace-operator-links"

type LeadRow = {
  id: string
  company_name: string | null
}

function leadDeepLink(leadId: string): string {
  return buildGrowthLeadHref(leadId)
}

function stageLink(key: AidenRevenueJourneyStageKey, leadId: string): string {
  switch (key) {
    case "email_sent":
      return `/admin/growth/sequences/execution?lead=${leadId}`
    case "reply_received":
      return growthWorkspaceInboxHref({ leadId })
    case "meeting":
      return buildGrowthMeetingsHref({ leadId })
    case "opportunity":
      return buildGrowthOpportunityHref({ leadId })
    case "revenue":
      return `/admin/growth/revenue-attribution?lead=${leadId}`
    default:
      return leadDeepLink(leadId)
  }
}

function currentStageFrom(stages: AidenRevenueJourneyStage[]): AidenRevenueJourneyStageKey {
  const order: AidenRevenueJourneyStageKey[] = [
    "email_sent",
    "reply_received",
    "meeting",
    "opportunity",
    "revenue",
  ]
  let lastComplete: AidenRevenueJourneyStageKey = "email_sent"
  for (const key of order) {
    if (stages.find((stage) => stage.key === key)?.complete) {
      lastComplete = key
    } else {
      return key
    }
  }
  return lastComplete
}

function recommendedAction(stages: AidenRevenueJourneyStage[], companyName: string): string {
  const next = stages.find((stage) => !stage.complete)
  if (!next) return `${companyName} has completed the revenue journey. Review attribution dashboard.`
  switch (next.key) {
    case "email_sent":
      return `Approve and send sequence email for ${companyName}.`
    case "reply_received":
      return `Review ${companyName}'s reply in inbox and classify intent.`
    case "meeting":
      return `Bridge ${companyName} to a meeting candidate and approve scheduling.`
    case "opportunity":
      return `Complete meeting outcome and promote opportunity draft for ${companyName}.`
    case "revenue":
      return `Close won or record revenue attribution for ${companyName}.`
    default:
      return `Review ${companyName} in Growth Engine.`
  }
}

function missingRequirements(stages: AidenRevenueJourneyStage[]): string[] {
  return stages.filter((stage) => !stage.complete).map((stage) => `${stage.label} not complete`)
}

async function loadLeadJourneyContext(
  admin: SupabaseClient,
  leadIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  if (leadIds.length === 0) return new Map()

  const [
    { data: leads },
    { data: touches },
    { data: timeline },
    { data: replies },
    { data: meetings },
    { data: candidates },
    { data: drafts },
    { data: opportunities },
    { data: workflowActions },
  ] = await Promise.all([
    admin.schema("growth").from("leads").select("id,company_name").in("id", leadIds),
    admin
      .schema("growth")
      .from("attribution_touches")
      .select("lead_id,touch_type")
      .in("lead_id", leadIds),
    admin
      .schema("growth")
      .from("lead_timeline_events")
      .select("lead_id,event_type")
      .in("lead_id", leadIds)
      .in("event_type", [
        "sequence_step_sent",
        "reply_received",
        "reply_ingested",
        "meeting_scheduled",
        "meeting_completed",
        "opportunity_created",
        "opportunity_draft_created",
        "opportunity_closed_won",
      ]),
    admin.schema("growth").from("outbound_replies").select("id,lead_id").in("lead_id", leadIds),
    admin.schema("growth").from("meetings").select("id,lead_id,status").in("lead_id", leadIds),
    admin.schema("growth").from("meeting_candidates").select("id,lead_id,status").in("lead_id", leadIds),
    admin.schema("growth").from("opportunity_drafts").select("id,lead_id,status").in("lead_id", leadIds),
    admin
      .schema("growth")
      .from("opportunities")
      .select("id,lead_id,closed_won_at,amount")
      .in("lead_id", leadIds),
    admin.schema("growth").from("reply_workflow_actions").select("id,lead_id,action_type,status").in("lead_id", leadIds),
  ])

  const context = new Map<string, Record<string, unknown>>()
  for (const leadId of leadIds) {
    context.set(leadId, {
      touches: (touches ?? []).filter((row) => String((row as { lead_id: string }).lead_id) === leadId),
      timeline: (timeline ?? []).filter((row) => String((row as { lead_id: string }).lead_id) === leadId),
      replies: (replies ?? []).filter((row) => String((row as { lead_id: string }).lead_id) === leadId),
      meetings: (meetings ?? []).filter((row) => String((row as { lead_id: string }).lead_id) === leadId),
      candidates: (candidates ?? []).filter((row) => String((row as { lead_id: string }).lead_id) === leadId),
      drafts: (drafts ?? []).filter((row) => String((row as { lead_id: string }).lead_id) === leadId),
      opportunities: (opportunities ?? []).filter((row) => String((row as { lead_id: string }).lead_id) === leadId),
      workflowActions: (workflowActions ?? []).filter(
        (row) => String((row as { lead_id: string }).lead_id) === leadId,
      ),
      company_name: (leads ?? []).find((row) => String((row as { id: string }).id) === leadId)?.company_name ?? null,
    })
  }

  return context
}

function buildStagesForLead(leadId: string, ctx: Record<string, unknown>): AidenRevenueJourneyStage[] {
  const touches = (ctx.touches as Array<{ touch_type: string }>) ?? []
  const timeline = (ctx.timeline as Array<{ event_type: string }>) ?? []
  const replies = (ctx.replies as unknown[]) ?? []
  const meetings = (ctx.meetings as Array<{ status: string }>) ?? []
  const candidates = (ctx.candidates as Array<{ status: string }>) ?? []
  const drafts = (ctx.drafts as Array<{ status: string }>) ?? []
  const opportunities = (ctx.opportunities as Array<{ closed_won_at: string | null; amount: number }>) ?? []

  const touchTypes = new Set(touches.map((row) => row.touch_type))
  const timelineTypes = new Set(timeline.map((row) => row.event_type))

  const emailSent =
    touchTypes.has("email_send") ||
    touchTypes.has("sms_send") ||
    timelineTypes.has("sequence_step_sent")

  const replyReceived =
    touchTypes.has("reply") ||
    replies.length > 0 ||
    timelineTypes.has("reply_received") ||
    timelineTypes.has("reply_ingested")

  const meetingComplete =
    touchTypes.has("meeting") ||
    meetings.length > 0 ||
    candidates.some((row) => row.status === "approved") ||
    timelineTypes.has("meeting_scheduled") ||
    timelineTypes.has("meeting_completed")

  const opportunityComplete =
    touchTypes.has("opportunity_created") ||
    drafts.some((row) => ["approved", "converted"].includes(row.status)) ||
    opportunities.length > 0 ||
    timelineTypes.has("opportunity_created") ||
    timelineTypes.has("opportunity_draft_created")

  const revenueComplete =
    touchTypes.has("opportunity_won") ||
    opportunities.some((row) => Boolean(row.closed_won_at)) ||
    timelineTypes.has("opportunity_closed_won")

  const defs: Array<{ key: AidenRevenueJourneyStageKey; complete: boolean; detail: string | null }> = [
    {
      key: "email_sent",
      complete: emailSent,
      detail: emailSent ? "Sequence email sent with attribution touch." : "No send attribution or sequence timeline event.",
    },
    {
      key: "reply_received",
      complete: replyReceived,
      detail: replyReceived ? `${replies.length || 1} reply event(s) recorded.` : "Awaiting inbound reply.",
    },
    {
      key: "meeting",
      complete: meetingComplete,
      detail: meetingComplete
        ? `${meetings.length} meeting(s), ${candidates.length} candidate(s).`
        : "No meeting candidate or scheduled meeting.",
    },
    {
      key: "opportunity",
      complete: opportunityComplete,
      detail: opportunityComplete
        ? `${opportunities.length} opportunity record(s), ${drafts.length} draft(s).`
        : "No opportunity draft or pipeline record.",
    },
    {
      key: "revenue",
      complete: revenueComplete,
      detail: revenueComplete ? "Closed won or revenue attribution recorded." : "No closed-won revenue yet.",
    },
  ]

  return defs.map((def) => ({
    key: def.key,
    label: AIDEN_REVENUE_JOURNEY_STAGE_LABELS[def.key],
    complete: def.complete,
    detail: def.detail,
    deep_link: stageLink(def.key, leadId),
  }))
}

function buildLeadJourney(leadId: string, ctx: Record<string, unknown>): AidenPilotLeadRevenueJourney {
  const stages = buildStagesForLead(leadId, ctx)
  const companyName = String(ctx.company_name ?? "Lead")
  return {
    lead_id: leadId,
    company_name: companyName,
    current_stage: currentStageFrom(stages),
    stages,
    missing_requirements: missingRequirements(stages),
    recommended_next_action: recommendedAction(stages, companyName),
  }
}

export async function fetchAidenRevenueJourneyTracker(
  admin: SupabaseClient,
  input?: { cohortId?: string | null; limit?: number },
): Promise<AidenRevenueJourneyTracker> {
  let cohortId = input?.cohortId?.trim() || null
  let leadIds: string[] = []

  if (cohortId) {
    const resolved = await resolveApolloCohortLeadIds(admin, cohortId)
    leadIds = resolved?.lead_ids ?? []
  } else {
    const cohorts = await listApolloPilotCohorts(admin)
    const active = cohorts.find((cohort) => cohort.status === "active") ?? cohorts[0]
    cohortId = active?.id ?? null
    if (cohortId) {
      const resolved = await resolveApolloCohortLeadIds(admin, cohortId)
      leadIds = resolved?.lead_ids ?? []
    }
  }

  const limit = input?.limit ?? 25
  leadIds = leadIds.slice(0, limit)

  const context = await loadLeadJourneyContext(admin, leadIds)
  const journeys = leadIds.map((leadId) => buildLeadJourney(leadId, context.get(leadId) ?? {}))

  journeys.sort((a, b) => {
    const score = (journey: AidenPilotLeadRevenueJourney) =>
      journey.stages.filter((stage) => stage.complete).length
    return score(b) - score(a)
  })

  return buildAidenRevenueJourneyTracker({ cohortId, journeys })
}
