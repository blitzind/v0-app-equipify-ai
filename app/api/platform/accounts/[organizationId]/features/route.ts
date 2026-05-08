import { NextResponse } from "next/server"
import { z } from "zod"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import {
  AIDEN_ACTIONS_FEATURE_KEY,
  getAidenActionAvailability,
} from "@/lib/permissions/aiden-actions"
import { createServerSupabaseClient } from "@/lib/supabase/server"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PatchSchema = z.object({
  mode: z.enum(["manual_enable", "forced_disable", "clear_override"]),
  reason: z.string().trim().max(500).optional().nullable(),
})

async function requireAdmin() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return { ok: false as const, response: NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 }) }
  }
  try {
    return { ok: true as const, userId: user.id, admin: createServiceRoleSupabaseClient() }
  } catch {
    return { ok: false as const, response: NextResponse.json({ error: "server_config", message: "Server is not configured." }, { status: 503 }) }
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization id." }, { status: 400 })
  }
  const access = await requireAdmin()
  if (!access.ok) return access.response

  const [{ data: org }, availability] = await Promise.all([
    access.admin.from("organizations").select("id, name, slug").eq("id", organizationId).maybeSingle(),
    getAidenActionAvailability({ supabase: access.admin, organizationId }),
  ])

  return NextResponse.json({ ok: true, organization: org, aidenActions: availability })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization id." }, { status: 400 })
  }
  const access = await requireAdmin()
  if (!access.ok) return access.response

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Send a valid override mode." }, { status: 400 })
  }

  if (parsed.data.mode === "clear_override") {
    const { error } = await access.admin
      .from("organization_feature_overrides")
      .delete()
      .eq("organization_id", organizationId)
      .eq("feature_key", AIDEN_ACTIONS_FEATURE_KEY)
    if (error) return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 })
  } else {
    const { error } = await access.admin
      .from("organization_feature_overrides")
      .upsert(
        {
          organization_id: organizationId,
          feature_key: AIDEN_ACTIONS_FEATURE_KEY,
          enabled: parsed.data.mode === "manual_enable",
          reason: parsed.data.reason?.trim() || null,
          updated_by: access.userId,
        },
        { onConflict: "organization_id,feature_key" },
      )
    if (error) return NextResponse.json({ error: "upsert_failed", message: error.message }, { status: 500 })
  }

  const availability = await getAidenActionAvailability({ supabase: access.admin, organizationId })
  return NextResponse.json({ ok: true, aidenActions: availability })
}
