import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthCustomerOnboardingTask,
  GrowthCustomerOnboardingTaskKey,
  GrowthCustomerOnboardingTaskStatus,
} from "@/lib/growth/customer-lifecycle/customer-lifecycle-types"
import { GROWTH_CUSTOMER_ONBOARDING_TASK_LABELS } from "@/lib/growth/customer-lifecycle/customer-lifecycle-types"

const TASK_SELECT =
  "id, customer_profile_id, owner_user_id, task_key, title, instructions, due_at, status, outcome, skipped_reason, completed_at, completed_by, created_at, updated_at"

type TaskDbRow = {
  id: string
  customer_profile_id: string
  owner_user_id: string | null
  task_key: string
  title: string
  instructions: string
  due_at: string | null
  status: string
  outcome: string | null
  skipped_reason: string | null
  completed_at: string | null
  completed_by: string | null
  created_at: string
  updated_at: string
}

function tasksTable(admin: SupabaseClient) {
  return admin.schema("growth").from("customer_onboarding_tasks")
}

export function mapGrowthCustomerOnboardingTaskRow(row: TaskDbRow): GrowthCustomerOnboardingTask {
  return {
    id: row.id,
    customerProfileId: row.customer_profile_id,
    ownerUserId: row.owner_user_id,
    taskKey: row.task_key as GrowthCustomerOnboardingTaskKey,
    title: row.title,
    instructions: row.instructions,
    dueAt: row.due_at,
    status: row.status as GrowthCustomerOnboardingTaskStatus,
    outcome: row.outcome,
    skippedReason: row.skipped_reason,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function buildDefaultOnboardingTaskSpecs(): Array<{
  taskKey: GrowthCustomerOnboardingTaskKey
  title: string
  instructions: string
  offsetDays: number
}> {
  return [
    {
      taskKey: "kickoff_meeting",
      title: GROWTH_CUSTOMER_ONBOARDING_TASK_LABELS.kickoff_meeting,
      instructions: "Schedule and complete a kickoff meeting with the customer. Human-owned — no auto-send.",
      offsetDays: 3,
    },
    {
      taskKey: "account_setup",
      title: GROWTH_CUSTOMER_ONBOARDING_TASK_LABELS.account_setup,
      instructions: "Confirm account setup steps are complete. Document blockers manually.",
      offsetDays: 7,
    },
    {
      taskKey: "training_complete",
      title: GROWTH_CUSTOMER_ONBOARDING_TASK_LABELS.training_complete,
      instructions: "Verify training completion with the customer owner.",
      offsetDays: 14,
    },
    {
      taskKey: "implementation_complete",
      title: GROWTH_CUSTOMER_ONBOARDING_TASK_LABELS.implementation_complete,
      instructions: "Confirm implementation milestones are complete.",
      offsetDays: 21,
    },
    {
      taskKey: "first_success_milestone",
      title: GROWTH_CUSTOMER_ONBOARDING_TASK_LABELS.first_success_milestone,
      instructions: "Record first value milestone when the customer achieves initial success.",
      offsetDays: 30,
    },
    {
      taskKey: "onboarding_review",
      title: GROWTH_CUSTOMER_ONBOARDING_TASK_LABELS.onboarding_review,
      instructions: "Conduct onboarding review and confirm readiness for activation.",
      offsetDays: 35,
    },
  ]
}

export async function listGrowthCustomerOnboardingTasks(
  admin: SupabaseClient,
  input: { customerProfileId?: string; ownerUserId?: string | null; status?: GrowthCustomerOnboardingTaskStatus | null },
): Promise<GrowthCustomerOnboardingTask[]> {
  let query = tasksTable(admin).select(TASK_SELECT)
  if (input.customerProfileId) query = query.eq("customer_profile_id", input.customerProfileId)
  if (input.ownerUserId) query = query.eq("owner_user_id", input.ownerUserId)
  if (input.status) query = query.eq("status", input.status)
  const { data, error } = await query.order("due_at", { ascending: true, nullsFirst: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapGrowthCustomerOnboardingTaskRow(row as TaskDbRow))
}

export async function insertGrowthCustomerOnboardingTaskRow(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<GrowthCustomerOnboardingTask> {
  const { data, error } = await tasksTable(admin).insert(row).select(TASK_SELECT).single()
  if (error) throw new Error(error.message)
  return mapGrowthCustomerOnboardingTaskRow(data as TaskDbRow)
}

export async function updateGrowthCustomerOnboardingTaskRow(
  admin: SupabaseClient,
  taskId: string,
  patch: Record<string, unknown>,
): Promise<GrowthCustomerOnboardingTask> {
  const { data, error } = await tasksTable(admin)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .select(TASK_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapGrowthCustomerOnboardingTaskRow(data as TaskDbRow)
}

export async function fetchGrowthCustomerOnboardingTaskById(
  admin: SupabaseClient,
  taskId: string,
): Promise<GrowthCustomerOnboardingTask | null> {
  const { data, error } = await tasksTable(admin).select(TASK_SELECT).eq("id", taskId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapGrowthCustomerOnboardingTaskRow(data as TaskDbRow) : null
}

export async function countOnboardingTaskStats(
  admin: SupabaseClient,
  customerProfileId: string,
  nowIso: string,
): Promise<{
  completedCount: number
  openCount: number
  overdueCount: number
}> {
  const { data, error } = await tasksTable(admin)
    .select("status, due_at")
    .eq("customer_profile_id", customerProfileId)
  if (error) throw new Error(error.message)

  let completedCount = 0
  let openCount = 0
  let overdueCount = 0
  for (const row of data ?? []) {
    if (row.status === "completed") completedCount += 1
    if (row.status === "open") {
      openCount += 1
      if (row.due_at && row.due_at < nowIso) overdueCount += 1
    }
  }
  return { completedCount, openCount, overdueCount }
}
