import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import {
  BLITZPAY_MOBILE_INTENT_LIST_CAP,
  BLITZPAY_MOBILE_SIGNATURE_LIST_CAP,
  formatMobileSignatureRowForList,
  insertBlitzpayMobileAuditLog,
  isBlitzpayMobileFinancePrivilegedRole,
  sanitizeMobileMetadataForPersist,
} from "@/lib/blitzpay/blitzpay-mobile-financial-ops"
import { hashMobileSignatureAuthorization } from "@/lib/blitzpay/blitzpay-mobile-signatures"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MOBILE_GATE = ["canViewFinancials", "canViewFinancialReports", "canAssistBlitzpayCollection"] as const

const AUTH_TYPES = new Set([
  "payment_approval",
  "ach_authorization_acknowledgment",
  "financing_acknowledgment",
  "protection_plan_acknowledgment",
  "claim_acknowledgment",
  "custom",
])

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, [...MOBILE_GATE])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/mobile/signatures",
  )
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const privileged = isBlitzpayMobileFinancePrivilegedRole(gate.role)
    if (privileged) {
      const { data, error } = await admin
        .from("blitzpay_mobile_signature_authorizations")
        .select(
          "id, mobile_intent_id, customer_id, work_order_id, invoice_id, authorization_type, authorization_status, signer_name, signer_email, signed_at, metadata, created_at, updated_at, signature_hash",
        )
        .eq("organization_id", organizationId)
        .order("signed_at", { ascending: false })
        .limit(BLITZPAY_MOBILE_SIGNATURE_LIST_CAP)
      if (error) throw new Error(error.message)
      return NextResponse.json({
        disclaimer:
          "Mobile financial actions captured offline are reviewed and validated by the server before they become official financial records.",
        items: (data ?? []).map((r) => formatMobileSignatureRowForList(r as Record<string, unknown>)),
      })
    }
    const { data: intents, error: iErr } = await admin
      .from("blitzpay_mobile_financial_intents")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("technician_id", gate.userId)
      .order("updated_at", { ascending: false })
      .limit(BLITZPAY_MOBILE_INTENT_LIST_CAP)
    if (iErr) throw new Error(iErr.message)
    const intentIds = (intents ?? []).map((r) => String((r as { id: string }).id)).filter(Boolean)
    if (!intentIds.length) {
      return NextResponse.json({
        disclaimer:
          "Mobile financial actions captured offline are reviewed and validated by the server before they become official financial records.",
        items: [],
      })
    }
    const { data, error } = await admin
      .from("blitzpay_mobile_signature_authorizations")
      .select(
        "id, mobile_intent_id, customer_id, work_order_id, invoice_id, authorization_type, authorization_status, signer_name, signer_email, signed_at, metadata, created_at, updated_at, signature_hash",
      )
      .eq("organization_id", organizationId)
      .in("mobile_intent_id", intentIds)
      .order("signed_at", { ascending: false })
      .limit(BLITZPAY_MOBILE_SIGNATURE_LIST_CAP)
    if (error) throw new Error(error.message)
    return NextResponse.json({
      disclaimer:
        "Mobile financial actions captured offline are reviewed and validated by the server before they become official financial records.",
      items: (data ?? []).map((r) => formatMobileSignatureRowForList(r as Record<string, unknown>)),
    })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/mobile/signatures", e)
  }
}

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, [...MOBILE_GATE])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/mobile/signatures",
  )
  if (schemaResp) return schemaResp
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }
  const authorization_type = String(body.authorization_type ?? "")
  if (!AUTH_TYPES.has(authorization_type)) {
    return NextResponse.json({ error: "bad_request", message: "invalid_authorization_type" }, { status: 400 })
  }
  const opaque = String(body.opaque_client_reference ?? "").trim()
  if (opaque.length < 8 || opaque.length > 512) {
    return NextResponse.json({ error: "bad_request", message: "invalid_opaque_client_reference" }, { status: 400 })
  }
  const signer_name = body.signer_name != null ? String(body.signer_name).trim().slice(0, 240) : ""
  const signer_email = body.signer_email != null ? String(body.signer_email).trim().toLowerCase().slice(0, 240) : ""
  const signedAtIso =
    body.signed_at != null && String(body.signed_at).trim()
      ? new Date(String(body.signed_at)).toISOString()
      : new Date().toISOString()
  const optionalUuid = (k: string): string | null => {
    const raw = body[k]
    if (raw == null || !String(raw).trim()) return null
    try {
      assertUuid(String(raw), k)
      return String(raw)
    } catch {
      return null
    }
  }
  const mobile_intent_id = optionalUuid("mobile_intent_id")
  const privileged = isBlitzpayMobileFinancePrivilegedRole(gate.role)

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  if (mobile_intent_id && !privileged) {
    const { data: own, error: oErr } = await admin
      .from("blitzpay_mobile_financial_intents")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", mobile_intent_id)
      .eq("technician_id", gate.userId)
      .maybeSingle()
    if (oErr) throw new Error(oErr.message)
    if (!own) {
      return NextResponse.json({ error: "forbidden", message: "Intent not in technician scope." }, { status: 403 })
    }
  }

  const signature_hash = hashMobileSignatureAuthorization({
    organizationId,
    authorizationType: authorization_type,
    signedAtIso,
    signerEmailNorm: signer_email,
    signerNameNorm: signer_name,
    opaqueClientReference: opaque,
  })

  try {
    const insertRow = {
      organization_id: organizationId,
      mobile_intent_id,
      customer_id: optionalUuid("customer_id"),
      work_order_id: optionalUuid("work_order_id"),
      invoice_id: optionalUuid("invoice_id"),
      authorization_type,
      authorization_status: "captured",
      signer_name: signer_name || null,
      signer_email: signer_email || null,
      signature_hash,
      signed_at: signedAtIso,
      metadata: sanitizeMobileMetadataForPersist(body.metadata),
    }
    const { data, error } = await admin
      .from("blitzpay_mobile_signature_authorizations")
      .insert(insertRow)
      .select("id")
      .single()
    if (error) throw new Error(error.message)
    const id = (data as { id: string }).id
    await insertBlitzpayMobileAuditLog(admin, {
      organization_id: organizationId,
      mobile_intent_id,
      audit_type: "signature_captured",
      actor_type: privileged ? "user" : "technician",
      actor_id: gate.userId,
      audit_summary: `Signature authorization captured (${authorization_type})`,
      metadata: { authorization_type },
    })
    return NextResponse.json({ id, authorization_status: "captured" })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/mobile/signatures", e)
  }
}
