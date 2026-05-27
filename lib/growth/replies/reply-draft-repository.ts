import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runAiTask } from "@/lib/ai/server"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { growthAiCopilotModelSchema, mapGrowthAiCopilotModelOutput } from "@/lib/growth/ai-copilot-schema"
import { runGrowthAiCopilotGeneration } from "@/lib/growth/run-ai-copilot-generation"
import { assertPreSendSuppressionAllowed } from "@/lib/growth/compliance/suppression-engine"
import { addInboxMessage } from "@/lib/growth/inbox/thread-repository"
import { executeTransportSend } from "@/lib/growth/providers/transport/transport-orchestrator"
import {
  buildReplyDraftSnapshotOverrides,
  buildReplyDraftContext,
} from "@/lib/growth/replies/reply-context-builder"
import {
  insertReplyDraftEvent,
  recordReplyDraftLeadTimeline,
  recordReplyDraftPlatformTimeline,
} from "@/lib/growth/replies/reply-draft-events"
import {
  buildReplyDraftSystemPrompt,
  buildReplyDraftUserPrompt,
  fallbackReplyDraft,
} from "@/lib/growth/replies/reply-prompt"
import { assertReplyDraftApproved, evaluateReplyRiskGuard } from "@/lib/growth/replies/reply-risk-guard"
import { buildApprovedReplySendPayload } from "@/lib/growth/replies/reply-send-builder"
import type {
  GrowthReplyDraft,
  GrowthReplyDraftStatus,
  GrowthReplyDraftType,
  GrowthReplyDraftView,
} from "@/lib/growth/replies/reply-draft-types"
import { maskReplyDraftLeadLabel } from "@/lib/growth/replies/reply-draft-types"
import { GROWTH_REPLY_DRAFT_AI_TASK } from "@/lib/growth/replies/reply-draft-types"

type Row = Record<string, unknown>

function draftsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("inbox_reply_drafts")
}

function mapDraft(row: Row): GrowthReplyDraft {
  return {
    id: String(row.id),
    inboxThreadId: String(row.inbox_thread_id),
    inboxMessageId: row.inbox_message_id ? String(row.inbox_message_id) : null,
    leadId: row.lead_id ? String(row.lead_id) : null,
    sequenceEnrollmentId: row.sequence_enrollment_id ? String(row.sequence_enrollment_id) : null,
    aiGenerationId: row.ai_generation_id ? String(row.ai_generation_id) : null,
    status: String(row.status) as GrowthReplyDraftStatus,
    draftSubject: row.draft_subject ? String(row.draft_subject) : null,
    draftBody: String(row.draft_body ?? ""),
    classification: row.classification ? String(row.classification) : null,
    tone: String(row.tone ?? "professional"),
    confidence: Number(row.confidence ?? 0),
    riskLevel: String(row.risk_level) as GrowthReplyDraft["riskLevel"],
    requiresHumanReview: Boolean(row.requires_human_review),
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    discardedAt: row.discarded_at ? String(row.discarded_at) : null,
    discardedBy: row.discarded_by ? String(row.discarded_by) : null,
    sentDeliveryAttemptId: row.sent_delivery_attempt_id ? String(row.sent_delivery_attempt_id) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function getReplyDraft(admin: SupabaseClient, draftId: string): Promise<GrowthReplyDraft | null> {
  const { data, error } = await draftsTable(admin).select("*").eq("id", draftId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapDraft(data as Row) : null
}

export async function listReplyDrafts(
  admin: SupabaseClient,
  input?: { threadId?: string; status?: GrowthReplyDraftStatus; limit?: number },
): Promise<GrowthReplyDraft[]> {
  let query = draftsTable(admin).select("*").order("created_at", { ascending: false }).limit(input?.limit ?? 100)
  if (input?.threadId) query = query.eq("inbox_thread_id", input.threadId)
  if (input?.status) query = query.eq("status", input.status)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapDraft(row as Row))
}

export async function enrichReplyDraftViews(
  admin: SupabaseClient,
  drafts: GrowthReplyDraft[],
): Promise<GrowthReplyDraftView[]> {
  if (drafts.length === 0) return []
  const threadIds = [...new Set(drafts.map((draft) => draft.inboxThreadId))]
  const leadIds = [...new Set(drafts.map((draft) => draft.leadId).filter(Boolean))] as string[]

  const [threadsRes, leadsRes] = await Promise.all([
    admin.schema("growth").from("inbox_threads").select("id, subject, lead_id").in("id", threadIds),
    leadIds.length > 0
      ? admin.schema("growth").from("leads").select("id, company_name").in("id", leadIds)
      : Promise.resolve({ data: [] }),
  ])

  const subjectMap = new Map((threadsRes.data ?? []).map((row) => [String((row as Row).id), String((row as Row).subject)]))
  const leadMap = new Map((leadsRes.data ?? []).map((row) => [String((row as Row).id), String((row as Row).company_name)]))

  return drafts.map((draft) => ({
    ...draft,
    leadLabel: maskReplyDraftLeadLabel(draft.leadId, draft.leadId ? leadMap.get(draft.leadId) : null),
    threadSubject: subjectMap.get(draft.inboxThreadId) ?? "Thread",
  }))
}

async function insertDraft(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<GrowthReplyDraft> {
  const now = new Date().toISOString()
  const { data, error } = await draftsTable(admin)
    .insert({ ...row, created_at: now, updated_at: now })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapDraft(data as Row)
}

export async function generateInboxReplyDraft(
  admin: SupabaseClient,
  input: {
    inboxThreadId: string
    draftType?: GrowthReplyDraftType
    actingUserId: string
    actingUserEmail: string
  },
): Promise<GrowthReplyDraft> {
  const built = await buildReplyDraftContext(admin, {
    inboxThreadId: input.inboxThreadId,
    draftType: input.draftType,
  })
  if (!built.ok) throw new Error(built.code)

  const risk = await evaluateReplyRiskGuard(admin, {
    leadId: built.leadId,
    recipientEmail: built.recipientEmail,
    threadStatus: built.threadStatus,
    hasInboundMessage: Boolean(built.inboxMessageId),
    classification: built.context.classification,
  })

  if (!risk.allowed) {
    const blocked = await insertDraft(admin, {
      inbox_thread_id: input.inboxThreadId,
      inbox_message_id: built.inboxMessageId,
      lead_id: built.leadId,
      sequence_enrollment_id: built.sequenceEnrollmentId,
      status: "blocked",
      draft_subject: built.context.threadSubject,
      draft_body: "",
      classification: built.context.classification,
      tone: "professional",
      confidence: 0,
      risk_level: "blocked",
      requires_human_review: true,
      metadata: { block_code: risk.blockCode, draft_type: built.context.draftType },
    })
    await insertReplyDraftEvent(admin, {
      replyDraftId: blocked.id,
      eventType: "reply_draft_blocked",
      title: "Reply draft blocked",
      description: risk.message,
      severity: "high",
    })
    await recordReplyDraftPlatformTimeline(admin, {
      eventType: "reply_draft_blocked",
      title: "Reply draft blocked",
      summary: risk.message,
      leadId: built.leadId,
      threadId: input.inboxThreadId,
      draftId: blocked.id,
    })
    return blocked
  }

  let aiGenerationId: string | null = null
  let subject = built.context.threadSubject.startsWith("Re:") ? built.context.threadSubject : `Re: ${built.context.threadSubject}`
  let body = ""
  let tone = "professional"
  let confidence = 60
  let classification = built.context.classification

  const copilot = await runGrowthAiCopilotGeneration({
    admin,
    leadId: built.leadId,
    generationType: "response_draft",
    snapshotOverrides: buildReplyDraftSnapshotOverrides(built.context),
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
  })

  if (copilot.ok) {
    aiGenerationId = copilot.generation.id
    subject = copilot.generation.generatedSubject ?? subject
    body = copilot.generation.generatedContent
    classification = String(copilot.generation.classification?.primary ?? classification)
    confidence = Math.round((copilot.generation.classification?.confidence ?? 0.7) * 100)
  } else if (process.env.GROWTH_INBOX_SYNC_SIMULATE?.trim() === "true" || process.env.GROWTH_TRANSPORT_SIMULATE === "true") {
    const fallback = fallbackReplyDraft(built.context)
    subject = fallback.subject
    body = fallback.body
    tone = fallback.tone
    confidence = fallback.confidence
  } else {
    const orgId = getGrowthEngineAiOrgId()
    const ai =
      orgId &&
      (await runAiTask({
        task: GROWTH_REPLY_DRAFT_AI_TASK,
        organizationId: orgId,
        input: {
          system: buildReplyDraftSystemPrompt(built.context),
          user: buildReplyDraftUserPrompt(built.context),
        },
        schema: growthAiCopilotModelSchema,
        skipPlanGateCheck: true,
        skipBudgetCheck: true,
        cacheSchemaVersion: `growth_reply_draft_${built.context.draftType}_v1`,
        taskOverrides: { structuredMode: "json_object" },
      }).catch(() => null))

    if (ai?.ok) {
      const mapped = mapGrowthAiCopilotModelOutput(ai.output, "response_draft")
      subject = mapped.generatedSubject ?? subject
      body = mapped.generatedContent
      confidence = Math.round((mapped.classification.confidence ?? 0.65) * 100)
      classification = String(mapped.classification.primary ?? classification)
    } else {
      const fallback = fallbackReplyDraft(built.context)
      subject = fallback.subject
      body = fallback.body
      tone = fallback.tone
      confidence = fallback.confidence
    }
  }

  const draft = await insertDraft(admin, {
    inbox_thread_id: input.inboxThreadId,
    inbox_message_id: built.inboxMessageId,
    lead_id: built.leadId,
    sequence_enrollment_id: built.sequenceEnrollmentId,
    ai_generation_id: aiGenerationId,
    status: "draft",
    draft_subject: subject,
    draft_body: body,
    classification,
    tone,
    confidence,
    risk_level: risk.riskLevel,
    requires_human_review: true,
    metadata: {
      draft_type: built.context.draftType,
      playbook_influence: built.context.playbookInfluence,
      compliance_flags: built.context.complianceFlags,
    },
  })

  await insertReplyDraftEvent(admin, {
    replyDraftId: draft.id,
    eventType: "reply_draft_generated",
    title: "Reply draft generated",
    description: "AI reply draft created for human review.",
  })
  await recordReplyDraftPlatformTimeline(admin, {
    eventType: "reply_draft_generated",
    title: "Reply draft generated",
    leadId: built.leadId,
    threadId: input.inboxThreadId,
    draftId: draft.id,
  })
  await recordReplyDraftLeadTimeline(admin, {
    leadId: built.leadId,
    eventType: "reply_draft_generated",
    title: "Reply draft generated",
    draftId: draft.id,
  })

  return draft
}

export async function updateReplyDraft(
  admin: SupabaseClient,
  draftId: string,
  patch: { draftSubject?: string; draftBody?: string; tone?: string },
): Promise<GrowthReplyDraft> {
  const existing = await getReplyDraft(admin, draftId)
  if (!existing) throw new Error("draft_not_found")
  if (!["draft", "approved"].includes(existing.status)) throw new Error("invalid_status")

  const { data, error } = await draftsTable(admin)
    .update({
      draft_subject: patch.draftSubject ?? existing.draftSubject,
      draft_body: patch.draftBody ?? existing.draftBody,
      tone: patch.tone ?? existing.tone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", draftId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapDraft(data as Row)
}

export async function approveReplyDraft(
  admin: SupabaseClient,
  input: { draftId: string; approvedBy: string },
): Promise<GrowthReplyDraft> {
  const existing = await getReplyDraft(admin, input.draftId)
  if (!existing) throw new Error("draft_not_found")
  if (existing.status === "blocked") throw new Error("draft_blocked")
  if (existing.status === "sent") return existing

  const now = new Date().toISOString()
  const { data, error } = await draftsTable(admin)
    .update({
      status: "approved",
      approved_at: now,
      approved_by: input.approvedBy,
      updated_at: now,
    })
    .eq("id", input.draftId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  const draft = mapDraft(data as Row)

  await insertReplyDraftEvent(admin, {
    replyDraftId: draft.id,
    eventType: "reply_draft_approved",
    title: "Reply draft approved",
    description: "Human approval recorded — send still requires explicit action.",
  })
  if (draft.leadId) {
    await recordReplyDraftLeadTimeline(admin, {
      leadId: draft.leadId,
      eventType: "reply_draft_approved",
      title: "Reply draft approved",
      draftId: draft.id,
    })
  }
  await recordReplyDraftPlatformTimeline(admin, {
    eventType: "reply_draft_approved",
    title: "Reply draft approved",
    leadId: draft.leadId,
    threadId: draft.inboxThreadId,
    draftId: draft.id,
  })

  return draft
}

export async function discardReplyDraft(
  admin: SupabaseClient,
  input: { draftId: string; discardedBy: string },
): Promise<GrowthReplyDraft> {
  const existing = await getReplyDraft(admin, input.draftId)
  if (!existing) throw new Error("draft_not_found")
  if (existing.status === "sent") throw new Error("already_sent")

  const now = new Date().toISOString()
  const { data, error } = await draftsTable(admin)
    .update({
      status: "discarded",
      discarded_at: now,
      discarded_by: input.discardedBy,
      updated_at: now,
    })
    .eq("id", input.draftId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  const draft = mapDraft(data as Row)

  await insertReplyDraftEvent(admin, {
    replyDraftId: draft.id,
    eventType: "reply_draft_discarded",
    title: "Reply draft discarded",
  })
  if (draft.leadId) {
    await recordReplyDraftLeadTimeline(admin, {
      leadId: draft.leadId,
      eventType: "reply_draft_discarded",
      title: "Reply draft discarded",
      draftId: draft.id,
    })
  }

  return draft
}

export async function sendApprovedReplyDraft(
  admin: SupabaseClient,
  input: {
    draftId: string
    actingUserId: string
    actingUserEmail: string
    humanApproved?: boolean
    humanApprovalConfirmed?: boolean
  },
): Promise<{ draft: GrowthReplyDraft; deliveryAttemptId: string | null }> {
  const existing = await getReplyDraft(admin, input.draftId)
  if (!existing) throw new Error("draft_not_found")

  assertReplyDraftApproved({
    status: existing.status,
    requiresHumanReview: existing.requiresHumanReview,
    humanApproved: input.humanApproved ?? true,
    humanApprovalConfirmed: input.humanApprovalConfirmed ?? true,
  })

  if (existing.sentDeliveryAttemptId) {
    return { draft: existing, deliveryAttemptId: existing.sentDeliveryAttemptId }
  }

  const payload = await buildApprovedReplySendPayload(admin, { draft: existing })
  if ("error" in payload) throw new Error(payload.error)

  const suppression = await assertPreSendSuppressionAllowed(admin, {
    email: payload.to,
    leadId: existing.leadId,
    senderAccountId: payload.senderAccountId,
  })
  if (!suppression.allowed) throw new Error(suppression.reason ?? "suppression_blocked")

  const transport = await executeTransportSend(admin, {
    sender_account_id: payload.senderAccountId,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    lead_id: existing.leadId,
    sequence_enrollment_id: existing.sequenceEnrollmentId,
    human_approved: true,
    human_approval_confirmed: true,
    actorUserId: input.actingUserId,
    actorEmail: input.actingUserEmail,
  })

  if (!transport.ok || !transport.attempt) throw new Error(transport.error ?? "transport_failed")

  const now = new Date().toISOString()
  const { data, error } = await draftsTable(admin)
    .update({
      status: "sent",
      sent_delivery_attempt_id: transport.attempt.id,
      updated_at: now,
    })
    .eq("id", existing.id)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  const draft = mapDraft(data as Row)

  await addInboxMessage(admin, {
    thread_id: draft.inboxThreadId,
    direction: "outbound",
    sender: "operator",
    recipient: payload.to,
    subject: payload.subject,
    body_preview: payload.text.slice(0, 280),
    provider_message_id: transport.attempt.provider_message_id,
    actorUserId: input.actingUserId,
    actorEmail: input.actingUserEmail,
  })

  await insertReplyDraftEvent(admin, {
    replyDraftId: draft.id,
    eventType: "reply_draft_sent",
    title: "Reply draft sent",
    description: "Approved reply sent via transport orchestrator.",
    metadata: { delivery_attempt_id: transport.attempt.id },
  })
  if (draft.leadId) {
    await recordReplyDraftLeadTimeline(admin, {
      leadId: draft.leadId,
      eventType: "reply_draft_sent",
      title: "Reply draft sent",
      draftId: draft.id,
      payload: { delivery_attempt_id: transport.attempt.id },
    })
  }
  await recordReplyDraftPlatformTimeline(admin, {
    eventType: "reply_draft_sent",
    title: "Reply draft sent",
    leadId: draft.leadId,
    threadId: draft.inboxThreadId,
    draftId: draft.id,
  })

  return { draft, deliveryAttemptId: transport.attempt.id }
}

export async function listReplyDraftEvents(admin: SupabaseClient, draftId: string, limit = 50) {
  const { data, error } = await admin
    .schema("growth")
    .from("inbox_reply_draft_events")
    .select("*")
    .eq("reply_draft_id", draftId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const record = row as Row
    return {
      id: String(record.id),
      replyDraftId: String(record.reply_draft_id),
      eventType: String(record.event_type),
      severity: record.severity as "info" | "low" | "medium" | "high" | "critical",
      title: String(record.title),
      description: String(record.description),
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      createdAt: String(record.created_at),
    }
  })
}
