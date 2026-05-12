import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import {
  BLITZPAY_MOBILE_INTENT_LIST_CAP,
  filterMobileIntentsForTechnician,
  formatMobileIntentRowForApi,
  insertBlitzpayMobileAuditLog,
  isBlitzpayMobileFinancePrivilegedRole,
  sanitizeMobileMetadataForPersist,
  validateMobileIntentCreate,
} from "@/lib/blitzpay/blitzpay-mobile-financial-ops"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MOBILE_GATE = ["canViewFinancials", "canViewFinancialReports", "canAssistBlitzpayCollection"] as const

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, [...MOBILE_GATE])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/mobile/intents",
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
    let q = admin
      .from("blitzpay_mobile_financial_intents")
      .select(
        "id, technician_id, customer_id, work_order_id, invoice_id, intent_type, intent_status, captured_offline, captured_at, synced_at, reviewed_at, reviewed_by, amount_cents, currency, summary, metadata, created_at, updated_at",
      )
      .eq("organization_id", organizationId)
      .order("updated_at", { ascending: false })
      .limit(BLITZPAY_MOBILE_INTENT_LIST_CAP)
    if (!privileged) {
      q = q.eq("technician_id", gate.userId)
    }
    const { data, error } = await q
    if (error) throw new Error(error.message)
    let rows = (data ?? []) as Record<string, unknown>[]
    if (!privileged) {
      rows = filterMobileIntentsForTechnician(rows as { technician_id?: string | null }[], gate.userId) as Record<
        string,
        unknown
      >[]
    }
    return NextResponse.json({
      disclaimer:
        "Mobile financial actions captured offline are reviewed and validated by the server before they become official financial records.",
      items: rows.map(formatMobileIntentRowForApi),
    })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/mobile/intents", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/mobile/intents",
  )
  if (schemaResp) return schemaResp
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }
  const intent_type = String(body.intent_type ?? "")
  const intent_status = body.intent_status != null ? String(body.intent_status) : undefined
  const v = validateMobileIntentCreate({
    intent_type,
    intent_status,
    amount_cents: body.amount_cents == null ? null : Number(body.amount_cents),
    summary: body.summary == null ? null : String(body.summary),
  })
  if (!v.ok) {
    return NextResponse.json({ error: "bad_request", message: v.message }, { status: 400 })
  }
  const st = intent_status ?? "draft"
  if (st !== "draft" && st !== "queued") {
    return NextResponse.json({ error: "bad_request", message: "invalid_intent_status_for_create" }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const privileged = isBlitzpayMobileFinancePrivilegedRole(gate.role)
  let technician_id: string | null = gate.userId
  if (privileged && body.technician_id != null && String(body.technician_id).trim()) {
    try {
      assertUuid(String(body.technician_id), "technician_id")
      technician_id = String(body.technician_id)
    } catch {
      return NextResponse.json({ error: "bad_request", message: "invalid_technician_id" }, { status: 400 })
    }
  }
  if (!privileged) {
    technician_id = gate.userId
  }
  const captured_offline = Boolean(body.captured_offline)
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
  try {
    const insertRow = {
      organization_id: organizationId,
      technician_id,
      customer_id: optionalUuid("customer_id"),
      work_order_id: optionalUuid("work_order_id"),
      invoice_id: optionalUuid("invoice_id"),
      intent_type,
      intent_status: st,
      captured_offline,
      captured_at: new Date().toISOString(),
      amount_cents: body.amount_cents == null ? null : Math.max(0, Math.round(Number(body.amount_cents))),
      currency: "usd",
      summary: body.summary == null ? null : String(body.summary).slice(0, 2000),
      metadata: sanitizeMobileMetadataForPersist(body.metadata),
    }
    const { data, error } = await admin.from("blitzpay_mobile_financial_intents").insert(insertRow).select("id").single()
    if (error) throw new Error(error.message)
    const id = (data as { id: string }).id
    await insertBlitzpayMobileAuditLog(admin, {
      organization_id: organizationId,
      mobile_intent_id: id,
      audit_type: "intent_captured",
      actor_type: privileged ? "user" : "technician",
      actor_id: gate.userId,
      audit_summary: `Intent captured (${intent_type})`,
      metadata: { intent_type, captured_offline: String(captured_offline) },
    })
    return NextResponse.json({ id, intent_status: st })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/mobile/intents", e)
  }
}
