import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }
  const gate = await requireAnyOrgPermission(organizationId, [
    "canViewFinancials",
    "canViewBilling",
    "canEditInvoices",
  ])
  if ("error" in gate) return gate.error

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }
  const drift = await blitzpaySchemaDriftIfUnhealthy(
    admin,
    "GET /api/organizations/[organizationId]/blitzpay/financing/summary",
  )
  if (drift) return drift

  const [{ data: settings }, { data: catalog }, { data: orgToggles }] = await Promise.all([
    admin
      .from("blitzpay_org_settings")
      .select(
        "blitzpay_financing_enabled, blitzpay_installment_plans_enabled, blitzpay_financing_monthly_estimate_disclosure",
      )
      .eq("organization_id", organizationId)
      .maybeSingle(),
    admin
      .from("blitzpay_financing_providers")
      .select("code, display_name, integration_stage, active, sort_order")
      .order("sort_order", { ascending: true }),
    admin.from("blitzpay_org_financing_providers").select("provider_code, enabled").eq("organization_id", organizationId),
  ])

  const s = settings as Record<string, unknown> | null
  return NextResponse.json({
    org: {
      financingEnabled: Boolean(s?.blitzpay_financing_enabled),
      installmentPlansEnabled: Boolean(s?.blitzpay_installment_plans_enabled),
      monthlyEstimateDisclosure:
        typeof s?.blitzpay_financing_monthly_estimate_disclosure === "string" ?
          s.blitzpay_financing_monthly_estimate_disclosure
        : null,
    },
    providers: (catalog ?? []) as Array<{
      code: string
      display_name: string
      integration_stage: string
      active: boolean
      sort_order: number
    }>,
    orgProviderToggles: (orgToggles ?? []) as Array<{ provider_code: string; enabled: boolean }>,
  })
}
