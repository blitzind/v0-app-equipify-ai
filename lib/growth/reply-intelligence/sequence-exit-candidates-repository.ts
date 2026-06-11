import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import type { GrowthSequenceExitCandidateRecord } from "@/lib/growth/reply-intelligence/workflow-actions-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export async function listSequenceExitCandidates(
  admin: SupabaseClient,
  input?: { leadId?: string; pendingOnly?: boolean; limit?: number },
): Promise<GrowthSequenceExitCandidateRecord[]> {
  const { data, error } = await admin
    .schema("growth")
    .from("reply_intelligence_events")
    .select("*")
    .eq("event_type", "sequence_exit_candidate")
    .order("created_at", { ascending: false })
    .limit(input?.limit ?? 50)

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<Record<string, unknown>>
  const threadIds = [...new Set(rows.map((row) => asString(row.thread_id)).filter(Boolean))]

  const { data: threads } = threadIds.length
    ? await admin.schema("growth").from("inbox_threads").select("id, lead_id, subject").in("id", threadIds)
    : { data: [] as Record<string, unknown>[] }

  const threadLeadMap = new Map(
    (threads ?? []).map((row) => [asString(row.id), { leadId: asString(row.lead_id), subject: asString(row.subject) }]),
  )

  const leadIds = [...new Set([...threadLeadMap.values()].map((entry) => entry.leadId).filter(Boolean))]
  const enrollmentIds = [
    ...new Set(rows.map((row) => asString(asRecord(row.metadata).sequence_enrollment_id)).filter(Boolean)),
  ]

  const [leadsRes, enrollmentsRes] = await Promise.all([
    leadIds.length
      ? admin.schema("growth").from("leads").select("id, company_name").in("id", leadIds)
      : Promise.resolve({ data: [], error: null }),
    enrollmentIds.length
      ? admin
          .schema("growth")
          .from("sequence_enrollments")
          .select("id, status, sequence_pattern_id")
          .in("id", enrollmentIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (leadsRes.error) throw new Error(leadsRes.error.message)
  if (enrollmentsRes.error) throw new Error(enrollmentsRes.error.message)

  const patternIds = [
    ...new Set(
      (enrollmentsRes.data ?? [])
        .map((row) => asString((row as Record<string, unknown>).sequence_pattern_id))
        .filter(Boolean),
    ),
  ]
  const { data: patternRows, error: patternError } = patternIds.length
    ? await admin.schema("growth").from("sequence_patterns").select("id, label").in("id", patternIds)
    : { data: [], error: null }
  if (patternError) throw new Error(patternError.message)

  const patternLabelById = new Map(
    (patternRows ?? []).map((row) => [asString(row.id), asString(row.label)]),
  )

  const companyByLead = new Map(
    (leadsRes.data ?? []).map((row) => [asString(row.id), asString(row.company_name)]),
  )
  const enrollmentById = new Map(
    (enrollmentsRes.data ?? []).map((row) => {
      const record = row as Record<string, unknown>
      const patternId = asString(record.sequence_pattern_id)
      return [
        asString(record.id),
        {
          status: asString(record.status),
          sequenceName: patternLabelById.get(patternId) || null,
        },
      ]
    }),
  )

  const results: GrowthSequenceExitCandidateRecord[] = []

  for (const row of rows) {
    const metadata = asRecord(row.metadata)
    const operatorResolution = asString(metadata.operator_resolution) || null
    if (input?.pendingOnly && operatorResolution) continue

    const threadId = asString(row.thread_id)
    const thread = threadLeadMap.get(threadId)
    const leadId = thread?.leadId ?? ""
    if (input?.leadId && leadId !== input.leadId) continue

    const enrollmentId = asString(metadata.sequence_enrollment_id) || null
    const enrollment = enrollmentId ? enrollmentById.get(enrollmentId) : null

    results.push({
      id: asString(row.id),
      threadId,
      leadId,
      companyName: companyByLead.get(leadId) ?? null,
      sequenceEnrollmentId: enrollmentId,
      sequenceName: enrollment?.sequenceName ?? null,
      enrollmentStatus: enrollment?.status ?? null,
      reason: asString(metadata.reason) || "inbound_reply_on_active_sequence",
      replySummary: thread?.subject || asString(row.description) || null,
      createdAt: asString(row.created_at),
      operatorResolution,
    })
  }

  return results
}

export async function resolveSequenceExitCandidate(
  admin: SupabaseClient,
  input: {
    eventId: string
    resolution: "resume" | "keep_paused" | "exit"
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthSequenceExitCandidateRecord> {
  const { data, error } = await admin
    .schema("growth")
    .from("reply_intelligence_events")
    .select("*")
    .eq("id", input.eventId)
    .eq("event_type", "sequence_exit_candidate")
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error("not_found")

  const metadata = asRecord((data as Record<string, unknown>).metadata)
  const enrollmentId = asString(metadata.sequence_enrollment_id)
  const threadId = asString((data as Record<string, unknown>).thread_id)

  const { data: thread } = await admin
    .schema("growth")
    .from("inbox_threads")
    .select("lead_id")
    .eq("id", threadId)
    .maybeSingle()
  const leadId = asString((thread as { lead_id?: string } | null)?.lead_id)
  if (!leadId || !enrollmentId) throw new Error("invalid_candidate")

  const { resumeGrowthSequenceEnrollment } = await import(
    "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
  )
  const { cancelSequenceEnrollment } = await import("@/lib/growth/sequences/sequence-repository")

  if (input.resolution === "resume") {
    await resumeGrowthSequenceEnrollment(admin, {
      enrollmentId,
      leadId,
      actingUserId: input.actorUserId ?? "",
      actingUserEmail: input.actorEmail ?? "",
    })
  } else if (input.resolution === "exit") {
    await cancelSequenceEnrollment(admin, enrollmentId, {
      reason: "operator_exit_after_inbound_reply",
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
    })
  }

  const updatedMetadata = {
    ...metadata,
    operator_resolution: input.resolution,
    resolved_at: new Date().toISOString(),
    resolved_by: input.actorUserId ?? null,
  }

  const { error: updateError } = await admin
    .schema("growth")
    .from("reply_intelligence_events")
    .update({ metadata: updatedMetadata })
    .eq("id", input.eventId)
  if (updateError) throw new Error(updateError.message)

  const { appendGrowthLeadTimelineEvent } = await import("@/lib/growth/timeline-repository")
  await appendGrowthLeadTimelineEvent(admin, {
    leadId,
    eventType: "sequence_exit_reviewed",
    title: "Sequence exit reviewed",
    summary:
      input.resolution === "resume"
        ? "Operator resumed sequence after inbound reply."
        : input.resolution === "exit"
          ? "Operator exited sequence after inbound reply."
          : "Operator kept sequence paused after inbound reply.",
    payload: {
      sequence_exit_event_id: input.eventId,
      sequence_enrollment_id: enrollmentId,
      resolution: input.resolution,
    },
  }).catch(() => undefined)

  const { completePendingReplyWorkflowActions, GROWTH_REPLY_SEQUENCE_EXIT_ACTION_TYPES } = await import(
    "@/lib/growth/reply-intelligence/workflow-actions-repository"
  )
  await completePendingReplyWorkflowActions(admin, {
    leadId,
    actionTypes: [...GROWTH_REPLY_SEQUENCE_EXIT_ACTION_TYPES],
    actorUserId: input.actorUserId,
  })

  await recomputeGrowthLeadWorkflowSignals(admin, leadId).catch(() => undefined)

  const listed = await listSequenceExitCandidates(admin, { limit: 100 })
  const match = listed.find((row) => row.id === input.eventId)
  if (match) return { ...match, operatorResolution: input.resolution }

  return {
    id: input.eventId,
    threadId,
    leadId,
    companyName: null,
    sequenceEnrollmentId: enrollmentId,
    sequenceName: null,
    enrollmentStatus: null,
    reason: asString(metadata.reason),
    replySummary: null,
    createdAt: new Date().toISOString(),
    operatorResolution: input.resolution,
  }
}
