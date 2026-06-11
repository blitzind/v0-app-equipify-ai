/** AI Meeting Prep service — generate and persist review-only artifacts. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { insertGrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-repository"
import { GROWTH_AI_COPILOT_PROMPT_VERSION } from "@/lib/growth/ai-copilot-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  AI_MEETING_PREP_SAFETY_FLAGS,
  mapAiMeetingPrepDbRow,
} from "@/lib/growth/meeting-intelligence/ai-meeting-prep-evidence"
import {
  buildAiMeetingPrepInputHash,
  generateAiMeetingPrep,
} from "@/lib/growth/meeting-intelligence/ai-meeting-prep-generator"
import type {
  AiMeetingPrepGenerateResult,
  AiMeetingPrepGeneratorInput,
  AiMeetingPrepRow,
} from "@/lib/growth/meeting-intelligence/ai-meeting-prep-types"
import { AI_MEETING_PREP_QA_MARKER } from "@/lib/growth/meeting-intelligence/ai-meeting-prep-types"
import { fetchGrowthMeetingById } from "@/lib/growth/meeting-intelligence/meeting-repository"
import { gatherMeetingPrepBundleForMeeting } from "@/lib/growth/meeting-intelligence/meeting-prep-context"

const TABLE = "ai_meeting_preparations"

async function markExistingDraftsStale(
  admin: SupabaseClient,
  meetingId: string,
): Promise<void> {
  const now = new Date().toISOString()
  await admin
    .schema("growth")
    .from(TABLE)
    .update({
      status: "stale",
      updated_at: now,
      metadata: { qa_marker: AI_MEETING_PREP_QA_MARKER, stale_reason: "superseded_by_regeneration" },
    })
    .eq("meeting_id", meetingId)
    .eq("status", "draft")
}

async function logAiMeetingPrepAuditGeneration(
  admin: SupabaseClient,
  input: {
    lead_id: string
    meeting_id: string
    executive_brief: string
    input_hash: string
    actor_user_id?: string | null
  },
): Promise<void> {
  try {
    await insertGrowthAiCopilotGeneration(admin, {
      leadId: input.lead_id,
      generationType: "meeting_prep",
      promptVersion: GROWTH_AI_COPILOT_PROMPT_VERSION,
      promptVariant: "default",
      inputSnapshot: {
        qa_marker: AI_MEETING_PREP_QA_MARKER,
        meeting_id: input.meeting_id,
        input_hash: input.input_hash,
      },
      generatedContent: input.executive_brief.slice(0, 4000),
      generatedSubject: "AI Meeting Prep",
      classification: {
        primary: "meeting_prep",
        callPrep: { riskSummary: "Review-only AI meeting prep artifact." },
      },
      sourceReplyId: null,
      inputHash: input.input_hash,
      playbookInfluenceScore: 0,
      playbookAttribution: {},
      createdBy: input.actor_user_id ?? null,
    })
  } catch {
    // Audit logging is best-effort; durable artifact lives in ai_meeting_preparations.
  }
}

export async function fetchLatestAiMeetingPrepForMeeting(
  admin: SupabaseClient,
  meetingId: string,
): Promise<AiMeetingPrepRow | null> {
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
  return data ? mapAiMeetingPrepDbRow(data as Record<string, unknown>) : null
}

export async function generateAndPersistAiMeetingPrep(
  admin: SupabaseClient,
  input: {
    meeting_id: string
    actor_user_id?: string | null
    actor_email?: string | null
    regenerate?: boolean
  },
): Promise<AiMeetingPrepGenerateResult> {
  const meeting = await fetchGrowthMeetingById(admin, input.meeting_id)
  if (!meeting) {
    return {
      ok: false,
      prep: null,
      artifacts: null,
      error: "meeting_not_found",
      ...AI_MEETING_PREP_SAFETY_FLAGS,
    }
  }

  const prepBundle = await gatherMeetingPrepBundleForMeeting(admin, meeting)
  if (!prepBundle) {
    return {
      ok: false,
      prep: null,
      artifacts: null,
      error: "prep_bundle_not_found",
      ...AI_MEETING_PREP_SAFETY_FLAGS,
    }
  }

  const lead = await fetchGrowthLeadById(admin, meeting.leadId)

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

  const generatorInput: AiMeetingPrepGeneratorInput = {
    meeting_id: meeting.id,
    prep_bundle: prepBundle,
    account_playbook_context: prepBundle.accountPlaybookContext,
    decision_makers: prepBundle.decisionMakers,
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
    opportunity_readiness: {
      tier: lead?.opportunityReadinessTier ?? null,
      score: lead?.score ?? null,
    },
    meeting_readiness: {
      score: prepBundle.readiness.score,
      label: prepBundle.readiness.label,
    },
  }

  const artifacts = generateAiMeetingPrep(generatorInput)
  const inputHash = buildAiMeetingPrepInputHash(generatorInput)

  if (input.regenerate) {
    await markExistingDraftsStale(admin, meeting.id)
  } else {
    const existingDraft = await fetchLatestAiMeetingPrepForMeeting(admin, meeting.id)
    if (existingDraft?.status === "draft") {
      return {
        ok: true,
        prep: existingDraft,
        artifacts,
        ...AI_MEETING_PREP_SAFETY_FLAGS,
      }
    }
  }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .insert({
      meeting_id: meeting.id,
      lead_id: meeting.leadId,
      account_playbook_id: meeting.accountPlaybookId ?? prepBundle.accountPlaybookContext?.accountPlaybookId ?? null,
      meeting_candidate_id: meeting.meetingCandidateId ?? prepBundle.accountPlaybookContext?.meetingCandidateId ?? null,
      source_attribution:
        meeting.sourceAttribution ??
        prepBundle.accountPlaybookContext?.sourceAttribution ??
        {},
      status: "draft",
      executive_brief: artifacts.executive_brief,
      meeting_objective: artifacts.meeting_objective,
      suggested_agenda: artifacts.suggested_agenda,
      stakeholder_analysis: artifacts.stakeholder_analysis,
      likely_objections: artifacts.likely_objections,
      discovery_questions: artifacts.discovery_questions,
      competitive_risks: artifacts.competitive_risks,
      recommended_outcome: artifacts.recommended_outcome,
      confidence_score: artifacts.confidence_score,
      reasoning: artifacts.reasoning,
      input_hash: inputHash,
      outreach_sent: false,
      calendar_written: false,
      meeting_scheduled: false,
      opportunity_created: false,
      autonomous_reply_sent: false,
      metadata: {
        qa_marker: AI_MEETING_PREP_QA_MARKER,
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
      prep: null,
      artifacts,
      error: error?.message ?? "ai_meeting_prep_insert_failed",
      ...AI_MEETING_PREP_SAFETY_FLAGS,
    }
  }

  const prep = mapAiMeetingPrepDbRow(data as Record<string, unknown>)

  await logAiMeetingPrepAuditGeneration(admin, {
    lead_id: meeting.leadId,
    meeting_id: meeting.id,
    executive_brief: artifacts.executive_brief,
    input_hash: inputHash,
    actor_user_id: input.actor_user_id,
  })

  await logGrowthEngine("ai_meeting_prep_generated", {
    prep_id: prep.prep_id,
    meeting_id: meeting.id,
    lead_id: meeting.leadId,
    confidence_score: prep.confidence_score,
    ...AI_MEETING_PREP_SAFETY_FLAGS,
  })

  return {
    ok: true,
    prep,
    artifacts,
    ...AI_MEETING_PREP_SAFETY_FLAGS,
  }
}
