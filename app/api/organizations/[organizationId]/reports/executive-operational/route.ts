import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getEffectiveOrgPermissions, normalizeOrgMemberRole } from "@/lib/permissions/model"
import { isAssignedWorkOnly, loadAssignedWorkScope } from "@/lib/permissions/technician-scope"
import {
  buildExecutiveOperationalReport,
  loadExecutiveReportOrgContext,
  resolveIndustryKeyForReporting,
} from "@/lib/reporting/executive-operational-report"
import {
  buildExecutiveOperationalEmailPayload,
  sendExecutiveOperationalReportEmail,
} from "@/lib/reporting/executive-operational-email"
import {
  executiveOperationalReportPlainText,
  renderExecutiveOperationalReportHtml,
} from "@/lib/reporting/executive-operational-report-html"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

const PostBodySchema = z.object({
  cadence: z.enum(["weekly", "monthly"]),
  customerLocationId: z.string().regex(UUID_RE).nullable().optional(),
  sendEmail: z.boolean().optional(),
  recipients: z.array(z.string().email()).max(20).optional(),
})

async function gateReportsAccess(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string,
  userEmail: string,
  userId: string,
) {
  const platformAdmin = isPlatformAdminEmail(userEmail)
  if (platformAdmin) {
    return {
      ok: true as const,
      permissions: getEffectiveOrgPermissions({
        role: "owner",
        permissionProfile: null,
        permissionsJson: null,
      }),
      userId,
    }
  }

  const { data: mem } = await supabase
    .from("organization_members")
    .select("role, permission_profile, permissions_json")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()
  if (!mem) {
    return { ok: false as const, response: jsonError("Forbidden.", 403) }
  }
  const reportPerms = getEffectiveOrgPermissions({
    role: normalizeOrgMemberRole((mem as { role?: string }).role),
    permissionProfile: (mem as { permission_profile?: string | null }).permission_profile ?? null,
    permissionsJson: (mem as { permissions_json?: unknown }).permissions_json ?? null,
  })
  if (!reportPerms.canViewOperationalReports && !reportPerms.canViewFinancialReports) {
    return { ok: false as const, response: jsonError("Insufficient permissions.", 403) }
  }
  return { ok: true as const, permissions: reportPerms, userId }
}

export async function GET(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
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

  const gate = await gateReportsAccess(supabase, organizationId, user.email, user.id)
  if (!gate.ok) return gate.response
  const { permissions } = gate

  const sp = request.nextUrl.searchParams
  const cadence = sp.get("cadence") === "monthly" ? "monthly" : "weekly"
  const format = sp.get("format") === "html" ? "html" : "json"
  const download = sp.get("download") === "1" || sp.get("download") === "true"
  const customerLocationIdRaw = sp.get("customerLocationId")
  const customerLocationId =
    customerLocationIdRaw && UUID_RE.test(customerLocationIdRaw) ? customerLocationIdRaw : null

  let customerLocationName: string | null = null
  if (customerLocationId) {
    const { data: loc } = await supabase
      .from("customer_locations")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("id", customerLocationId)
      .eq("is_archived", false)
      .maybeSingle()
    if (!loc) {
      return jsonError("Service site not found for this organization.", 404)
    }
    customerLocationName = (loc as { name: string }).name
  }

  let assignedScope = null as Awaited<ReturnType<typeof loadAssignedWorkScope>> | null
  if (isAssignedWorkOnly(permissions)) {
    assignedScope = await loadAssignedWorkScope(supabase, { organizationId, userId: user.id })
  }

  const orgCtx = await loadExecutiveReportOrgContext(supabase, organizationId)
  const industryKey = resolveIndustryKeyForReporting(orgCtx.industry)

  try {
    const report = await buildExecutiveOperationalReport({
      supabase,
      organizationId,
      organizationName: orgCtx.name,
      industryRaw: orgCtx.industry,
      industryKey,
      permissions,
      assignedScope,
      cadence,
      customerLocationId,
      customerLocationName,
    })

    if (format === "html") {
      const html = renderExecutiveOperationalReportHtml(report)
      const filename = `executive-operational-${cadence}-${organizationId.slice(0, 8)}.html`
      const headers = new Headers({ "Content-Type": "text/html; charset=utf-8" })
      if (download) {
        headers.set("Content-Disposition", `attachment; filename="${filename}"`)
      }
      return new NextResponse(html, { status: 200, headers })
    }

    return NextResponse.json(report)
  } catch (e) {
    console.error("[reports/executive-operational]", e)
    return jsonError("Unable to build executive operational report.", 500)
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return jsonError("Invalid organization.", 400)
  }

  const raw = await request.json().catch(() => ({}))
  const parsed = PostBodySchema.safeParse(raw)
  if (!parsed.success) {
    return jsonError(parsed.error.message, 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return jsonError("Sign in required.", 401)
  }

  const gate = await gateReportsAccess(supabase, organizationId, user.email, user.id)
  if (!gate.ok) return gate.response
  const { permissions } = gate

  const customerLocationId = parsed.data.customerLocationId ?? null
  let customerLocationName: string | null = null
  if (customerLocationId) {
    const { data: loc } = await supabase
      .from("customer_locations")
      .select("id, name")
      .eq("organization_id", organizationId)
      .eq("id", customerLocationId)
      .eq("is_archived", false)
      .maybeSingle()
    if (!loc) {
      return jsonError("Service site not found for this organization.", 404)
    }
    customerLocationName = (loc as { name: string }).name
  }

  let assignedScope = null as Awaited<ReturnType<typeof loadAssignedWorkScope>> | null
  if (isAssignedWorkOnly(permissions)) {
    assignedScope = await loadAssignedWorkScope(supabase, { organizationId, userId: user.id })
  }

  const orgCtx = await loadExecutiveReportOrgContext(supabase, organizationId)
  const industryKey = resolveIndustryKeyForReporting(orgCtx.industry)

  const report = await buildExecutiveOperationalReport({
    supabase,
    organizationId,
    organizationName: orgCtx.name,
    industryRaw: orgCtx.industry,
    industryKey,
    permissions,
    assignedScope,
    cadence: parsed.data.cadence,
    customerLocationId,
    customerLocationName,
  })

  const html = renderExecutiveOperationalReportHtml(report)
  const text = executiveOperationalReportPlainText(report)
  const orgTitle = report.organizationName ?? report.organizationId

  if (parsed.data.sendEmail) {
    const recipients = parsed.data.recipients
    if (!recipients?.length) {
      return jsonError("When sendEmail is true, recipients must include at least one email.", 400)
    }
    const payload = buildExecutiveOperationalEmailPayload({
      reportTitleOrg: orgTitle,
      cadence: parsed.data.cadence,
      htmlBody: html,
      textBody: text,
      organizationId,
    })
    const result = await sendExecutiveOperationalReportEmail({ to: recipients, payload, organizationId })
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, code: result.code, report },
        { status: result.code === "config" ? 503 : 400 },
      )
    }
    return NextResponse.json({ ok: true, email: { id: result.id }, report })
  }

  return NextResponse.json({ ok: true, report, export: { html, text } })
}
