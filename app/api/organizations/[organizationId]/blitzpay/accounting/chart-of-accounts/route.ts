import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import {
  createCustomCoaAccount,
  ensureBlitzpayDefaultChartOfAccounts,
  listChartOfAccounts,
} from "@/lib/blitzpay/blitzpay-general-ledger-service"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import type { BlitzpayCoaAccountType } from "@/lib/blitzpay/blitzpay-general-ledger"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/accounting/chart-of-accounts",
  )
  if (schemaResp) return schemaResp
  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    await ensureBlitzpayDefaultChartOfAccounts(admin, organizationId)
    const accounts = await listChartOfAccounts(admin, organizationId)
    return NextResponse.json({ accounts })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET accounting/chart-of-accounts", e)
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
    "POST /api/organizations/[organizationId]/blitzpay/accounting/chart-of-accounts",
  )
  if (schemaResp) return schemaResp
  let body: { accountCode?: string; accountName?: string; accountType?: BlitzpayCoaAccountType; parentAccountId?: string | null }
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
    const row = await createCustomCoaAccount(admin, organizationId, {
      accountCode: String(body.accountCode ?? ""),
      accountName: String(body.accountName ?? ""),
      accountType: body.accountType ?? "expense",
      parentAccountId: body.parentAccountId ?? null,
    })
    return NextResponse.json({ account: row })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return NextResponse.json({ error: "conflict", message: "Account code already exists." }, { status: 409 })
    }
    return blitzpayStaffLoadFailedResponse("POST accounting/chart-of-accounts", e)
  }
}
