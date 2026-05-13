import { NextRequest, NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { requireFeatureAccess } from "@/lib/billing/server-guard"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { buildIndustryBenchmarkIntelligence } from "@/lib/aiden/build-industry-benchmark-intelligence"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code = "error") {
  return NextResponse.json({ ok: false, error: code, message }, { status })
}

/**
 * Anonymized industry operational benchmarks (aggregate-only).
 * GET — no tenant identifiers in aggregate rows; org-local ratios computed under RLS.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400, "invalid_org")

  const gate = await requireOrgPermission(organizationId, "canViewInsights")
  if ("error" in gate) return gate.error

  const {
    data: { user: authUser },
  } = await gate.supabase.auth.getUser()
  const isPlatformAdmin = Boolean(authUser?.email && isPlatformAdminEmail(authUser.email))
  if (!isPlatformAdmin) {
    const planGate = await requireFeatureAccess(gate.supabase, organizationId, "ai")
    if (!planGate.ok) {
      return jsonError(planGate.message, planGate.httpStatus, planGate.code)
    }
  }

  const windowRaw = request.nextUrl.searchParams.get("windowDays")
  const reportingWindowDays = Math.min(365, Math.max(7, Math.round(Number(windowRaw ?? 30) || 30)))

  const { data: orgRow } = await gate.supabase
    .from("organizations")
    .select("industry")
    .eq("id", organizationId)
    .maybeSingle()
  const industryRaw = (orgRow as { industry?: string | null } | null)?.industry ?? null

  const admin = createServiceRoleClient()
  const intelligence = await buildIndustryBenchmarkIntelligence({
    supabase: gate.supabase,
    admin,
    organizationId,
    industryRaw,
    reportingWindowDays,
  })

  return NextResponse.json({ ok: true, intelligence })
}
