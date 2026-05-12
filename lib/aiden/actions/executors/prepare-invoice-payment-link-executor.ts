import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import type { AidenPreparedActionRow } from "@/lib/aiden/actions/prepared-action-repository"
import { canPrepareAidenActionId } from "@/lib/aiden/actions/action-registry"
import type { AidenPreparedWorkspaceActionId } from "@/lib/aiden/actions/action-types"
import type { PrepareInvoicePaymentLinkPreviewPayload } from "@/lib/aiden/actions/resolvers/prepare-invoice-payment-link-resolver"
import { fetchOrganizationPlanId } from "@/lib/ai/plan-gate"
import { isTrialActive, type OrganizationSubscription } from "@/lib/billing/subscriptions"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"
import { prepareBlitzpayInvoiceHostedCheckout } from "@/lib/blitzpay/blitzpay-prepare-invoice-pay"
import type { OrgPermissions } from "@/lib/permissions/model"

const ACTION_ID: AidenPreparedWorkspaceActionId = "prepare_invoice_payment_link"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function parsePreviewPayload(
  previewPayload: Record<string, unknown>,
): { ok: true; preview: PrepareInvoicePaymentLinkPreviewPayload } | { ok: false; message: string } {
  const root = previewPayload
  const prev = root.preview
  if (!isRecord(prev)) return { ok: false, message: "Missing preview object." }
  const invoiceId = typeof prev.invoiceId === "string" ? prev.invoiceId.trim() : ""
  if (!invoiceId || !UUID_RE.test(invoiceId)) return { ok: false, message: "Preview is missing a valid invoice id." }
  const inv = prev.invoice
  const cust = prev.customer
  if (!isRecord(inv) || !isRecord(cust)) return { ok: false, message: "Preview is missing invoice or customer." }
  const readiness = prev.readiness
  if (readiness !== "ready" && readiness !== "blocked" && readiness !== "degraded") {
    return { ok: false, message: "Preview readiness is invalid." }
  }
  const warnings = Array.isArray(prev.warnings) ? prev.warnings.filter((w): w is string => typeof w === "string") : []
  return {
    ok: true,
    preview: {
      invoiceId,
      invoice: {
        id: String(inv.id ?? invoiceId),
        invoiceNumber: String(inv.invoiceNumber ?? ""),
        title: String(inv.title ?? ""),
        statusUi: String(inv.statusUi ?? ""),
        amountCents: Math.round(Number(inv.amountCents) || 0),
      },
      customer: {
        id: String(cust.id ?? ""),
        companyName: String(cust.companyName ?? ""),
      },
      amountDueCents: prev.amountDueCents == null ? null : Math.round(Number(prev.amountDueCents)),
      checkoutPreview: null,
      readiness: readiness as PrepareInvoicePaymentLinkPreviewPayload["readiness"],
      warnings,
      blitzpayErrorCode: typeof prev.blitzpayErrorCode === "string" ? prev.blitzpayErrorCode : undefined,
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

async function reassertCanPreparePaymentLink(args: {
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

export type PrepareInvoicePaymentLinkExecutorResult =
  | {
      kind: "success"
      checkoutUrl: string
      checkoutSessionId: string
      stripePaymentIntentId: string
      blitzpayPaymentIntentRowId: string
      invoiceId: string
      message: string
    }
  | {
      kind: "idempotent"
      checkoutUrl: string
      checkoutSessionId: string
      stripePaymentIntentId: string
      blitzpayPaymentIntentRowId: string
      invoiceId: string
      message: string
    }
  | { kind: "validation_error"; message: string }
  | { kind: "permission_denied"; message: string }
  | { kind: "server_error"; message: string }

export type ExecutePrepareInvoicePaymentLinkArgs = {
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
 * Creates a Stripe Checkout session URL for invoice pay. Does not email, SMS, or charge saved payment methods.
 */
export async function executePrepareInvoicePaymentLink(
  args: ExecutePrepareInvoicePaymentLinkArgs,
): Promise<PrepareInvoicePaymentLinkExecutorResult> {
  const { userSupabase, organizationId, permissions, row, platformAdminPlanBypass } = args

  if (row.organization_id !== organizationId) {
    return { kind: "validation_error", message: "Prepared action does not belong to this organization." }
  }
  if (row.action_id !== ACTION_ID) {
    return { kind: "validation_error", message: "Prepared action is not prepare_invoice_payment_link." }
  }

  const canStill = await reassertCanPreparePaymentLink({
    supabase: userSupabase,
    organizationId,
    permissions,
    platformAdminPlanBypass,
  })
  if (!canStill) {
    return { kind: "permission_denied", message: "You no longer have permission to prepare this payment link." }
  }

  const execPayload = row.execution_payload as Record<string, unknown> | null | undefined
  const existingUrl =
    execPayload && typeof execPayload.checkoutUrl === "string" ? String(execPayload.checkoutUrl).trim() : ""
  if (row.status === "completed" && existingUrl) {
    return {
      kind: "idempotent",
      checkoutUrl: existingUrl,
      checkoutSessionId: String(execPayload?.checkoutSessionId ?? ""),
      stripePaymentIntentId: String(execPayload?.stripePaymentIntentId ?? ""),
      blitzpayPaymentIntentRowId: String(execPayload?.blitzpayPaymentIntentRowId ?? ""),
      invoiceId: String(execPayload?.invoiceId ?? row.target_record_id ?? ""),
      message: "Checkout link was already prepared for this action.",
    }
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
      message:
        "BlitzPay is not ready for this invoice (see preview warnings). Fix BlitzPay setup, then prepare again.",
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
    return { kind: "server_error", message: "Server is not configured for payment operations." }
  }

  const drift = await blitzpaySchemaDriftIfUnhealthy(admin, "aiden_prepare_invoice_payment_link_execute")
  if (drift != null) {
    return { kind: "server_error", message: "BlitzPay is not ready (database migrations may be pending)." }
  }

  const result = await prepareBlitzpayInvoiceHostedCheckout({
    admin,
    organizationId,
    invoiceId: parsed.preview.invoiceId,
    initiatedBy: "staff_dashboard",
    userId: args.userId,
  })

  if (!result.ok) {
    return { kind: "validation_error", message: result.message }
  }

  return {
    kind: "success",
    checkoutUrl: result.data.url,
    checkoutSessionId: result.data.checkoutSessionId,
    stripePaymentIntentId: result.data.stripePaymentIntentId,
    blitzpayPaymentIntentRowId: result.data.blitzpayPaymentIntentRowId,
    invoiceId: parsed.preview.invoiceId,
    message:
      "Hosted checkout link is ready. Copy and share it manually — customers are not emailed or texted automatically, and no saved card is charged until they complete checkout.",
  }
}
