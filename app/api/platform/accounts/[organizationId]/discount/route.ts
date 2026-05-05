import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { persistOrganizationSubscriptionDiscount } from "@/lib/billing/organization-subscription-discount"
import { isPlatformAdminEmail } from "@/lib/platform-admin"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** @deprecated Prefer PATCH `/api/platform/accounts/[organizationId]` with camelCase body. */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization id." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 })
  }

  let body: {
    discount_type?: string | null
    discount_value?: number | null
    discount_reason?: string | null
    discount_label?: string | null
    discount_expires_at?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Invalid JSON." }, { status: 400 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config", message: "Server is not configured." }, { status: 503 })
  }

  const rawType = body.discount_type
  let discount_type: string | null = null
  if (rawType != null && String(rawType).trim() !== "") {
    const t = String(rawType).trim().toLowerCase()
    discount_type = t === "none" ? null : t
  }

  let discount_value: number | null = null
  if (body.discount_value != null && typeof body.discount_value === "number") {
    discount_value = body.discount_value
  } else if (body.discount_value != null && typeof body.discount_value === "string" && body.discount_value.trim() !== "") {
    const n = parseFloat(body.discount_value)
    discount_value = Number.isFinite(n) ? n : null
  }

  const label =
    body.discount_label != null && String(body.discount_label).trim() !== ""
      ? String(body.discount_label).trim()
      : null
  const reason =
    body.discount_reason != null && String(body.discount_reason).trim() !== ""
      ? String(body.discount_reason).trim()
      : null

  const result = await persistOrganizationSubscriptionDiscount(admin, organizationId, {
    discount_type,
    discount_value,
    discount_label: label,
    discount_reason: reason,
    discount_expires_at:
      body.discount_expires_at != null && String(body.discount_expires_at).trim() !== ""
        ? String(body.discount_expires_at)
        : null,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.code, message: result.message }, { status: result.status })
  }

  return NextResponse.json({ ok: true })
}
