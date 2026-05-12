import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { computeReportAnalytics } from "@/lib/reporting/compute-analytics"
import { getEffectiveOrgPermissions, normalizeOrgMemberRole } from "@/lib/permissions/model"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return jsonError("Invalid organization.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return jsonError("Sign in required.", 401)
  }

  const platformAdmin = isPlatformAdminEmail(user.email)
  if (!platformAdmin) {
    const { data: mem } = await supabase
      .from("organization_members")
      .select("role, permission_profile, permissions_json")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    if (!mem) {
      return jsonError("Forbidden.", 403)
    }
    const reportPerms = getEffectiveOrgPermissions({
      role: normalizeOrgMemberRole((mem as { role?: string }).role),
      permissionProfile: (mem as { permission_profile?: string | null }).permission_profile ?? null,
      permissionsJson: (mem as { permissions_json?: unknown }).permissions_json ?? null,
    })
    if (!reportPerms.canViewOperationalReports && !reportPerms.canViewFinancialReports) {
      return jsonError("Insufficient permissions.", 403)
    }
  }

  const sp = request.nextUrl.searchParams
  const from = sp.get("from") ?? ""
  const to = sp.get("to") ?? ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return jsonError("Query params `from` and `to` (YYYY-MM-DD) are required.", 400)
  }
  if (from > to) {
    return jsonError("`from` must be on or before `to`.", 400)
  }

  const customerId = sp.get("customerId")
  const technicianId = sp.get("technicianId")
  const equipmentCategory = sp.get("equipmentCategory")
  const workOrderStatus = sp.get("workOrderStatus")

  try {
    const payload = await computeReportAnalytics(supabase, organizationId, {
      from,
      to,
      customerId: customerId && customerId !== "all" ? customerId : null,
      technicianId: technicianId && technicianId !== "all" ? technicianId : null,
      equipmentCategory: equipmentCategory && equipmentCategory !== "all" ? equipmentCategory : null,
      workOrderStatus: workOrderStatus && workOrderStatus !== "all" ? workOrderStatus : null,
    })
    return NextResponse.json(payload)
  } catch (e) {
    console.error("[reports/analytics]", e)
    return jsonError("Unable to load analytics right now. Please try again shortly.", 500)
  }
}
