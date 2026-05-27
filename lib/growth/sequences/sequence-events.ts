import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthSequenceEventSeverity,
  GrowthSequenceExecutionEvent,
  GrowthSequenceTimelineEventType,
} from "@/lib/growth/sequences/sequence-types"
import type { SequenceEventDraft } from "@/lib/growth/sequences/sequence-event-builder"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_execution_events")
}

function timelineTable(admin: SupabaseClient) {
  return admin.schema("growth").from("platform_timeline_events")
}

function mapEvent(row: Record<string, unknown>, leadLabel = ""): GrowthSequenceExecutionEvent {
  return {
    id: asString(row.id),
    sequence_enrollment_id: asString(row.sequence_enrollment_id),
    lead_label: leadLabel,
    event_type: asString(row.event_type) || "health_check",
    severity: asString(row.severity) as GrowthSequenceEventSeverity,
    title: asString(row.title),
    description: asString(row.description),
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
    created_at: asString(row.created_at),
  }
}

export async function createSequenceExecutionEvent(
  admin: SupabaseClient,
  input: {
    sequence_enrollment_id: string
    event_type: string
    severity: GrowthSequenceEventSeverity
    title: string
    description: string
    metadata?: Record<string, unknown>
  },
): Promise<GrowthSequenceExecutionEvent> {
  const { data, error } = await eventsTable(admin)
    .insert({
      sequence_enrollment_id: input.sequence_enrollment_id,
      event_type: input.event_type,
      severity: input.severity,
      title: input.title,
      description: input.description,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapEvent(data as Record<string, unknown>)
}

export async function listSequenceExecutionEvents(
  admin: SupabaseClient,
  input?: { limit?: number; sequence_enrollment_id?: string },
): Promise<GrowthSequenceExecutionEvent[]> {
  let query = eventsTable(admin).select("*").order("created_at", { ascending: false }).limit(input?.limit ?? 50)
  if (input?.sequence_enrollment_id) query = query.eq("sequence_enrollment_id", input.sequence_enrollment_id)

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const enrollmentIds = [...new Set((data ?? []).map((row) => asString((row as Record<string, unknown>).sequence_enrollment_id)).filter(Boolean))]
  const leadLabels = await loadLeadLabelsForEnrollments(admin, enrollmentIds)

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>
    return mapEvent(record, leadLabels.get(asString(record.sequence_enrollment_id)) ?? "")
  })
}

async function loadLeadLabelsForEnrollments(admin: SupabaseClient, enrollmentIds: string[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>()
  if (enrollmentIds.length === 0) return labels

  const { data: enrollments } = await admin
    .schema("growth")
    .from("sequence_template_enrollments")
    .select("id, lead_id")
    .in("id", enrollmentIds)

  const leadIds = [...new Set((enrollments ?? []).map((row) => asString((row as Record<string, unknown>).lead_id)).filter(Boolean))]
  const companyByLead = new Map<string, string>()
  if (leadIds.length > 0) {
    const { data: leads } = await admin.schema("growth").from("leads").select("id, company_name").in("id", leadIds)
    for (const row of leads ?? []) {
      const record = row as Record<string, unknown>
      companyByLead.set(asString(record.id), asString(record.company_name))
    }
  }

  for (const row of enrollments ?? []) {
    const record = row as Record<string, unknown>
    const enrollmentId = asString(record.id)
    const leadId = asString(record.lead_id)
    const company = companyByLead.get(leadId)
    labels.set(enrollmentId, company || "Lead")
  }

  return labels
}

export async function enrollmentHasCriticalEvent(admin: SupabaseClient, enrollmentId: string): Promise<boolean> {
  const { data, error } = await eventsTable(admin)
    .select("id")
    .eq("sequence_enrollment_id", enrollmentId)
    .eq("severity", "critical")
    .limit(1)
  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}

export async function enrollmentHasFailedEvent(admin: SupabaseClient, enrollmentId: string): Promise<boolean> {
  const { data, error } = await eventsTable(admin)
    .select("id")
    .eq("sequence_enrollment_id", enrollmentId)
    .eq("event_type", "sequence_failed")
    .limit(1)
  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}

export async function appendSequenceTimelineEvent(
  admin: SupabaseClient,
  input: {
    eventType: GrowthSequenceTimelineEventType
    title: string
    summary?: string | null
    enrollmentId?: string | null
    payload?: Record<string, unknown>
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<void> {
  const { error } = await timelineTable(admin).insert({
    connection_id: null,
    event_type: input.eventType,
    title: input.title,
    summary: input.summary ?? null,
    payload: {
      ...(input.payload ?? {}),
      sequence_enrollment_id: input.enrollmentId ?? null,
    },
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function persistSequenceEventDrafts(
  admin: SupabaseClient,
  enrollmentId: string,
  drafts: SequenceEventDraft[],
  actor?: { actorUserId?: string | null; actorEmail?: string | null },
): Promise<void> {
  for (const draft of drafts) {
    await createSequenceExecutionEvent(admin, {
      sequence_enrollment_id: enrollmentId,
      event_type: draft.event_type,
      severity: draft.severity,
      title: draft.title,
      description: draft.description,
      metadata: draft.metadata,
    })
    if (draft.timeline_type) {
      await appendSequenceTimelineEvent(admin, {
        eventType: draft.timeline_type,
        title: draft.title,
        summary: draft.description,
        enrollmentId,
        payload: draft.metadata,
        actorUserId: actor?.actorUserId,
        actorEmail: actor?.actorEmail,
      })
    }
  }
}

export async function listSequenceTimelineEvents(
  admin: SupabaseClient,
  input?: { limit?: number },
): Promise<
  Array<{
    id: string
    event_type: GrowthSequenceTimelineEventType
    title: string
    summary: string | null
    payload: Record<string, unknown>
    occurred_at: string
  }>
> {
  const { data, error } = await timelineTable(admin)
    .select("id, event_type, title, summary, payload, occurred_at")
    .in("event_type", [
      "sequence_created",
      "sequence_started",
      "sequence_paused",
      "sequence_completed",
      "sequence_cancelled",
      "sequence_health_declined",
    ])
    .order("occurred_at", { ascending: false })
    .limit(input?.limit ?? 30)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const record = row as Record<string, unknown>
    return {
      id: asString(record.id),
      event_type: asString(record.event_type) as GrowthSequenceTimelineEventType,
      title: asString(record.title),
      summary: asString(record.summary) || null,
      payload: record.payload && typeof record.payload === "object" ? (record.payload as Record<string, unknown>) : {},
      occurred_at: asString(record.occurred_at),
    }
  })
}
