import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { gateBlitzPayManagement } from "@/lib/blitzpay/access"
import { supabaseForBlitzPayOrgWrite } from "@/lib/blitzpay/org-write-client"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { ensureBlitzPayOrgSettings } from "@/lib/blitzpay/payment-repository"
import { DEFAULT_BLITZPAY_DISCLOSURE_COPY } from "@/lib/blitzpay/convenience-fees"

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
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return jsonError(400, "bad_request", "Invalid JSON body.")
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

  const patch = {
    blitzpay_invoice_pay_enabled: Boolean(body.blitzpay_invoice_pay_enabled),
    blitzpay_pass_processing_fees_to_customer: pass,
    blitzpay_fee_mode: pass ? mode : "merchant_absorbs",
    blitzpay_fee_percentage_snapshot: pass ? pct : 0,
    blitzpay_fee_cap_cents:
      body.blitzpay_fee_cap_cents == null ? null : Math.max(0, Math.round(Number(body.blitzpay_fee_cap_cents))),
    blitzpay_fee_disclosure_copy: disclosure,
    updated_at: new Date().toISOString(),
  }

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
      ].join(", "),
    )
    .maybeSingle()
  if (error) return jsonError(500, "update_failed", "Could not update BlitzPay settings.")
  return NextResponse.json({ ok: true, settings: data ?? null })
}
