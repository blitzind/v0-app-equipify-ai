import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { gateBlitzPayManagement } from "@/lib/blitzpay/access"
import { supabaseForBlitzPayOrgWrite } from "@/lib/blitzpay/org-write-client"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { ensureBlitzPayOrgSettings } from "@/lib/blitzpay/payment-repository"
import { DEFAULT_BLITZPAY_DISCLOSURE_COPY } from "@/lib/blitzpay/convenience-fees"
import { picksPlatformManagedFeeFields, picksPlatformOnlyOrgSettings } from "@/lib/blitzpay/blitzpay-settings-policy"

export const runtime = "nodejs"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError(400, "bad_request", "Invalid organization.")
  const supabase = await createServerSupabaseClient()
  const { data: auth } = await supabase.auth.getUser()
  const gate = await gateBlitzPayManagement(supabase, auth.user, organizationId)
  if (!gate.ok) return jsonError(gate.status, "forbidden", gate.message)
  const schemaResp = await blitzpaySchemaGuardNextResponse("GET /api/organizations/[organizationId]/blitzpay/settings")
  if (schemaResp) return schemaResp
  const db = await supabaseForBlitzPayOrgWrite(gate)
  await ensureBlitzPayOrgSettings(db, gate.organizationId)
  const { data, error } = await db
    .from("blitzpay_org_settings")
    .select(
      [
        "organization_id",
        "blitzpay_invoice_pay_enabled",
        "blitzpay_pass_processing_fees_to_customer",
        "blitzpay_fee_mode",
        "blitzpay_fee_percentage_snapshot",
        "blitzpay_fee_cap_cents",
        "blitzpay_fee_disclosure_copy",
        "blitzpay_payment_method_card_enabled",
        "blitzpay_payment_method_ach_enabled",
        "blitzpay_ach_convenience_fee_enabled",
        "blitzpay_ach_processing_timeline_copy",
        "blitzpay_allow_save_payment_methods",
        "blitzpay_partial_payments_enabled",
        "blitzpay_partial_payment_min_cents",
        "blitzpay_platform_partial_payments_allowed",
        "blitzpay_scheduled_payments_enabled",
        "blitzpay_reminders_enabled",
        "blitzpay_receipt_emails_enabled",
        "blitzpay_financing_enabled",
        "blitzpay_installment_plans_enabled",
        "blitzpay_financing_monthly_estimate_disclosure",
      ].join(", "),
    )
    .eq("organization_id", gate.organizationId)
    .maybeSingle()
  if (error) return jsonError(500, "query_failed", "Could not load BlitzPay settings.")
  return NextResponse.json({ settings: data ?? null })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError(400, "bad_request", "Invalid organization.")
  const supabase = await createServerSupabaseClient()
  const { data: auth } = await supabase.auth.getUser()
  const gate = await gateBlitzPayManagement(supabase, auth.user, organizationId)
  if (!gate.ok) return jsonError(gate.status, "forbidden", gate.message)
  const schemaResp = await blitzpaySchemaGuardNextResponse("PATCH /api/organizations/[organizationId]/blitzpay/settings")
  if (schemaResp) return schemaResp
  const db = await supabaseForBlitzPayOrgWrite(gate)
  await ensureBlitzPayOrgSettings(db, gate.organizationId)

  let body: {
    blitzpay_invoice_pay_enabled?: boolean
    blitzpay_pass_processing_fees_to_customer?: boolean
    blitzpay_fee_mode?: "merchant_absorbs" | "customer_pass_through" | "customer_partial_pass_through"
    blitzpay_fee_percentage_snapshot?: number
    blitzpay_fee_cap_cents?: number | null
    blitzpay_fee_disclosure_copy?: string
    blitzpay_payment_method_card_enabled?: boolean
    blitzpay_payment_method_ach_enabled?: boolean
    blitzpay_ach_convenience_fee_enabled?: boolean
    blitzpay_ach_processing_timeline_copy?: string
    blitzpay_allow_save_payment_methods?: boolean
    blitzpay_partial_payments_enabled?: boolean
    blitzpay_partial_payment_min_cents?: number
    blitzpay_platform_partial_payments_allowed?: boolean
    blitzpay_scheduled_payments_enabled?: boolean
    blitzpay_reminders_enabled?: boolean
    blitzpay_receipt_emails_enabled?: boolean
    blitzpay_financing_enabled?: boolean
    blitzpay_installment_plans_enabled?: boolean
    blitzpay_financing_monthly_estimate_disclosure?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return jsonError(400, "bad_request", "Invalid JSON body.")
  }

  if (!gate.platformAdmin) {
    const forbidden = picksPlatformManagedFeeFields(body as Record<string, unknown>)
    if (forbidden.length > 0) {
      return jsonError(
        403,
        "forbidden_fee_controls",
        "BlitzPay convenience fee policy is managed by Equipify and cannot be edited at workspace level.",
      )
    }
    const platformOnly = picksPlatformOnlyOrgSettings(body as Record<string, unknown>)
    if (platformOnly.length > 0) {
      return jsonError(
        403,
        "forbidden_platform_controls",
        "This BlitzPay setting is managed by Equipify and cannot be edited at workspace level.",
      )
    }
  }

  const pass = Boolean(body.blitzpay_pass_processing_fees_to_customer)
  const mode =
    body.blitzpay_fee_mode === "customer_partial_pass_through" || body.blitzpay_fee_mode === "customer_pass_through"
      ? body.blitzpay_fee_mode
      : "merchant_absorbs"
  const pct = Number.isFinite(body.blitzpay_fee_percentage_snapshot)
    ? Math.max(0, Math.min(100, Number(body.blitzpay_fee_percentage_snapshot)))
    : 0
  const disclosureRaw =
    typeof body.blitzpay_fee_disclosure_copy === "string" ? body.blitzpay_fee_disclosure_copy.trim() : ""
  const disclosure = disclosureRaw || DEFAULT_BLITZPAY_DISCLOSURE_COPY
  if (pass && disclosure.length < 10) {
    return jsonError(
      400,
      "invalid_disclosure_copy",
      "Add customer-facing processing-fee disclosure copy before enabling pass-through fees.",
    )
  }
  const cardEnabled = body.blitzpay_payment_method_card_enabled !== false
  const achEnabled = Boolean(body.blitzpay_payment_method_ach_enabled)
  if (!cardEnabled && !achEnabled) {
    return jsonError(400, "invalid_payment_methods", "Enable at least one payment method (card or ACH).")
  }

  const partialMin =
    Number.isFinite(body.blitzpay_partial_payment_min_cents) ?
      Math.max(50, Math.round(Number(body.blitzpay_partial_payment_min_cents)))
    : 50

  const patchBase: Record<string, unknown> = {
    blitzpay_invoice_pay_enabled: Boolean(body.blitzpay_invoice_pay_enabled),
    blitzpay_payment_method_card_enabled: cardEnabled,
    blitzpay_payment_method_ach_enabled: achEnabled,
    blitzpay_ach_processing_timeline_copy:
      typeof body.blitzpay_ach_processing_timeline_copy === "string" && body.blitzpay_ach_processing_timeline_copy.trim()
        ? body.blitzpay_ach_processing_timeline_copy.trim()
        : "Bank (ACH) payments can take 3-5 business days to settle.",
    blitzpay_allow_save_payment_methods: body.blitzpay_allow_save_payment_methods !== false,
    blitzpay_partial_payments_enabled: Boolean(body.blitzpay_partial_payments_enabled),
    blitzpay_partial_payment_min_cents: partialMin,
    blitzpay_scheduled_payments_enabled: body.blitzpay_scheduled_payments_enabled !== false,
    blitzpay_reminders_enabled: body.blitzpay_reminders_enabled !== false,
    blitzpay_receipt_emails_enabled: body.blitzpay_receipt_emails_enabled !== false,
    updated_at: new Date().toISOString(),
  }
  if (Object.prototype.hasOwnProperty.call(body, "blitzpay_financing_enabled")) {
    patchBase.blitzpay_financing_enabled = Boolean(body.blitzpay_financing_enabled)
  }
  if (Object.prototype.hasOwnProperty.call(body, "blitzpay_installment_plans_enabled")) {
    patchBase.blitzpay_installment_plans_enabled = Boolean(body.blitzpay_installment_plans_enabled)
  }
  if (Object.prototype.hasOwnProperty.call(body, "blitzpay_financing_monthly_estimate_disclosure")) {
    patchBase.blitzpay_financing_monthly_estimate_disclosure =
      body.blitzpay_financing_monthly_estimate_disclosure === null ? null
      : typeof body.blitzpay_financing_monthly_estimate_disclosure === "string" ?
        body.blitzpay_financing_monthly_estimate_disclosure.trim().slice(0, 2000) || null
      : null
  }
  const patch = gate.platformAdmin
    ? {
        ...patchBase,
        blitzpay_pass_processing_fees_to_customer: pass,
        blitzpay_fee_mode: pass ? mode : "merchant_absorbs",
        blitzpay_fee_percentage_snapshot: pass ? pct : 0,
        blitzpay_fee_cap_cents:
          body.blitzpay_fee_cap_cents == null ? null : Math.max(0, Math.round(Number(body.blitzpay_fee_cap_cents))),
        blitzpay_fee_disclosure_copy: disclosure,
        blitzpay_ach_convenience_fee_enabled: Boolean(body.blitzpay_ach_convenience_fee_enabled),
        blitzpay_platform_partial_payments_allowed: body.blitzpay_platform_partial_payments_allowed !== false,
      }
    : patchBase

  const { data, error } = await db
    .from("blitzpay_org_settings")
    .update(patch)
    .eq("organization_id", gate.organizationId)
    .select(
      [
        "organization_id",
        "blitzpay_invoice_pay_enabled",
        "blitzpay_pass_processing_fees_to_customer",
        "blitzpay_fee_mode",
        "blitzpay_fee_percentage_snapshot",
        "blitzpay_fee_cap_cents",
        "blitzpay_fee_disclosure_copy",
        "blitzpay_payment_method_card_enabled",
        "blitzpay_payment_method_ach_enabled",
        "blitzpay_ach_convenience_fee_enabled",
        "blitzpay_ach_processing_timeline_copy",
        "blitzpay_allow_save_payment_methods",
        "blitzpay_partial_payments_enabled",
        "blitzpay_partial_payment_min_cents",
        "blitzpay_platform_partial_payments_allowed",
        "blitzpay_scheduled_payments_enabled",
        "blitzpay_reminders_enabled",
        "blitzpay_receipt_emails_enabled",
        "blitzpay_financing_enabled",
        "blitzpay_installment_plans_enabled",
        "blitzpay_financing_monthly_estimate_disclosure",
      ].join(", "),
    )
    .maybeSingle()
  if (error) return jsonError(500, "update_failed", "Could not update BlitzPay settings.")
  return NextResponse.json({ ok: true, settings: data ?? null })
}
