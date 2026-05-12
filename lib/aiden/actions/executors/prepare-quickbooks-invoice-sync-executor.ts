import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import type { AidenPreparedActionRow } from "@/lib/aiden/actions/prepared-action-repository"
import { canPrepareAidenActionId } from "@/lib/aiden/actions/action-registry"
import type { AidenPreparedWorkspaceActionId } from "@/lib/aiden/actions/action-types"
import { fetchOrganizationPlanId } from "@/lib/ai/plan-gate"
import { isTrialActive, type OrganizationSubscription } from "@/lib/billing/subscriptions"
import { getQuickBooksConnection } from "@/lib/integrations/quickbooks/connection"
import { syncInvoicesToQuickBooks } from "@/lib/integrations/quickbooks/invoice-sync"
import { sanitizeQuickBooksClientMessage } from "@/lib/integrations/quickbooks/safe-log"
import type { OrgPermissions } from "@/lib/permissions/model"

const ACTION_ID: AidenPreparedWorkspaceActionId = "prepare_quickbooks_invoice_sync"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function parsePreviewPayload(
  previewPayload: Record<string, unknown>,
): { ok: true; preview: { invoiceId: string; readiness: "ready" | "blocked" | "degraded" } } | { ok: false; message: string } {
  const prev = previewPayload.preview
  if (!isRecord(prev)) return { ok: false, message: "Missing preview object." }
  const invoiceId = typeof prev.invoiceId === "string" ? prev.invoiceId.trim() : ""
  if (!invoiceId || !UUID_RE.test(invoiceId)) return { ok: false, message: "Preview is missing a valid invoice id." }
  const readiness = prev.readiness
  if (readiness !== "ready" && readiness !== "blocked" && readiness !== "degraded") {
    return { ok: false, message: "Preview readiness is invalid." }
  }
  return {
    ok: true,
    preview: {
      invoiceId,
      readiness: readiness as "ready" | "blocked" | "degraded",
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

async function reassertCanPrepare(args: {
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

export type PrepareQuickBooksInvoiceSyncExecutorResult =
  | {
      kind: "success"
      invoiceId: string
      attempted: number
      succeeded: number
      errors: Array<{ internalId: string; message: string }>
      message: string
    }
  | { kind: "validation_error"; message: string }
  | { kind: "permission_denied"; message: string }
  | { kind: "server_error"; message: string }

export type ExecutePrepareQuickBooksInvoiceSyncArgs = {
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
 * Exports/updates a single invoice in QuickBooks using the existing sync pipeline. Requires prior confirmation.
 */
export async function executePrepareQuickBooksInvoiceSync(
  args: ExecutePrepareQuickBooksInvoiceSyncArgs,
): Promise<PrepareQuickBooksInvoiceSyncExecutorResult> {
  const { userSupabase, organizationId, permissions, row, platformAdminPlanBypass } = args

  if (row.organization_id !== organizationId) {
    return { kind: "validation_error", message: "Prepared action does not belong to this organization." }
  }
  if (row.action_id !== ACTION_ID) {
    return { kind: "validation_error", message: "Prepared action is not prepare_quickbooks_invoice_sync." }
  }

  const canStill = await reassertCanPrepare({
    supabase: userSupabase,
    organizationId,
    permissions,
    platformAdminPlanBypass,
  })
  if (!canStill) {
    return { kind: "permission_denied", message: "You no longer have permission to sync this invoice to QuickBooks." }
  }

  if (row.status !== "confirmed") {
    return { kind: "validation_error", message: "Prepared action must be confirmed before execution." }
  }

  const parsed = parsePreviewPayload(row.preview_payload ?? {})
  if (!parsed.ok) {
    return { kind: "validation_error", message: parsed.message }
  }
  if (parsed.preview.readiness === "blocked") {
    return {
      kind: "validation_error",
      message: "QuickBooks sync is blocked for this invoice (see preview warnings). Resolve issues, then prepare again.",
    }
  }

  const { data: inv, error: invErr } = await userSupabase
    .from("org_invoices")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", parsed.preview.invoiceId)
    .maybeSingle()

  if (invErr) {
    return { kind: "server_error", message: invErr.message }
  }
  if (!inv) {
    return { kind: "validation_error", message: "Invoice was not found or is no longer accessible." }
  }

  let admin: SupabaseClient
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return { kind: "server_error", message: "Server is not configured for QuickBooks operations." }
  }

  const conn = await getQuickBooksConnection(admin, organizationId)
  if ("error" in conn) {
    return { kind: "validation_error", message: conn.error }
  }

  const onUnauthorized = async (): Promise<string | null> => {
    const again = await getQuickBooksConnection(admin, organizationId)
    return "error" in again ? null : again.accessToken
  }

  const result = await syncInvoicesToQuickBooks({
    svc: admin,
    organizationId,
    integrationId: conn.integrationId,
    realmId: conn.realmId,
    accessToken: conn.accessToken,
    onUnauthorized,
    onlyInvoiceIds: [parsed.preview.invoiceId],
  })

  const safeErrors = result.errors.map((e) => ({
    internalId: e.internalId,
    message: sanitizeQuickBooksClientMessage(e.message, 400),
  }))

  if (result.attempted === 0 && safeErrors.length === 0) {
    return {
      kind: "validation_error",
      message: "QuickBooks did not attempt this invoice (it may be paid, void, or ineligible).",
    }
  }

  if (result.attempted > 0 && result.succeeded === 0 && safeErrors.length > 0) {
    return {
      kind: "validation_error",
      message: safeErrors[0]?.message ?? "QuickBooks sync failed for this invoice.",
    }
  }

  if (result.attempted === 0 && safeErrors.length > 0) {
    return {
      kind: "validation_error",
      message: safeErrors[0]?.message ?? "QuickBooks sync did not run.",
    }
  }

  const okMsg =
    result.succeeded > 0
      ? `QuickBooks processed this invoice (${result.succeeded} succeeded${result.errors.length ? `, ${result.errors.length} error(s)` : ""}).`
      : result.errors.length > 0
        ? `QuickBooks sync finished with issues: ${safeErrors[0]?.message ?? "See sync logs."}`
        : "QuickBooks sync completed."

  return {
    kind: "success",
    invoiceId: parsed.preview.invoiceId,
    attempted: result.attempted,
    succeeded: result.succeeded,
    errors: safeErrors,
    message: okMsg,
  }
}
