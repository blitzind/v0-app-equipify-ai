import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AidenPreparedActionRow } from "@/lib/aiden/actions/prepared-action-repository"
import { canPrepareAidenActionId } from "@/lib/aiden/actions/action-registry"
import type { AidenPreparedWorkspaceActionId } from "@/lib/aiden/actions/action-types"
import type { DraftCustomerMessagePreviewPayload } from "@/lib/aiden/actions/resolvers/draft-customer-message-types"
import { fetchOrganizationPlanId } from "@/lib/ai/plan-gate"
import { isTrialActive, type OrganizationSubscription } from "@/lib/billing/subscriptions"
import type { OrgPermissions } from "@/lib/permissions/model"

const ACTION_ID: AidenPreparedWorkspaceActionId = "draft_customer_message"

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function parsePreviewPayload(
  previewPayload: Record<string, unknown>,
): { ok: true; preview: DraftCustomerMessagePreviewPayload } | { ok: false; message: string } {
  const prev = previewPayload.preview
  if (!isRecord(prev)) return { ok: false, message: "Missing preview object." }
  const subject = typeof prev.subject === "string" ? prev.subject.trim() : ""
  const body = typeof prev.body === "string" ? prev.body : ""
  if (subject.length < 2) return { ok: false, message: "Subject must be at least 2 characters." }
  const cust = prev.customer
  if (!isRecord(cust) || typeof cust.id !== "string") return { ok: false, message: "Preview is missing customer." }
  return {
    ok: true,
    preview: {
      scenario: (typeof prev.scenario === "string" ? prev.scenario : "customer_follow_up") as DraftCustomerMessagePreviewPayload["scenario"],
      customer: { id: String(cust.id), companyName: String(cust.companyName ?? "Customer") },
      recordSummary: String(prev.recordSummary ?? ""),
      amountLine: prev.amountLine == null ? null : String(prev.amountLine),
      statusLine: prev.statusLine == null ? null : String(prev.statusLine),
      dateLine: prev.dateLine == null ? null : String(prev.dateLine),
      paymentLinkUrl: prev.paymentLinkUrl == null ? null : String(prev.paymentLinkUrl),
      subject,
      body,
      relatedEntityType:
        prev.relatedEntityType === "invoice" ||
        prev.relatedEntityType === "quote" ||
        prev.relatedEntityType === "work_order" ||
        prev.relatedEntityType === "equipment" ||
        prev.relatedEntityType === "customer"
          ? prev.relatedEntityType
          : null,
      relatedEntityId: typeof prev.relatedEntityId === "string" ? prev.relatedEntityId : null,
      warnings: Array.isArray(prev.warnings) ? prev.warnings.filter((w): w is string => typeof w === "string") : [],
    },
  }
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

export type DraftCustomerMessageExecutorResult =
  | { kind: "success"; communicationEventId: string; message: string }
  | { kind: "idempotent"; communicationEventId: string; message: string }
  | { kind: "validation_error"; message: string }
  | { kind: "permission_denied"; message: string }
  | { kind: "server_error"; message: string }

export type ExecuteDraftCustomerMessageArgs = {
  userSupabase: SupabaseClient
  organizationId: string
  userId: string
  permissions: OrgPermissions
  preparedActionId: string
  row: AidenPreparedActionRow
  platformAdminPlanBypass?: boolean
}

/**
 * Persists the edited draft to `communication_events` as a non-sent draft. Does not email or SMS.
 */
export async function executeDraftCustomerMessage(
  args: ExecuteDraftCustomerMessageArgs,
): Promise<DraftCustomerMessageExecutorResult> {
  const { userSupabase, organizationId, permissions, row, platformAdminPlanBypass } = args

  if (row.organization_id !== organizationId) {
    return { kind: "validation_error", message: "Prepared action does not belong to this organization." }
  }
  if (row.action_id !== ACTION_ID) {
    return { kind: "validation_error", message: "Prepared action is not draft_customer_message." }
  }

  const canStill = await reassertPermission({
    supabase: userSupabase,
    organizationId,
    permissions,
    platformAdminPlanBypass,
  })
  if (!canStill) {
    return { kind: "permission_denied", message: "You no longer have permission to save this draft." }
  }

  const execPayload = row.execution_payload as Record<string, unknown> | null | undefined
  const existingId =
    execPayload && typeof execPayload.communicationEventId === "string" ? execPayload.communicationEventId.trim() : ""
  if (row.status === "completed" && existingId) {
    return {
      kind: "idempotent",
      communicationEventId: existingId,
      message: "Communication draft was already saved for this action.",
    }
  }

  if (row.status !== "confirmed") {
    return { kind: "validation_error", message: "Prepared action must be confirmed before execution." }
  }

  const parsed = parsePreviewPayload(row.preview_payload ?? {})
  if (!parsed.ok) {
    return { kind: "validation_error", message: parsed.message }
  }

  const p = parsed.preview
  const summary = p.recordSummary.slice(0, 500)

  const insert = {
    organization_id: organizationId,
    channel: "email" as const,
    direction: "outbound" as const,
    event_type: "communication_draft",
    title: p.subject.slice(0, 240),
    summary,
    body: p.body,
    audience: "organization" as const,
    counts_toward_unread: false,
    delivery_status: "pending" as const,
    recipient_kind: "customer" as const,
    recipient_customer_id: p.customer.id,
    recipient_address: null as string | null,
    related_entity_type: p.relatedEntityType,
    related_entity_id: p.relatedEntityId,
    provider: "manual" as const,
    metadata: {
      is_draft: true,
      drafted_by: args.userId,
      drafted_at: new Date().toISOString(),
      source: "aiden_prepared_draft_customer_message",
      aidenScenario: p.scenario,
    },
    created_by: args.userId,
  }

  const { data, error } = await userSupabase.from("communication_events").insert(insert).select("id").maybeSingle()

  if (error) {
    return { kind: "server_error", message: error.message }
  }
  const id = (data as { id?: string } | null)?.id
  if (!id) {
    return { kind: "server_error", message: "Insert did not return an id." }
  }

  return {
    kind: "success",
    communicationEventId: id,
    message:
      "Draft saved to Communications. Nothing was sent — open the Communications feed to review or send later.",
  }
}
