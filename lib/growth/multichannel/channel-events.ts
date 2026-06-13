import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthChannelRoutingRule,
  GrowthSequenceChannelTask,
  GrowthSequenceChannelTaskEvent,
  GrowthSequenceChannelType,
} from "@/lib/growth/multichannel/multichannel-types"
import { maskMultichannelLeadLabel } from "@/lib/growth/multichannel/multichannel-types"

type Row = Record<string, unknown>

function tasksTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_channel_tasks")
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_channel_task_events")
}

function routingRulesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("channel_routing_rules")
}

function platformTimelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("platform_timeline_events")
}

async function resolveLeadLabel(admin: SupabaseClient, leadId: string): Promise<string> {
  const { data } = await admin.schema("growth").from("leads").select("company_name").eq("id", leadId).maybeSingle()
  return maskMultichannelLeadLabel(leadId, (data as Row | null)?.company_name as string | null)
}

function mapTask(row: Row, leadLabel: string): GrowthSequenceChannelTask {
  const bookingRecommendationId = row.booking_recommendation_id ? String(row.booking_recommendation_id) : null
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    leadLabel,
    sequenceEnrollmentId: String(row.sequence_enrollment_id),
    sequenceStepId: row.sequence_step_id ? String(row.sequence_step_id) : null,
    channel: String(row.channel) as GrowthSequenceChannelType,
    status: String(row.status) as GrowthSequenceChannelTask["status"],
    title: String(row.title),
    description: String(row.description),
    evidenceSnippet: String(row.evidence_snippet),
    requiresHumanApproval: true,
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    completedBy: row.completed_by ? String(row.completed_by) : null,
    skippedBy: row.skipped_by ? String(row.skipped_by) : null,
    bookingRecommendationId,
    sequenceExecutionJobId: row.sequence_execution_job_id ? String(row.sequence_execution_job_id) : null,
    callWorkspaceHref: row.call_workspace_href ? String(row.call_workspace_href) : null,
    bookingIntelligenceHref: bookingRecommendationId ? "/admin/growth/booking-intelligence" : null,
    scheduledFor: row.scheduled_for ? String(row.scheduled_for) : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }
}

export async function insertChannelTaskEvent(
  admin: SupabaseClient,
  input: {
    taskId: string
    leadId?: string | null
    eventType: string
    title: string
    description?: string
    severity?: GrowthSequenceChannelTaskEvent["severity"]
    metadata?: Record<string, unknown>
  },
): Promise<GrowthSequenceChannelTaskEvent> {
  const { data, error } = await eventsTable(admin)
    .insert({
      task_id: input.taskId,
      lead_id: input.leadId ?? null,
      event_type: input.eventType,
      severity: input.severity ?? "info",
      title: input.title.slice(0, 200),
      description: (input.description ?? "").slice(0, 500),
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  const row = data as Row
  return {
    id: String(row.id),
    taskId: input.taskId,
    leadId: input.leadId ?? null,
    eventType: String(row.event_type),
    severity: String(row.severity) as GrowthSequenceChannelTaskEvent["severity"],
    title: String(row.title),
    description: String(row.description),
    createdAt: String(row.created_at),
  }
}

export async function recordChannelPlatformTimeline(
  admin: SupabaseClient,
  input: { eventType: string; title: string; summary: string; leadId: string },
): Promise<void> {
  await platformTimelineTable(admin)
    .insert({
      event_type: input.eventType,
      title: input.title.slice(0, 200),
      summary: input.summary.slice(0, 500),
      lead_id: input.leadId,
      metadata: { source: "multichannel_sequences" },
    })
    .then(() => undefined)
    .catch(() => undefined)
}

export async function listSequenceChannelTasks(
  admin: SupabaseClient,
  input?: {
    leadId?: string
    enrollmentId?: string
    status?: GrowthSequenceChannelTask["status"]
    channel?: GrowthSequenceChannelType
    limit?: number
  },
): Promise<GrowthSequenceChannelTask[]> {
  let query = tasksTable(admin).select("*").order("scheduled_for", { ascending: true, nullsFirst: false }).limit(input?.limit ?? 100)
  if (input?.leadId) query = query.eq("lead_id", input.leadId)
  if (input?.enrollmentId) query = query.eq("sequence_enrollment_id", input.enrollmentId)
  if (input?.status) query = query.eq("status", input.status)
  if (input?.channel) query = query.eq("channel", input.channel)
  const { data, error } = await query
  if (error) throw new Error(error.message)

  const rows = data ?? []
  const labels = new Map<string, string>()
  for (const row of rows) {
    const leadId = String((row as Row).lead_id)
    if (!labels.has(leadId)) labels.set(leadId, await resolveLeadLabel(admin, leadId))
  }
  return rows.map((row) => mapTask(row as Row, labels.get(String((row as Row).lead_id)) ?? "Account"))
}

export async function getSequenceChannelTask(
  admin: SupabaseClient,
  taskId: string,
): Promise<GrowthSequenceChannelTask | null> {
  const { data, error } = await tasksTable(admin).select("*").eq("id", taskId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const row = data as Row
  const leadLabel = await resolveLeadLabel(admin, String(row.lead_id))
  return mapTask(row, leadLabel)
}

export async function listChannelRoutingRules(admin: SupabaseClient): Promise<GrowthChannelRoutingRule[]> {
  const { data, error } = await routingRulesTable(admin).select("*").order("priority", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const record = row as Row
    return {
      id: String(record.id),
      channel: String(record.channel) as GrowthChannelRoutingRule["channel"],
      label: String(record.label),
      priority: Number(record.priority ?? 100),
      isActive: Boolean(record.is_active),
      requiresApproval: Boolean(record.requires_approval),
      isFuturePlaceholder: Boolean(record.is_future_placeholder),
      matchCriteria: (record.match_criteria as Record<string, unknown>) ?? {},
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      createdAt: String(record.created_at),
      updatedAt: String(record.updated_at),
    }
  })
}

export async function listChannelTaskEvents(
  admin: SupabaseClient,
  input?: { leadId?: string; limit?: number },
): Promise<GrowthSequenceChannelTaskEvent[]> {
  let query = eventsTable(admin).select("*").order("created_at", { ascending: false }).limit(input?.limit ?? 50)
  if (input?.leadId) query = query.eq("lead_id", input.leadId)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const record = row as Row
    return {
      id: String(record.id),
      taskId: String(record.task_id),
      leadId: record.lead_id ? String(record.lead_id) : null,
      eventType: String(record.event_type),
      severity: String(record.severity) as GrowthSequenceChannelTaskEvent["severity"],
      title: String(record.title),
      description: String(record.description),
      createdAt: String(record.created_at),
    }
  })
}

export { tasksTable as channelTasksTable }
