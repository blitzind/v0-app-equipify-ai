import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AidenPreparedActionRow } from "@/lib/aiden/actions/prepared-action-repository"
import { canPrepareAidenActionId } from "@/lib/aiden/actions/action-registry"
import type { AidenPreparedWorkspaceActionId } from "@/lib/aiden/actions/action-types"
import type { CreateFollowUpTaskPreviewPayload } from "@/lib/aiden/actions/resolvers/create-follow-up-task-types"
import { fetchOrganizationPlanId } from "@/lib/ai/plan-gate"
import { isTrialActive, type OrganizationSubscription } from "@/lib/billing/subscriptions"
import type { OrgPermissions } from "@/lib/permissions/model"

const ACTION_ID: AidenPreparedWorkspaceActionId = "create_follow_up_task"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

async function fetchOrgSubscriptionForTrialLocal(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrganizationSubscription | null> {
  const { data } = await supabase
    .from("organization_subscriptions")
    .select("status, trial_ends_at, plan_id")
    .eq("organization_id", organizationId)
    .maybeSingle()
  return (data ?? null) as OrganizationSubscription | null
}

async function reassertPermission(args: {
  supabase: SupabaseClient
  organizationId: string
  permissions: OrgPermissions
  platformAdminPlanBypass?: boolean
}): Promise<boolean> {
  const planId = await fetchOrganizationPlanId(args.organizationId)
  const sub = await fetchOrgSubscriptionForTrialLocal(args.supabase, args.organizationId)
  return canPrepareAidenActionId(
    {
      permissions: args.permissions,
      planId,
      trialActive: isTrialActive(sub),
      platformAdminPlanBypass: args.platformAdminPlanBypass,
    },
    ACTION_ID,
  )
}

function parsePreviewPayload(
  previewPayload: Record<string, unknown>,
): { ok: true; preview: CreateFollowUpTaskPreviewPayload } | { ok: false; message: string } {
  const prev = previewPayload.preview
  if (!isRecord(prev)) return { ok: false, message: "Missing preview object." }
  const title = typeof prev.title === "string" ? prev.title.trim() : ""
  const notes = typeof prev.notes === "string" ? prev.notes : ""
  const dueDate = typeof prev.dueDate === "string" ? prev.dueDate.trim() : ""
  const scheduledForIso = typeof prev.scheduledForIso === "string" ? prev.scheduledForIso.trim() : ""
  const reason = typeof prev.reason === "string" ? prev.reason.trim() : ""
  if (title.length < 2 || title.length > 200) return { ok: false, message: "Title must be between 2 and 200 characters." }
  if (notes.length > 12_000) return { ok: false, message: "Notes are too long." }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { ok: false, message: "Invalid due date." }
  if (!scheduledForIso) return { ok: false, message: "Missing scheduled time." }
  const rel = prev.relatedRecord
  if (!isRecord(rel)) return { ok: false, message: "Missing related record." }
  const entityType = rel.entityType
  const entityId = rel.entityId
  const label = typeof rel.label === "string" ? rel.label.trim() : ""
  if (!label) return { ok: false, message: "Related record label is required." }
  if (typeof entityId !== "string" || !UUID_RE.test(entityId)) return { ok: false, message: "Invalid related record id." }
  const allowed = new Set([
    "customer",
    "work_order",
    "invoice",
    "quote",
    "equipment",
    "maintenance_plan",
    "prospect",
  ])
  if (typeof entityType !== "string" || !allowed.has(entityType)) {
    return { ok: false, message: "Invalid related record type." }
  }
  let assigneeUserId: string | null = null
  if (prev.assigneeUserId === null) assigneeUserId = null
  else if (typeof prev.assigneeUserId === "string" && UUID_RE.test(prev.assigneeUserId)) assigneeUserId = prev.assigneeUserId
  else if (typeof prev.assigneeUserId === "string" && prev.assigneeUserId.trim() === "") assigneeUserId = null
  else if (typeof prev.assigneeUserId === "string") {
    return { ok: false, message: "Invalid assignee user id." }
  }
  const customerId =
    rel.customerId === null || rel.customerId === undefined ?
      null
    : typeof rel.customerId === "string" && UUID_RE.test(rel.customerId) ?
      rel.customerId
    : null
  const customerName =
    rel.customerName === null || rel.customerName === undefined ?
      null
    : typeof rel.customerName === "string" ?
      rel.customerName
    : null

  return {
    ok: true,
    preview: {
      title,
      notes,
      dueDate,
      scheduledForIso,
      assigneeUserId,
      assigneeLabel: typeof prev.assigneeLabel === "string" ? prev.assigneeLabel : null,
      reason: reason || "Operational follow-up.",
      relatedRecord: {
        entityType: entityType as CreateFollowUpTaskPreviewPayload["relatedRecord"]["entityType"],
        entityId,
        label,
        customerId,
        customerName,
      },
    },
  }
}

export type CreateFollowUpTaskExecutorResult =
  | { kind: "success"; followUpTaskId: string; message: string }
  | { kind: "idempotent"; followUpTaskId: string; message: string }
  | { kind: "validation_error"; message: string }
  | { kind: "permission_denied"; message: string }
  | { kind: "server_error"; message: string }

export type ExecuteCreateFollowUpTaskArgs = {
  svc: SupabaseClient
  userSupabase: SupabaseClient
  organizationId: string
  userId: string
  permissions: OrgPermissions
  preparedActionId: string
  row: AidenPreparedActionRow
  platformAdminPlanBypass?: boolean
}

/**
 * Inserts `follow_up_tasks` (pending). Does not create communication_events or send messages.
 */
export async function executeCreateFollowUpTask(
  args: ExecuteCreateFollowUpTaskArgs,
): Promise<CreateFollowUpTaskExecutorResult> {
  const okPerm = await reassertPermission({
    supabase: args.userSupabase,
    organizationId: args.organizationId,
    permissions: args.permissions,
    platformAdminPlanBypass: args.platformAdminPlanBypass,
  })
  if (!okPerm) {
    return { kind: "permission_denied", message: "You do not have permission to create follow-up tasks." }
  }

  const execExisting = args.row.execution_payload as { followUpTaskId?: string } | undefined
  if (args.row.status === "completed" && execExisting?.followUpTaskId && UUID_RE.test(execExisting.followUpTaskId)) {
    return {
      kind: "idempotent",
      followUpTaskId: execExisting.followUpTaskId,
      message: "Follow-up task was already created for this prepared action.",
    }
  }

  const parsed = parsePreviewPayload(args.row.preview_payload ?? {})
  if (!parsed.ok) return { kind: "validation_error", message: parsed.message }
  const preview = parsed.preview

  const dedupeKey = `aiden_pa:${args.preparedActionId}`
  const metadata: Record<string, unknown> = {
    summary: preview.title,
    aiden_origin: true,
    aiden_reason: preview.reason,
    aiden_prepared_action_id: args.preparedActionId,
    no_auto_send: true,
  }
  if (preview.relatedRecord.customerId) metadata.customer_id = preview.relatedRecord.customerId

  const insertRow = {
    organization_id: args.organizationId,
    entity_type: preview.relatedRecord.entityType,
    entity_id: preview.relatedRecord.entityId,
    rule_key: "aiden_manual_follow_up",
    status: "pending" as const,
    priority: "normal" as const,
    assigned_to_user_id: preview.assigneeUserId,
    dedupe_key: dedupeKey,
    scheduled_for: preview.scheduledForIso,
    draft_payload: {
      subject: preview.title,
      body: preview.notes,
      channel: "email",
    },
    metadata,
  }

  const { data, error } = await args.svc.from("follow_up_tasks").insert(insertRow).select("id").maybeSingle()
  if (error) {
    if (error.message.includes("idx_follow_up_tasks_open_dedupe") || error.code === "23505") {
      return {
        kind: "validation_error",
        message: "A matching open follow-up task already exists for this prepared action.",
      }
    }
    return { kind: "server_error", message: error.message }
  }
  const id = (data as { id?: string } | null)?.id
  if (!id) return { kind: "server_error", message: "Insert did not return a task id." }

  return {
    kind: "success",
    followUpTaskId: id,
    message: "Follow-up task added to your queue as pending. Nothing was emailed or texted.",
  }
}
