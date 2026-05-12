import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { blitzpaySchemaGuardNextResponse } from "@/lib/blitzpay/blitzpay-schema-health"
import { blitzpayStaffLoadFailedResponse } from "@/lib/blitzpay/blitzpay-staff-load-error-response"
import {
  fetchBlitzpayAiInsightsForOrg,
  regenerateBlitzpayAiFinancialCopilotArtifacts,
} from "@/lib/blitzpay/blitzpay-ai-financial-copilot"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

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

  const gate = await requireAnyOrgPermission(organizationId, ["canViewFinancialReports", "canViewFinancials"])
  if ("error" in gate) return gate.error

  const schemaResp = await blitzpaySchemaGuardNextResponse(
    "GET /api/organizations/[organizationId]/blitzpay/ai/insights",
  )
  if (schemaResp) return schemaResp

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  let regenerate = false
  let includeAll = false
  try {
    const u = new URL(request.url)
    regenerate = u.searchParams.get("regenerate") === "1" || u.searchParams.get("regenerate") === "true"
    includeAll = u.searchParams.get("include") === "all"
  } catch {
    /* ignore */
  }

  try {
    let windowDays = 30
    try {
      const u = new URL(request.url)
      const raw = u.searchParams.get("windowDays")
      if (raw != null) windowDays = Number(raw)
    } catch {
      /* ignore */
    }

    if (regenerate) {
      await regenerateBlitzpayAiFinancialCopilotArtifacts(admin, organizationId, {
        windowDays,
        actorType: "user",
        actorId: gate.userId,
      })
    }
    const insights = await fetchBlitzpayAiInsightsForOrg(admin, organizationId, {
      status: includeAll ? "all" : "active",
    })
    return NextResponse.json({ insights, regenerated: regenerate })
  } catch (e) {
    return blitzpayStaffLoadFailedResponse("GET blitzpay/ai/insights", e)
  }
}
