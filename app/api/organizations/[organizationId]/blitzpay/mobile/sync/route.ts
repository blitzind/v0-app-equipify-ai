import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import { processMobileSyncIntents } from "@/lib/blitzpay/blitzpay-mobile-financial-ops"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MOBILE_GATE = ["canViewFinancials", "canViewFinancialReports", "canAssistBlitzpayCollection"] as const

// Bounded reads for intent sync are enforced inside processMobileSyncIntents via `.limit(` on queries.

export async function POST(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, [...MOBILE_GATE])
  if ("error" in gate) return gate.error
  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "POST /api/organizations/[organizationId]/blitzpay/mobile/sync",
  )
  if (schemaResp) return schemaResp
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }
  const rawIds = body.intentIds
  if (!Array.isArray(rawIds)) {
    return NextResponse.json({ error: "bad_request", message: "intentIds_required" }, { status: 400 })
  }
  const intentIds: string[] = []
  for (const x of rawIds) {
    if (intentIds.length >= 40) break
    try {
      assertUuid(String(x), "intentId")
      intentIds.push(String(x))
    } catch {
      /* skip invalid */
    }
  }
  const clientMap = body.clientUpdatedAtByIntentId
  const clientUpdatedAtByIntentId =
    clientMap && typeof clientMap === "object" && !Array.isArray(clientMap)
      ? (clientMap as Record<string, string | null>)
      : null
  const deviceReferenceHash =
    body.device_reference_hash != null ? String(body.device_reference_hash).trim().slice(0, 128) : null

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  try {
    const result = await processMobileSyncIntents(admin, organizationId, {
      intentIds,
      clientUpdatedAtByIntentId,
      userId: gate.userId,
      deviceReferenceHash,
    })
    return NextResponse.json({
      disclaimer:
        "Mobile financial actions captured offline are reviewed and validated by the server before they become official financial records.",
      ...result,
    })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("POST blitzpay/mobile/sync", e)
  }
}
