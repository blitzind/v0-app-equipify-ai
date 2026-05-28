import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildInboxDashboard, buildReplyIntelligenceSummary } from "@/lib/growth/inbox/inbox-dashboard"
import { classifyReply } from "@/lib/growth/inbox/reply-classifier"
import {
  buildReplyIntelligenceEvents,
  buildThreadOwnerAssignedEvent,
} from "@/lib/growth/inbox/reply-event-builder"
import { listReplyIntelligenceEvents, persistReplyEventDrafts } from "@/lib/growth/inbox/reply-events"
import { evaluateThreadHealth } from "@/lib/growth/inbox/thread-health"
import { recordExperimentEngagementForLead } from "@/lib/growth/experiments/experiment-metrics"
import { recordMeetingAttributionForLead } from "@/lib/growth/revenue-intelligence/revenue-attribution"
import { computeThreadPriorityScore, priorityScoreToTier } from "@/lib/growth/inbox/thread-priority"
import type {
  GrowthInboxDashboard,
  GrowthInboxMessage,
  GrowthInboxMessageDirection,
  GrowthInboxThread,
  GrowthInboxThreadStatus,
  GrowthReplyIntelligenceEvent,
  GrowthReplyIntelligenceSummary,
} from "@/lib/growth/inbox/inbox-types"
import { computeInboxThreadSlaDueAt } from "@/lib/growth/inbox-team-ownership/inbox-sla-tracker"
import { formatLeadLabel } from "@/lib/growth/lead-label"

type Row = Record<string, unknown>

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function threadsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("inbox_threads")
}

function messagesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("inbox_messages")
}

function formatOwnerLabel(email: string | null | undefined): string {
  const normalized = asString(email)
  if (!normalized) return "Operator"
  const local = normalized.split("@")[0] ?? normalized
  return local.replace(/[._-]+/g, " ").trim() || "Operator"
}

async function fetchLeadLabel(admin: SupabaseClient, leadId: string): Promise<string> {
  const { data } = await admin.schema("growth").from("leads").select("company_name").eq("id", leadId).maybeSingle()
  return formatLeadLabel(asString((data as Row | null)?.company_name))
}

async function loadOwnerLabels(admin: SupabaseClient, threadIds: string[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>()
  if (threadIds.length === 0) return labels

  const { data, error } = await admin
    .schema("growth")
    .from("reply_intelligence_events")
    .select("thread_id, metadata, created_at")
    .eq("event_type", "thread_owner_assigned")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const record = row as Row
    const threadId = asString(record.thread_id)
    if (!threadId || labels.has(threadId)) continue
    const metadata = record.metadata && typeof record.metadata === "object" ? (record.metadata as Row) : {}
    labels.set(threadId, asString(metadata.owner_label) || "Operator")
  }

  return labels
}

function mapMessage(row: Row): GrowthInboxMessage {
  return {
    id: asString(row.id),
    thread_id: asString(row.thread_id),
    direction: asString(row.direction) as GrowthInboxMessage["direction"],
    sender: asString(row.sender),
    recipient: asString(row.recipient),
    subject: asString(row.subject),
    body_preview: asString(row.body_preview),
    message_timestamp: asString(row.message_timestamp),
    contains_competitor: Boolean(row.contains_competitor),
    contains_pricing: Boolean(row.contains_pricing),
    contains_budget: Boolean(row.contains_budget),
    contains_meeting_language: Boolean(row.contains_meeting_language),
    contains_positive_signal: Boolean(row.contains_positive_signal),
    created_at: asString(row.created_at),
  }
}

async function mapThread(admin: SupabaseClient, row: Row, ownerLabels?: Map<string, string>): Promise<GrowthInboxThread> {
  const id = asString(row.id)
  const leadId = asString(row.lead_id)
  const ownerUserId = asString(row.owner_user_id) || null
  const leadLabel = await fetchLeadLabel(admin, leadId)
  const ownerLabel = ownerUserId ? ownerLabels?.get(id) ?? "Assigned operator" : null

  return {
    id,
    lead_id: leadId,
    lead_label: leadLabel,
    provider_family: asString(row.provider_family) || "custom",
    mailbox_connection_id: asString(row.mailbox_connection_id) || null,
    subject: asString(row.subject),
    thread_status: asString(row.thread_status) as GrowthInboxThreadStatus,
    reply_count: asNumber(row.reply_count, 0),
    last_message_at: asString(row.last_message_at) || null,
    owner_user_id: ownerUserId,
    owner_label: ownerLabel,
    assigned_at: asString(row.assigned_at) || null,
    assigned_by: asString(row.assigned_by) || null,
    assignment_source: asString(row.assignment_source) || null,
    sla_due_at: asString(row.sla_due_at) || null,
    handoff_note: asString(row.handoff_note) || null,
    priority_score: asNumber(row.priority_score, 0),
    priority_tier: asString(row.priority_tier) as GrowthInboxThread["priority_tier"],
    classification: asString(row.classification) as GrowthInboxThread["classification"],
    classification_confidence: asNumber(row.classification_confidence, 0),
    requires_human_review: Boolean(row.requires_human_review),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  }
}

async function listThreadMessages(admin: SupabaseClient, threadId: string): Promise<GrowthInboxMessage[]> {
  const { data, error } = await messagesTable(admin)
    .select("*")
    .eq("thread_id", threadId)
    .order("message_timestamp", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapMessage(row as Row))
}

async function recomputeThreadIntelligence(
  admin: SupabaseClient,
  threadId: string,
  input: {
    subject: string
    body: string
    isInbound: boolean
    actor?: { actorUserId?: string | null; actorEmail?: string | null }
  },
): Promise<GrowthInboxThread> {
  const { data: existing, error: loadError } = await threadsTable(admin).select("*").eq("id", threadId).maybeSingle()
  if (loadError) throw new Error(loadError.message)
  if (!existing) throw new Error("inbox_thread_not_found")

  const previous = await mapThread(admin, existing as Row)
  const classificationResult = classifyReply({ subject: input.subject, body: input.body })
  const priorityScore = computeThreadPriorityScore({
    classification: classificationResult.classification,
    signals: classificationResult.signals,
  })
  const priorityTier = priorityScoreToTier(priorityScore)
  const health = evaluateThreadHealth({
    classification: classificationResult.classification,
    priority_tier: priorityTier,
    current_status: previous.thread_status,
    has_owner: Boolean(previous.owner_user_id),
  })

  const now = new Date().toISOString()
  const replyIncrement = input.isInbound ? 1 : 0
  const slaDueAt = input.isInbound ? computeInboxThreadSlaDueAt(now, priorityTier) : previous.sla_due_at ?? null

  const { data, error } = await threadsTable(admin)
    .update({
      classification: classificationResult.classification,
      classification_confidence: classificationResult.confidence,
      priority_score: priorityScore,
      priority_tier: priorityTier,
      thread_status: health.thread_status,
      requires_human_review: health.requires_human_review,
      reply_count: previous.reply_count + replyIncrement,
      last_message_at: now,
      sla_due_at: slaDueAt,
      updated_at: now,
    })
    .eq("id", threadId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  const updated = await mapThread(admin, data as Row)

  if (input.isInbound) {
    const drafts = buildReplyIntelligenceEvents({
      leadLabel: updated.lead_label,
      subject: input.subject,
      classification: classificationResult.classification,
      isInbound: true,
    })
    await persistReplyEventDrafts(admin, threadId, updated.lead_id, drafts, input.actor)
  }

  return updated
}

export async function listInboxThreads(
  admin: SupabaseClient,
  input?: { limit?: number; status?: GrowthInboxThreadStatus },
): Promise<GrowthInboxThread[]> {
  let query = threadsTable(admin).select("*").order("last_message_at", { ascending: false, nullsFirst: false }).limit(input?.limit ?? 100)
  if (input?.status) query = query.eq("thread_status", input.status)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const threadIds = (data ?? []).map((row) => asString((row as Row).id)).filter(Boolean)
  const ownerLabels = await loadOwnerLabels(admin, threadIds)

  return Promise.all((data ?? []).map((row) => mapThread(admin, row as Row, ownerLabels)))
}

export async function getInboxThread(admin: SupabaseClient, threadId: string, includeMessages = true): Promise<GrowthInboxThread | null> {
  const { data, error } = await threadsTable(admin).select("*").eq("id", threadId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const ownerLabels = await loadOwnerLabels(admin, [threadId])
  const thread = await mapThread(admin, data as Row, ownerLabels)
  if (includeMessages) thread.messages = await listThreadMessages(admin, threadId)
  return thread
}

export async function createInboxThread(
  admin: SupabaseClient,
  input: {
    lead_id: string
    subject?: string
    provider_family?: string
    mailbox_connection_id?: string | null
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthInboxThread> {
  const { data: lead, error: leadError } = await admin
    .schema("growth")
    .from("leads")
    .select("id")
    .eq("id", input.lead_id)
    .maybeSingle()

  if (leadError) throw new Error(leadError.message)
  if (!lead) throw new Error("lead_not_found")

  const now = new Date().toISOString()
  const { data, error } = await threadsTable(admin)
    .insert({
      lead_id: input.lead_id,
      subject: input.subject?.trim() ?? "",
      provider_family: input.provider_family?.trim() || "custom",
      mailbox_connection_id: input.mailbox_connection_id ?? null,
      thread_status: "open",
      reply_count: 0,
      priority_score: 50,
      priority_tier: "normal",
      classification: "unknown",
      classification_confidence: 0,
      requires_human_review: true,
      last_message_at: null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapThread(admin, data as Row)
}

export async function addInboxMessage(
  admin: SupabaseClient,
  input: {
    thread_id: string
    direction: GrowthInboxMessageDirection
    sender?: string
    recipient?: string
    subject?: string
    body_preview?: string
    provider_message_id?: string | null
    message_timestamp?: string
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<{ thread: GrowthInboxThread; message: GrowthInboxMessage }> {
  const thread = await getInboxThread(admin, input.thread_id, false)
  if (!thread) throw new Error("inbox_thread_not_found")

  const subject = input.subject?.trim() ?? thread.subject
  const bodyPreview = input.body_preview?.trim() ?? ""
  const classificationResult = classifyReply({ subject, body: bodyPreview })
  const messageTimestamp = input.message_timestamp ?? new Date().toISOString()

  const { data, error } = await messagesTable(admin)
    .insert({
      thread_id: input.thread_id,
      direction: input.direction,
      sender: input.sender?.trim() ?? "",
      recipient: input.recipient?.trim() ?? "",
      subject,
      body_preview: bodyPreview,
      provider_message_id: input.provider_message_id ?? null,
      message_timestamp: messageTimestamp,
      contains_competitor: classificationResult.signals.contains_competitor,
      contains_pricing: classificationResult.signals.contains_pricing,
      contains_budget: classificationResult.signals.contains_budget,
      contains_meeting_language: classificationResult.signals.contains_meeting_language,
      contains_positive_signal: classificationResult.signals.contains_positive_signal,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  const updatedThread = await recomputeThreadIntelligence(admin, input.thread_id, {
    subject,
    body: bodyPreview,
    isInbound: input.direction === "inbound",
    actor: { actorUserId: input.actorUserId, actorEmail: input.actorEmail },
  })

  if (input.direction === "inbound" && thread.lead_id) {
    const { recordPerformanceEngagementForLead } = await import(
      "@/lib/growth/revenue-intelligence/performance-snapshots"
    )
    await recordExperimentEngagementForLead(admin, { leadId: thread.lead_id, metric: "replies" }).catch(() => undefined)
    await recordPerformanceEngagementForLead(admin, { leadId: thread.lead_id, metric: "replies" }).catch(() => undefined)
    if (classificationResult.classification === "positive_interest") {
      await recordExperimentEngagementForLead(admin, {
        leadId: thread.lead_id,
        metric: "positive_replies",
      }).catch(() => undefined)
      await recordPerformanceEngagementForLead(admin, {
        leadId: thread.lead_id,
        metric: "positive_replies",
      }).catch(() => undefined)
    }
    if (classificationResult.classification === "meeting_intent") {
      await recordExperimentEngagementForLead(admin, { leadId: thread.lead_id, metric: "meetings" }).catch(() => undefined)
      await recordPerformanceEngagementForLead(admin, { leadId: thread.lead_id, metric: "meetings" }).catch(() => undefined)
      await recordMeetingAttributionForLead(admin, {
        leadId: thread.lead_id,
        metadata: { source: "inbox_meeting_intent", thread_id: input.thread_id },
      }).catch(() => undefined)
    }
    const { ingestOpportunityIntelligenceFromInbox } = await import(
      "@/lib/growth/opportunity-intelligence/crm-intelligence"
    )
    await ingestOpportunityIntelligenceFromInbox(admin, {
      leadId: thread.lead_id,
      inboxThreadId: input.thread_id,
      subject,
      body: bodyPreview,
      classification: classificationResult.classification,
    }).catch(() => undefined)
    const { ingestBookingIntelligenceFromInbox } = await import("@/lib/growth/booking-intelligence/booking-events")
    await ingestBookingIntelligenceFromInbox(admin, {
      leadId: thread.lead_id,
      inboxThreadId: input.thread_id,
      subject,
      body: bodyPreview,
      classification: classificationResult.classification,
    }).catch(() => undefined)
  }

  return { thread: updatedThread, message: mapMessage(data as Row) }
}

export async function assignThreadOwner(
  admin: SupabaseClient,
  threadId: string,
  input: {
    owner_user_id?: string | null
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthInboxThread> {
  const existing = await getInboxThread(admin, threadId, false)
  if (!existing) throw new Error("inbox_thread_not_found")

  const ownerUserId = input.owner_user_id ?? input.actorUserId ?? null
  const ownerLabel = formatOwnerLabel(input.actorEmail)
  const now = new Date().toISOString()

  const { data, error } = await threadsTable(admin)
    .update({
      owner_user_id: ownerUserId,
      updated_at: now,
    })
    .eq("id", threadId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  const draft = buildThreadOwnerAssignedEvent(existing.lead_label, ownerLabel)
  await persistReplyEventDrafts(admin, threadId, existing.lead_id, [draft], {
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  })

  const ownerLabels = new Map([[threadId, ownerLabel]])
  return mapThread(admin, data as Row, ownerLabels)
}

export async function resolveInboxThread(
  admin: SupabaseClient,
  threadId: string,
): Promise<GrowthInboxThread> {
  const existing = await getInboxThread(admin, threadId, false)
  if (!existing) throw new Error("inbox_thread_not_found")

  const now = new Date().toISOString()
  const { data, error } = await threadsTable(admin)
    .update({
      thread_status: "resolved",
      requires_human_review: false,
      updated_at: now,
    })
    .eq("id", threadId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapThread(admin, data as Row)
}

export async function archiveInboxThread(
  admin: SupabaseClient,
  threadId: string,
): Promise<GrowthInboxThread> {
  const existing = await getInboxThread(admin, threadId, false)
  if (!existing) throw new Error("inbox_thread_not_found")

  const now = new Date().toISOString()
  const { data, error } = await threadsTable(admin)
    .update({
      thread_status: "archived",
      updated_at: now,
    })
    .eq("id", threadId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapThread(admin, data as Row)
}

export async function updateInboxThread(
  admin: SupabaseClient,
  threadId: string,
  input: {
    thread_status?: GrowthInboxThreadStatus
    subject?: string
    requires_human_review?: boolean
  },
): Promise<GrowthInboxThread> {
  const existing = await getInboxThread(admin, threadId, false)
  if (!existing) throw new Error("inbox_thread_not_found")

  const updates: Row = { updated_at: new Date().toISOString() }
  if (input.thread_status) updates.thread_status = input.thread_status
  if (input.subject !== undefined) updates.subject = input.subject.trim()
  if (input.requires_human_review !== undefined) updates.requires_human_review = input.requires_human_review

  const { data, error } = await threadsTable(admin).update(updates).eq("id", threadId).select("*").single()
  if (error) throw new Error(error.message)
  return mapThread(admin, data as Row)
}

export async function fetchInboxDashboard(admin: SupabaseClient): Promise<{
  dashboard: GrowthInboxDashboard
  threads: GrowthInboxThread[]
  intelligence: GrowthReplyIntelligenceSummary
  events: GrowthReplyIntelligenceEvent[]
}> {
  const [threads, events] = await Promise.all([
    listInboxThreads(admin),
    listReplyIntelligenceEvents(admin, { limit: 30 }),
  ])

  return {
    dashboard: buildInboxDashboard(threads),
    threads,
    intelligence: buildReplyIntelligenceSummary(threads),
    events,
  }
}

export async function listLeadsForInbox(admin: SupabaseClient, limit = 100): Promise<Array<{ id: string; label: string }>> {
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name")
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const record = row as Row
    return {
      id: asString(record.id),
      label: formatLeadLabel(asString(record.company_name)),
    }
  })
}

export { listReplyIntelligenceEvents }
