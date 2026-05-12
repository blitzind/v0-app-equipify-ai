import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { createJournalEntryWithLines, listJournalEntries } from "@/lib/blitzpay/blitzpay-general-ledger-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import type { BlitzpayJournalLineInput } from "@/lib/blitzpay/blitzpay-general-ledger"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/accounting/journal-entries",
  )
  if (schemaResp) return schemaResp
  const { searchParams } = new URL(request.url)
  const batchId = searchParams.get("batchId") ?? undefined
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const entries = await listJournalEntries(admin, organizationId, batchId ?? undefined)
    return NextResponse.json({ entries })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET accounting/journal-entries", e)
  }
}

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canManageSettings", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/accounting/journal-entries",
  )
  if (schemaResp) return schemaResp
  let body: {
    batchId?: string
    entryReference?: string
    entryDate?: string
    memo?: string
    sourceType?: string
    sourceId?: string
    lines?: BlitzpayJournalLineInput[]
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON." }, { status: 400 })
  }
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const entry = await createJournalEntryWithLines(admin, organizationId, {
      batchId: String(body.batchId ?? ""),
      entryReference: String(body.entryReference ?? ""),
      entryDate: String(body.entryDate ?? new Date().toISOString().slice(0, 10)),
      memo: body.memo ?? null,
      sourceType: body.sourceType ?? null,
      sourceId: body.sourceId ?? null,
      lines: Array.isArray(body.lines) ? body.lines : [],
    })
    return NextResponse.json({ entry })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("unbalanced") || msg.includes("invalid") || msg.includes("min_two")) {
      return NextResponse.json({ error: "validation_error", message: msg }, { status: 400 })
    }
    return blitzpayStaffLoadFailedResponse("POST accounting/journal-entries", e)
  }
}
