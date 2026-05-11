import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { gateBlitzPayManagement } from "@/lib/blitzpay/access"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  fetchBlitzpayPayoutLedgerPanelData,
  runManualBlitzpayPayoutLedgerSync,
} from "@/lib/blitzpay/blitzpay-payout-sync"
import { supabaseForBlitzPayOrgWrite } from "@/lib/blitzpay/org-write-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireAnyOrgPermission(organizationId, ["canEditInvoices", "canViewFinancials"])
  if ("error" in gate) return gate.error

  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/payout-ledger",
  )
  if (schemaResp) return schemaResp

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  const since = new URL(request.url).searchParams.get("since")?.trim() || null

  try {
    const data = await fetchBlitzpayPayoutLedgerPanelData(admin, organizationId, {
      sinceIso: since,
    })
    return NextResponse.json({ payoutLedger: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "load_failed", message: msg }, { status: 500 })
  }
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const gate = await gateBlitzPayManagement(supabase, user, organizationId)
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden", message: gate.message }, { status: gate.status })
  }

  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/payout-ledger",
  )
  if (schemaResp) return schemaResp

  const db = await supabaseForBlitzPayOrgWrite(gate)
  const admin = createServiceRoleSupabaseClient()

  const { data: orgRow, error: orgErr } = await db
    .from("organizations")
    .select("stripe_connect_account_id")
    .eq("id", gate.organizationId)
    .maybeSingle()

  if (orgErr) {
    return NextResponse.json({ error: "query_failed", message: orgErr.message }, { status: 500 })
  }

  const acct = String(
    (orgRow as { stripe_connect_account_id?: string | null } | null)?.stripe_connect_account_id ?? "",
  ).trim()
  if (!acct) {
    return NextResponse.json(
      { error: "precondition_failed", message: "No Stripe Connect account for this workspace." },
      { status: 412 },
    )
  }

  try {
    const result = await runManualBlitzpayPayoutLedgerSync(admin, gate.organizationId, acct, user?.id ?? null, {
      payoutLimit: 25,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "sync_failed", message: msg }, { status: 500 })
  }
}
