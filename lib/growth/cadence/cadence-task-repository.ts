import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthCadenceInboxView,
  GrowthCadenceTask,
  GrowthCadenceTaskChannel,
  GrowthCadenceTaskPriority,
  GrowthCadenceTaskStatus,
} from "@/lib/growth/cadence/cadence-types"

const TASK_SELECT =
  "id, owner_user_id, lead_id, opportunity_id, meeting_id, sequence_enrollment_step_id, channel, title, instructions, template_draft, suggested_sms_text, due_at, status, priority, outcome, skipped_reason, completed_at, completed_by, created_at, updated_at"

type TaskDbRow = {
  id: string
  owner_user_id: string | null
  lead_id: string
  opportunity_id: string | null
  meeting_id: string | null
  sequence_enrollment_step_id: string | null
  channel: string
  title: string
  instructions: string
  template_draft: string | null
  suggested_sms_text: string | null
  due_at: string | null
  status: string
  priority: string
  outcome: string | null
  skipped_reason: string | null
  completed_at: string | null
  completed_by: string | null
  created_at: string
  updated_at: string
}

function tasksTable(admin: SupabaseClient) {
  return admin.schema("growth").from("cadence_tasks")
}

export function mapGrowthCadenceTaskRow(row: TaskDbRow): GrowthCadenceTask {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    leadId: row.lead_id,
    opportunityId: row.opportunity_id,
    meetingId: row.meeting_id,
    sequenceEnrollmentStepId: row.sequence_enrollment_step_id,
    channel: row.channel as GrowthCadenceTaskChannel,
    title: row.title,
    instructions: row.instructions,
    templateDraft: row.template_draft,
    suggestedSmsText: row.suggested_sms_text,
    dueAt: row.due_at,
    status: row.status as GrowthCadenceTaskStatus,
    priority: row.priority as GrowthCadenceTaskPriority,
    outcome: row.outcome as GrowthCadenceTask["outcome"],
    skippedReason: row.skipped_reason,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchGrowthCadenceTaskById(
  admin: SupabaseClient,
  taskId: string,
): Promise<GrowthCadenceTask | null> {
  const { data, error } = await tasksTable(admin).select(TASK_SELECT).eq("id", taskId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapGrowthCadenceTaskRow(data as TaskDbRow) : null
}

export async function fetchGrowthCadenceTaskByEnrollmentStepId(
  admin: SupabaseClient,
  stepId: string,
): Promise<GrowthCadenceTask | null> {
  const { data, error } = await tasksTable(admin)
    .select(TASK_SELECT)
    .eq("sequence_enrollment_step_id", stepId)
    .eq("status", "open")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapGrowthCadenceTaskRow(data as TaskDbRow) : null
}

export async function insertGrowthCadenceTaskRow(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<GrowthCadenceTask> {
  const { data, error } = await tasksTable(admin).insert(row).select(TASK_SELECT).single()
  if (error) throw new Error(error.message)
  return mapGrowthCadenceTaskRow(data as TaskDbRow)
}

export async function updateGrowthCadenceTaskRow(
  admin: SupabaseClient,
  taskId: string,
  patch: Record<string, unknown>,
): Promise<GrowthCadenceTask> {
  const { data, error } = await tasksTable(admin)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .select(TASK_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapGrowthCadenceTaskRow(data as TaskDbRow)
}

export async function listGrowthCadenceTasks(
  admin: SupabaseClient,
  input: {
    view?: GrowthCadenceInboxView
    ownerUserId?: string | null
    leadId?: string | null
    channel?: GrowthCadenceTaskChannel | null
    status?: GrowthCadenceTaskStatus | null
    limit?: number
  },
): Promise<GrowthCadenceTask[]> {
  const now = new Date().toISOString()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  let query = tasksTable(admin).select(TASK_SELECT)
  if (input.ownerUserId) query = query.eq("owner_user_id", input.ownerUserId)
  if (input.leadId) query = query.eq("lead_id", input.leadId)
  if (input.channel) query = query.eq("channel", input.channel)
  if (input.status) query = query.eq("status", input.status)

  switch (input.view ?? "due") {
    case "due":
      query = query.eq("status", "open").or(`due_at.is.null,due_at.gte.${now}`)
      break
    case "overdue":
      query = query.eq("status", "open").lt("due_at", now)
      break
    case "completed_today":
      query = query
        .eq("status", "completed")
        .gte("completed_at", todayStart.toISOString())
        .lte("completed_at", todayEnd.toISOString())
      break
    case "skipped":
      query = query.eq("status", "skipped")
      break
    case "by_channel":
    case "sequence_progress":
      query = query.eq("status", "open")
      break
  }

  const { data, error } = await query
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(input.limit ?? 100)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapGrowthCadenceTaskRow(row as TaskDbRow))
}

export async function listGrowthCadenceTasksForScan(
  admin: SupabaseClient,
  input?: { ownerUserId?: string | null },
): Promise<GrowthCadenceTask[]> {
  let query = tasksTable(admin).select(TASK_SELECT)
  if (input?.ownerUserId) query = query.eq("owner_user_id", input.ownerUserId)
  const { data, error } = await query.order("updated_at", { ascending: false }).limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapGrowthCadenceTaskRow(row as TaskDbRow))
}

export async function attachCadenceTaskContext(
  admin: SupabaseClient,
  tasks: GrowthCadenceTask[],
): Promise<GrowthCadenceTask[]> {
  const leadIds = [...new Set(tasks.map((t) => t.leadId))]
  const stepIds = [...new Set(tasks.map((t) => t.sequenceEnrollmentStepId).filter(Boolean))] as string[]

  const [leadsRes, stepsRes] = await Promise.all([
    leadIds.length
      ? admin.schema("growth").from("leads").select("id, company_name").in("id", leadIds)
      : Promise.resolve({ data: [], error: null }),
    stepIds.length
      ? admin
          .schema("growth")
          .from("sequence_enrollment_steps")
          .select("id, step_order, enrollment_id")
          .in("id", stepIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (leadsRes.error) throw new Error(leadsRes.error.message)
  if (stepsRes.error) throw new Error(stepsRes.error.message)

  const companyMap = new Map((leadsRes.data ?? []).map((r) => [r.id as string, r.company_name as string]))
  const stepMap = new Map(
    (stepsRes.data ?? []).map((r) => [
      r.id as string,
      { stepOrder: r.step_order as number, enrollmentId: r.enrollment_id as string },
    ]),
  )

  return tasks.map((task) => {
    const step = task.sequenceEnrollmentStepId ? stepMap.get(task.sequenceEnrollmentStepId) : null
    return {
      ...task,
      companyName: companyMap.get(task.leadId) ?? null,
      stepOrder: step?.stepOrder ?? null,
      enrollmentId: step?.enrollmentId ?? null,
    }
  })
}
