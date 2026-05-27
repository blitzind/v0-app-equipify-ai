import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildSequenceExecutionDashboard } from "@/lib/growth/sequences/sequence-dashboard"
import {
  computeEnrollmentNextDueAt,
  formatLeadLabel,
  isEnrollmentComplete,
} from "@/lib/growth/sequences/sequence-enrollment"
import { evaluateSequenceExitRules } from "@/lib/growth/sequences/sequence-exit-rules"
import {
  buildSequenceStatusChangeEvents,
} from "@/lib/growth/sequences/sequence-event-builder"
import {
  enrollmentHasCriticalEvent,
  enrollmentHasFailedEvent,
  listSequenceExecutionEvents,
  persistSequenceEventDrafts,
} from "@/lib/growth/sequences/sequence-events"
import {
  evaluateSequenceHealth,
  isSequenceStepOverdue,
} from "@/lib/growth/sequences/sequence-health"
import {
  assertSequenceEnrollmentTransition,
  isTerminalSequenceEnrollmentStatus,
} from "@/lib/growth/sequences/sequence-state-machine"
import type {
  GrowthSequenceEnrollment,
  GrowthSequenceEnrollmentStatus,
  GrowthSequenceGenerationType,
  GrowthSequenceStepChannel,
  GrowthSequenceTemplate,
  GrowthSequenceTemplateStatus,
  GrowthSequenceTemplateStep,
} from "@/lib/growth/sequences/sequence-types"

type Row = Record<string, unknown>

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function templatesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_templates")
}

function stepsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_template_steps")
}

function enrollmentsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_template_enrollments")
}

function activeTemplatesQuery(admin: SupabaseClient) {
  return templatesTable(admin).is("deleted_at", null)
}

function mapStep(row: Row): GrowthSequenceTemplateStep {
  return {
    id: asString(row.id),
    sequence_template_id: asString(row.sequence_template_id),
    step_number: asNumber(row.step_number, 1),
    channel: asString(row.channel) as GrowthSequenceStepChannel,
    delay_days: asNumber(row.delay_days, 0),
    generation_type: asString(row.generation_type) as GrowthSequenceGenerationType,
    approval_required: Boolean(row.approval_required),
    condition_rules: row.condition_rules && typeof row.condition_rules === "object" ? (row.condition_rules as Record<string, unknown>) : {},
    exit_rules: row.exit_rules && typeof row.exit_rules === "object" ? (row.exit_rules as Record<string, unknown>) : {},
    metadata: row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  }
}

async function countTemplateSteps(admin: SupabaseClient, templateId: string): Promise<number> {
  const { count, error } = await stepsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("sequence_template_id", templateId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function listTemplateSteps(admin: SupabaseClient, templateId: string): Promise<GrowthSequenceTemplateStep[]> {
  const { data, error } = await stepsTable(admin)
    .select("*")
    .eq("sequence_template_id", templateId)
    .order("step_number", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapStep(row as Row))
}

async function mapTemplate(admin: SupabaseClient, row: Row, includeSteps = false): Promise<GrowthSequenceTemplate> {
  const id = asString(row.id)
  const template: GrowthSequenceTemplate = {
    id,
    name: asString(row.name),
    description: asString(row.description) || null,
    category: asString(row.category) || null,
    status: asString(row.status) as GrowthSequenceTemplateStatus,
    approval_required: Boolean(row.approval_required),
    exit_on_reply: Boolean(row.exit_on_reply),
    exit_on_meeting: Boolean(row.exit_on_meeting),
    exit_on_positive_intent: Boolean(row.exit_on_positive_intent),
    created_by: asString(row.created_by) || null,
    step_count: await countTemplateSteps(admin, id),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    deleted_at: asString(row.deleted_at) || null,
  }
  if (includeSteps) template.steps = await listTemplateSteps(admin, id)
  return template
}

async function fetchLeadLabel(admin: SupabaseClient, leadId: string): Promise<string> {
  const { data } = await admin.schema("growth").from("leads").select("company_name").eq("id", leadId).maybeSingle()
  return formatLeadLabel(asString((data as Row | null)?.company_name))
}

async function fetchTemplateName(admin: SupabaseClient, templateId: string): Promise<string> {
  const { data } = await templatesTable(admin).select("name").eq("id", templateId).maybeSingle()
  return asString((data as Row | null)?.name) || "Sequence"
}

async function mapEnrollment(admin: SupabaseClient, row: Row): Promise<GrowthSequenceEnrollment> {
  const leadId = asString(row.lead_id)
  const templateId = asString(row.sequence_template_id)
  const [leadLabel, sequenceName] = await Promise.all([
    fetchLeadLabel(admin, leadId),
    fetchTemplateName(admin, templateId),
  ])

  return {
    id: asString(row.id),
    lead_id: leadId,
    lead_label: leadLabel,
    sequence_template_id: templateId,
    sequence_name: sequenceName,
    status: asString(row.status) as GrowthSequenceEnrollmentStatus,
    current_step: asNumber(row.current_step, 1),
    next_step_due_at: asString(row.next_step_due_at) || null,
    completion_reason: asString(row.completion_reason) || null,
    health_score: asNumber(row.health_score, 100),
    health_tier: asString(row.health_tier) as GrowthSequenceEnrollment["health_tier"],
    enrolled_by: asString(row.enrolled_by) || null,
    started_at: asString(row.started_at) || null,
    completed_at: asString(row.completed_at) || null,
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
  }
}

async function recomputeEnrollmentHealth(
  admin: SupabaseClient,
  enrollmentId: string,
  actor?: { actorUserId?: string | null; actorEmail?: string | null },
): Promise<GrowthSequenceEnrollment> {
  const { data: existing, error: loadError } = await enrollmentsTable(admin).select("*").eq("id", enrollmentId).maybeSingle()
  if (loadError) throw new Error(loadError.message)
  if (!existing) throw new Error("sequence_enrollment_not_found")

  const previous = await mapEnrollment(admin, existing as Row)
  const hasFailed = await enrollmentHasFailedEvent(admin, enrollmentId)
  const hasCritical = await enrollmentHasCriticalEvent(admin, enrollmentId)
  const overdue = isSequenceStepOverdue(previous.next_step_due_at, previous.status)

  const health = evaluateSequenceHealth({
    status: previous.status,
    overdue_step: overdue,
    has_failed_event: hasFailed,
    has_critical_event: hasCritical,
  })

  const now = new Date().toISOString()
  const { data, error } = await enrollmentsTable(admin)
    .update({
      health_score: health.health_score,
      health_tier: health.health_tier,
      updated_at: now,
    })
    .eq("id", enrollmentId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  const updated = await mapEnrollment(admin, data as Row)

  if (updated.health_score < previous.health_score) {
    await persistSequenceEventDrafts(
      admin,
      enrollmentId,
      buildSequenceStatusChangeEvents({
        leadLabel: updated.lead_label,
        sequenceName: updated.sequence_name,
        previousStatus: previous.status,
        nextStatus: updated.status,
        previousScore: previous.health_score,
        nextScore: updated.health_score,
      }),
      actor,
    )
  }

  if (overdue && updated.status === "active") {
    await persistSequenceEventDrafts(admin, enrollmentId, [
      {
        event_type: "sequence_step_overdue",
        severity: "high",
        title: "Sequence step overdue",
        description: `${updated.lead_label} has an overdue step in "${updated.sequence_name}".`,
        metadata: { current_step: updated.current_step },
      },
    ], actor)
  }

  return updated
}

async function transitionEnrollment(
  admin: SupabaseClient,
  enrollmentId: string,
  nextStatus: GrowthSequenceEnrollmentStatus,
  input?: {
    completion_reason?: string | null
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthSequenceEnrollment> {
  const { data: existing, error: loadError } = await enrollmentsTable(admin).select("*").eq("id", enrollmentId).maybeSingle()
  if (loadError) throw new Error(loadError.message)
  if (!existing) throw new Error("sequence_enrollment_not_found")

  const previous = await mapEnrollment(admin, existing as Row)
  assertSequenceEnrollmentTransition(previous.status, nextStatus)

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = {
    status: nextStatus,
    updated_at: now,
  }

  if (nextStatus === "active" && !previous.started_at) {
    updates.started_at = now
    const steps = await listTemplateSteps(admin, previous.sequence_template_id)
    updates.next_step_due_at = computeEnrollmentNextDueAt(steps, previous.current_step, now)
  }
  if (isTerminalSequenceEnrollmentStatus(nextStatus)) {
    updates.completed_at = now
    updates.completion_reason = input?.completion_reason ?? nextStatus
  }

  const { data, error } = await enrollmentsTable(admin).update(updates).eq("id", enrollmentId).select("*").single()
  if (error) throw new Error(error.message)

  const updated = await mapEnrollment(admin, data as Row)
  await persistSequenceEventDrafts(
    admin,
    enrollmentId,
    buildSequenceStatusChangeEvents({
      leadLabel: updated.lead_label,
      sequenceName: updated.sequence_name,
      previousStatus: previous.status,
      nextStatus: updated.status,
      previousScore: previous.health_score,
      nextScore: updated.health_score,
      completionReason: input?.completion_reason,
    }),
    { actorUserId: input?.actorUserId, actorEmail: input?.actorEmail },
  )

  return recomputeEnrollmentHealth(admin, enrollmentId, input)
}

export async function listSequenceTemplates(admin: SupabaseClient): Promise<GrowthSequenceTemplate[]> {
  const { data, error } = await activeTemplatesQuery(admin).select("*").order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return Promise.all((data ?? []).map((row) => mapTemplate(admin, row as Row, true)))
}

export async function getSequenceTemplate(admin: SupabaseClient, templateId: string): Promise<GrowthSequenceTemplate | null> {
  const { data, error } = await activeTemplatesQuery(admin).select("*").eq("id", templateId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapTemplate(admin, data as Row, true)
}

export async function createSequenceTemplate(
  admin: SupabaseClient,
  input: {
    name: string
    description?: string | null
    category?: string | null
    approval_required?: boolean
    exit_on_reply?: boolean
    exit_on_meeting?: boolean
    exit_on_positive_intent?: boolean
    steps?: Array<{
      step_number: number
      channel: GrowthSequenceStepChannel
      delay_days: number
      generation_type: GrowthSequenceGenerationType
      approval_required?: boolean
      condition_rules?: Record<string, unknown>
      exit_rules?: Record<string, unknown>
      metadata?: Record<string, unknown>
    }>
    created_by?: string | null
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthSequenceTemplate> {
  const now = new Date().toISOString()
  const { data, error } = await templatesTable(admin)
    .insert({
      name: input.name.trim(),
      description: input.description ?? null,
      category: input.category ?? null,
      status: "draft",
      approval_required: input.approval_required ?? true,
      exit_on_reply: input.exit_on_reply ?? true,
      exit_on_meeting: input.exit_on_meeting ?? true,
      exit_on_positive_intent: input.exit_on_positive_intent ?? true,
      created_by: input.created_by ?? input.actorUserId ?? null,
      updated_at: now,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  const template = await mapTemplate(admin, data as Row)

  if (input.steps?.length) {
    const { error: stepsError } = await stepsTable(admin).insert(
      input.steps.map((step) => ({
        sequence_template_id: template.id,
        step_number: step.step_number,
        channel: step.channel,
        delay_days: step.delay_days,
        generation_type: step.generation_type,
        approval_required: step.approval_required ?? true,
        condition_rules: step.condition_rules ?? {},
        exit_rules: step.exit_rules ?? {},
        metadata: step.metadata ?? {},
        updated_at: now,
      })),
    )
    if (stepsError) throw new Error(stepsError.message)
  }

  return getSequenceTemplate(admin, template.id) as Promise<GrowthSequenceTemplate>
}

export async function updateSequenceTemplate(
  admin: SupabaseClient,
  templateId: string,
  input: Partial<{
    name: string
    description: string | null
    category: string | null
    status: GrowthSequenceTemplateStatus
    approval_required: boolean
    exit_on_reply: boolean
    exit_on_meeting: boolean
    exit_on_positive_intent: boolean
  }>,
): Promise<GrowthSequenceTemplate> {
  const existing = await getSequenceTemplate(admin, templateId)
  if (!existing) throw new Error("sequence_template_not_found")

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.name !== undefined) updates.name = input.name.trim()
  if (input.description !== undefined) updates.description = input.description
  if (input.category !== undefined) updates.category = input.category
  if (input.status !== undefined) updates.status = input.status
  if (input.approval_required !== undefined) updates.approval_required = input.approval_required
  if (input.exit_on_reply !== undefined) updates.exit_on_reply = input.exit_on_reply
  if (input.exit_on_meeting !== undefined) updates.exit_on_meeting = input.exit_on_meeting
  if (input.exit_on_positive_intent !== undefined) updates.exit_on_positive_intent = input.exit_on_positive_intent

  const { error } = await templatesTable(admin).update(updates).eq("id", templateId).is("deleted_at", null)
  if (error) throw new Error(error.message)

  return getSequenceTemplate(admin, templateId) as Promise<GrowthSequenceTemplate>
}

export async function softDeleteSequenceTemplate(
  admin: SupabaseClient,
  templateId: string,
): Promise<{ id: string; deleted_at: string }> {
  const existing = await getSequenceTemplate(admin, templateId)
  if (!existing) throw new Error("sequence_template_not_found")

  const deletedAt = new Date().toISOString()
  const { data, error } = await templatesTable(admin)
    .update({ deleted_at: deletedAt, status: "archived", updated_at: deletedAt })
    .eq("id", templateId)
    .is("deleted_at", null)
    .select("id")
    .single()

  if (error) throw new Error(error.message)
  return { id: asString((data as Row).id), deleted_at: deletedAt }
}

export async function listSequenceEnrollments(admin: SupabaseClient): Promise<GrowthSequenceEnrollment[]> {
  const { data, error } = await enrollmentsTable(admin).select("*").order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return Promise.all((data ?? []).map((row) => mapEnrollment(admin, row as Row)))
}

export async function getSequenceEnrollment(admin: SupabaseClient, enrollmentId: string): Promise<GrowthSequenceEnrollment | null> {
  const { data, error } = await enrollmentsTable(admin).select("*").eq("id", enrollmentId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapEnrollment(admin, data as Row)
}

export async function enrollLeadInSequence(
  admin: SupabaseClient,
  input: {
    lead_id: string
    sequence_template_id: string
    start_immediately?: boolean
    exit_signals?: {
      reply_detected?: boolean
      meeting_booked?: boolean
      positive_intent?: boolean
      suppressed_lead?: boolean
      not_interested?: boolean
    }
    enrolled_by?: string | null
    actorUserId?: string | null
    actorEmail?: string | null
  },
): Promise<GrowthSequenceEnrollment> {
  const template = await getSequenceTemplate(admin, input.sequence_template_id)
  if (!template) throw new Error("sequence_template_not_found")
  if ((template.steps ?? []).length === 0) throw new Error("sequence_template_has_no_steps")

  const { data: lead } = await admin.schema("growth").from("leads").select("id").eq("id", input.lead_id).maybeSingle()
  if (!lead) throw new Error("lead_not_found")

  const exit = evaluateSequenceExitRules({
    ...input.exit_signals,
    exit_on_reply: template.exit_on_reply,
    exit_on_meeting: template.exit_on_meeting,
    exit_on_positive_intent: template.exit_on_positive_intent,
  })

  if (exit.should_exit) {
    throw new Error("sequence_enrollment_blocked")
  }

  const steps = template.steps ?? []
  const now = new Date().toISOString()
  const startImmediately = input.start_immediately ?? false
  const status: GrowthSequenceEnrollmentStatus = startImmediately ? "active" : "draft"

  const { data, error } = await enrollmentsTable(admin)
    .insert({
      lead_id: input.lead_id,
      sequence_template_id: input.sequence_template_id,
      status,
      current_step: 1,
      next_step_due_at: startImmediately ? computeEnrollmentNextDueAt(steps, 1, now) : null,
      health_score: 100,
      health_tier: "healthy",
      enrolled_by: input.enrolled_by ?? input.actorUserId ?? null,
      started_at: startImmediately ? now : null,
      updated_at: now,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  const enrollment = await mapEnrollment(admin, data as Row)
  if (startImmediately) {
    await persistSequenceEventDrafts(
      admin,
      enrollment.id,
      buildSequenceStatusChangeEvents({
        leadLabel: enrollment.lead_label,
        sequenceName: enrollment.sequence_name,
        previousStatus: "draft",
        nextStatus: "active",
        previousScore: 100,
        nextScore: 100,
      }),
      { actorUserId: input.actorUserId, actorEmail: input.actorEmail },
    )
  }

  return enrollment
}

export async function pauseSequenceEnrollment(
  admin: SupabaseClient,
  enrollmentId: string,
  actor?: { actorUserId?: string | null; actorEmail?: string | null },
): Promise<GrowthSequenceEnrollment> {
  return transitionEnrollment(admin, enrollmentId, "paused", actor)
}

export async function resumeSequenceEnrollment(
  admin: SupabaseClient,
  enrollmentId: string,
  actor?: { actorUserId?: string | null; actorEmail?: string | null },
): Promise<GrowthSequenceEnrollment> {
  return transitionEnrollment(admin, enrollmentId, "active", actor)
}

export async function cancelSequenceEnrollment(
  admin: SupabaseClient,
  enrollmentId: string,
  input?: { reason?: string; actorUserId?: string | null; actorEmail?: string | null },
): Promise<GrowthSequenceEnrollment> {
  return transitionEnrollment(admin, enrollmentId, "cancelled", {
    completion_reason: input?.reason ?? "cancelled by operator",
    actorUserId: input?.actorUserId,
    actorEmail: input?.actorEmail,
  })
}

export async function fetchSequenceExecutionFoundationDashboard(admin: SupabaseClient) {
  const [templates, enrollments] = await Promise.all([
    listSequenceTemplates(admin),
    listSequenceEnrollments(admin),
  ])
  return {
    dashboard: buildSequenceExecutionDashboard({ templates, enrollments }),
    templates,
    enrollments,
  }
}

export async function listLeadsForSequenceEnrollment(admin: SupabaseClient, limit = 100): Promise<Array<{ id: string; label: string }>> {
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

export { listSequenceExecutionEvents, isEnrollmentComplete }
