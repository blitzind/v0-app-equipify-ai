import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { appendBlitzpayManualWalletCredit } from "@/lib/blitzpay/blitzpay-customer-wallet"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; customerId: string }> },
) {
  const { organizationId, customerId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(customerId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid id." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancials"])
  if ("error" in gate) return gate.error

  let body: { amountCents?: number; note?: string; idempotencyKey?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid JSON body." }, { status: 400 })
  }
  const amountCents = Math.round(Number(body.amountCents ?? 0))
  if (!Number.isFinite(amountCents) || amountCents < 1) {
    return NextResponse.json({ error: "bad_request", message: "amountCents must be a positive integer." }, { status: 400 })
  }
  const idem = String(body.idempotencyKey ?? "").trim() || `blitzpay_wallet_manual:${randomUUID()}`

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "POST /api/organizations/[organizationId]/customers/[customerId]/blitzpay/wallet/manual-credit",
  )
  if (drift) return drift

  const { data: cust, error: cErr } = await admin
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .maybeSingle()
  if (cErr || !cust) {
    return NextResponse.json({ error: "not_found", message: "Customer not found." }, { status: 404 })
  }

  const res = await appendBlitzpayManualWalletCredit(admin, {
    organizationId,
    customerId,
    amountCents,
    note: typeof body.note === "string" ? body.note : null,
    actorUserId: gate.userId,
    idempotencyKey: idem,
  })
  return NextResponse.json({ ok: true, duplicate: res.duplicate })
}
