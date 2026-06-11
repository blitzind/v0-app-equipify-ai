/** Opportunity Draft service — generate and persist recommendation-only drafts. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { mapMeetingOutcomeScoreRow } from "@/lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-repository"
import {
  buildOpportunityDraftAttributionRecord,
  evaluateOpportunityDraftDuplicateBlock,
  mapOpportunityDraftDbRow,
  OPPORTUNITY_DRAFT_SAFETY_FLAGS,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-evidence"
import {
  buildOpportunityDraftInputHash,
  generateOpportunityDraftFromMeeting,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-generator"
import type {
  OpportunityDraftGeneratorInput,
  OpportunityDraftRow,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"
import { OPPORTUNITY_DRAFT_ENGINE_QA_MARKER } from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"
import { fetchGrowthMeetingById } from "@/lib/growth/meeting-intelligence/meeting-repository"
import { gatherMeetingPrepBundleForMeeting } from "@/lib/growth/meeting-intelligence/meeting-prep-context"

const TABLE = "opportunity_drafts"

async function fetchLatestMeetingOutcomeScoreForMeeting(
  admin: SupabaseClient,
  meetingId: string,
) {
  const { data, error } = await admin
    .schema("growth")
    .from("meeting_outcome_intelligence_scores")
    .select(
      "id, lead_id, meeting_id, opportunity_id, owner_user_id, meeting_outcome_score, meeting_quality_score, next_step_confidence, follow_up_recommendation, buying_signal_count, objection_count, champion_detected, decision_maker_present, timeline_detected, budget_signal, urgency_signal, no_show_risk_pattern, momentum_trend, recommended_next_step, safe_summary, computed_at",
    )
    .eq("meeting_id", meetingId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapMeetingOutcomeScoreRow(data as never) : null
}

async function markExistingDraftsStale(admin: SupabaseClient, meetingId: string): Promise<void> {
  const now = new Date().toISOString()
  await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "stale",
      updated_at: now,
      metadata: { qa_marker: OPPORTUNITY_DRAFT_ENGINE_QA_MARKER, stale_reason: "superseded_by_regeneration" },
    })
    .eq("meeting_id", meetingId)
    .eq("status", "draft")
}

export async function fetchLatestOpportunityDraftForMeeting(
  admin: SupabaseClient,
  meetingId: string,
): Promise<OpportunityDraftRow | null> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .eq("meeting_id", meetingId)
    .in("status", ["draft", "approved"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapOpportunityDraftDbRow(data as Record<string, unknown>) : null
}

async function buildOpportunityDraftGeneratorInput(
  admin: SupabaseClient,
  meetingId: string,
): Promise<{ meeting: NonNullable<Awaited<ReturnType<typeof fetchGrowthMeetingById>>>; input: OpportunityDraftGeneratorInput; companyName: string } | null> {
  const meeting = await fetchGrowthMeetingById(admin, meetingId)
  if (!meeting) return null

  const prepBundle = await gatherMeetingPrepBundleForMeeting(admin, meeting)
  if (!prepBundle) return null

  const lead = await fetchGrowthLeadById(admin, meeting.leadId)
  const meetingOutcomeIntelligence = await fetchLatestMeetingOutcomeScoreForMeeting(admin, meetingId)

  let replyIntent: string | null = null
  let replyBody: string | null = null
  if (meeting.outboundReplyId) {
    const { data: replyRow } = await admin
      .schema("growth")
      .from("outbound_replies")
      .select("intent, classification_v2, body_preview")
      .eq("id", meeting.outboundReplyId)
      .maybeSingle()
    replyIntent =
      (typeof replyRow?.classification_v2 === "string" ? replyRow.classification_v2 : null) ??
      (typeof replyRow?.intent === "string" ? replyRow.intent : null)
    replyBody = typeof replyRow?.body_preview === "string" ? replyRow.body_preview : null
  }

  const input: OpportunityDraftGeneratorInput = {
    meeting,
    meeting_outcome_intelligence: meetingOutcomeIntelligence,
    meeting_notes: meeting.notes,
    meeting_readiness: prepBundle.readiness,
    account_playbook_context: prepBundle.accountPlaybookContext,
    qualification: {
      score: lead?.score ?? prepBundle.leadScore.score,
      tier: lead?.opportunityReadinessTier ?? null,
    },
    conversation_intelligence: {
      competitor_mentions: lead?.conversationCompetitorMentions.map((item) => item.name) ?? [],
      competitor_pressure: lead?.conversationCompetitorPressure ?? null,
      momentum_summary: lead?.momentumWhySummary ?? null,
    },
    reply_intelligence: replyIntent
      ? {
          intent: replyIntent,
          body_preview: replyBody,
        }
      : undefined,
    decision_makers: prepBundle.decisionMakers,
  }

  return {
    meeting,
    input,
    companyName: lead?.companyName ?? (meeting.title.replace(/^Meeting with /i, "") || "Account"),
  }
}

export async function generateAndPersistOpportunityDraft(
  admin: SupabaseClient,
  input: {
    meeting_id: string
    actor_user_id?: string | null
    actor_email?: string | null
    regenerate?: boolean
    trigger?: "meeting_completed" | "meeting_outcome" | "manual"
  },
): Promise<{
  ok: boolean
  draft: OpportunityDraftRow | null
  artifacts: ReturnType<typeof generateOpportunityDraftFromMeeting> | null
  skipped_duplicate: boolean
  error?: string | null
}> {
  const built = await buildOpportunityDraftGeneratorInput(admin, input.meeting_id)
  if (!built) {
    return {
      ok: false,
      draft: null,
      artifacts: null,
      skipped_duplicate: false,
      error: "generator_input_not_found",
      ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
    }
  }

  if (built.meeting.status !== "completed") {
    return {
      ok: false,
      draft: null,
      artifacts: null,
      skipped_duplicate: false,
      error: "meeting_not_completed",
      ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
    }
  }

  const artifacts = generateOpportunityDraftFromMeeting(built.input)
  const inputHash = buildOpportunityDraftInputHash(built.input)

  if (input.regenerate) {
    await markExistingDraftsStale(admin, built.meeting.id)
  } else {
    const existingDraft = await fetchLatestOpportunityDraftForMeeting(admin, built.meeting.id)
    if (existingDraft) {
      const duplicate = evaluateOpportunityDraftDuplicateBlock({ existing_status: existingDraft.status })
      if (duplicate.blocked) {
        return {
          ok: true,
          draft: existingDraft,
          artifacts,
          skipped_duplicate: true,
          ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
        }
      }
    }
  }

  const sourceAttribution = buildOpportunityDraftAttributionRecord(
    built.meeting.sourceAttribution ?? built.input.account_playbook_context?.sourceAttribution ?? null,
  )

  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .insert({
      meeting_id: built.meeting.id,
      lead_id: built.meeting.leadId,
      company_id: null,
      account_playbook_id:
        built.meeting.accountPlaybookId ?? built.input.account_playbook_context?.accountPlaybookId ?? null,
      company_name: built.companyName,
      status: "draft",
      opportunity_summary: artifacts.opportunity_summary,
      opportunity_type: artifacts.opportunity_type,
      estimated_value: artifacts.estimated_value,
      confidence_score: artifacts.confidence_score,
      recommended_stage: artifacts.recommended_stage,
      key_stakeholders: artifacts.key_stakeholders,
      buying_signals: artifacts.buying_signals,
      risks: artifacts.risks,
      next_steps: artifacts.next_steps,
      reasoning: artifacts.reasoning,
      opportunity_readiness_score: artifacts.opportunity_readiness.opportunity_readiness_score,
      opportunity_readiness_status: artifacts.opportunity_readiness.readiness_status,
      source_attribution: sourceAttribution,
      input_hash: inputHash,
      opportunity_created: false,
      crm_written: false,
      deal_created: false,
      calendar_written: false,
      metadata: {
        qa_marker: OPPORTUNITY_DRAFT_ENGINE_QA_MARKER,
        trigger: input.trigger ?? "manual",
        generated_by: input.actor_user_id ?? null,
        generated_email: input.actor_email ?? null,
      },
      updated_at: now,
    })
    .select("*")
    .single()

  if (error || !data) {
    return {
      ok: false,
      draft: null,
      artifacts,
      skipped_duplicate: false,
      error: error?.message ?? "opportunity_draft_insert_failed",
      ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
    }
  }

  const draft = mapOpportunityDraftDbRow(data as Record<string, unknown>)

  await logGrowthEngine("opportunity_draft_generated", {
    draft_id: draft.draft_id,
    meeting_id: built.meeting.id,
    lead_id: built.meeting.leadId,
    confidence_score: draft.confidence_score,
    readiness_score: draft.opportunity_readiness_score,
    trigger: input.trigger ?? "manual",
    ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
  })

  return {
    ok: true,
    draft,
    artifacts,
    skipped_duplicate: false,
    ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
  }
}

export async function maybeGenerateOpportunityDraftForMeeting(
  admin: SupabaseClient,
  meetingId: string,
  input?: {
    regenerate?: boolean
    trigger?: "meeting_completed" | "meeting_outcome"
    actor_user_id?: string | null
    actor_email?: string | null
  },
): Promise<void> {
  const meeting = await fetchGrowthMeetingById(admin, meetingId)
  if (!meeting || meeting.status !== "completed") return

  await generateAndPersistOpportunityDraft(admin, {
    meeting_id: meetingId,
    regenerate: input?.regenerate ?? false,
    trigger: input?.trigger ?? "meeting_completed",
    actor_user_id: input?.actor_user_id ?? null,
    actor_email: input?.actor_email ?? null,
  })
}
