import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { findCustomersByRequesterIdentity } from "@/lib/service-requests/customer-dedupe"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgPermission(organizationId, "canManageDispatch")
  if ("error" in gate) return gate.error

  const sp = new URL(request.url).searchParams
  const email = sp.get("email")?.trim() ?? ""
  const company = sp.get("company")?.trim() ?? ""

  if (email.length < 3 && company.length < 2) {
    return NextResponse.json({ matches: [] })
  }

  const matches = await findCustomersByRequesterIdentity(gate.supabase, organizationId, email || null, company || null)
  return NextResponse.json({ matches })
}
