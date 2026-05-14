import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MEMBER_ROLES = new Set(["owner", "admin", "manager", "tech", "viewer"])

type Body = {
  email?: string
  role?: string
}

/**
 * Platform admin only: insert or update `organization_members` so a user appears in the app
 * sidebar (requires `status = active`). Does not list orgs to non-admins.
 *
 * POST /api/platform/accounts/[organizationId]/members
 * Body: { "email": "user@company.com", "role": "owner" }
 */
export async function POST(
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

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Invalid JSON." }, { status: 400 })
  }

  const emailRaw = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return NextResponse.json({ error: "invalid_email", message: "A valid email is required." }, { status: 400 })
  }

  const roleRaw = typeof body.role === "string" ? body.role.trim().toLowerCase() : "owner"
  if (!MEMBER_ROLES.has(roleRaw)) {
    return NextResponse.json(
      {
        error: "invalid_role",
        message: `role must be one of: ${[...MEMBER_ROLES].join(", ")}`,
      },
      { status: 400 },
    )
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config", message: "Server is not configured." }, { status: 503 })
  }

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, name, status")
    .eq("id", organizationId)
    .maybeSingle()

  if (orgErr) {
    return NextResponse.json({ error: "query_failed", message: orgErr.message }, { status: 500 })
  }
  if (!org) {
    return NextResponse.json({ error: "not_found", message: "Organization not found." }, { status: 404 })
  }

  if (org.status === "archived") {
    return NextResponse.json(
      {
        error: "organization_archived",
        message:
          "This organization is archived. Unarchive it (Platform Admin) before members can use it in the app sidebar.",
      },
      { status: 409 },
    )
  }

  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("id, email")
    .eq("email", emailRaw)
    .maybeSingle()

  if (profErr) {
    return NextResponse.json({ error: "query_failed", message: profErr.message }, { status: 500 })
  }
  if (!profile?.id) {
    return NextResponse.json(
      {
        error: "profile_not_found",
        message:
          "No profile exists for that email. The user must sign up or accept an invite so a Supabase auth user + profile row exists.",
      },
      { status: 404 },
    )
  }

  const targetUserId = profile.id as string

  const { data: existing } = await admin
    .from("organization_members")
    .select("user_id, role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", targetUserId)
    .maybeSingle()

  const now = new Date().toISOString()

  if (existing) {
    const { error: upErr } = await admin
      .from("organization_members")
      .update({
        role: roleRaw,
        status: "active",
        updated_at: now,
      })
      .eq("organization_id", organizationId)
      .eq("user_id", targetUserId)

    if (upErr) {
      return NextResponse.json({ error: "update_failed", message: upErr.message }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      organizationId,
      userId: targetUserId,
      role: roleRaw,
      status: "active" as const,
      updated: true,
      previousStatus: (existing as { status?: string }).status ?? null,
    })
  }

  const { error: insErr } = await admin.from("organization_members").insert({
    organization_id: organizationId,
    user_id: targetUserId,
    role: roleRaw,
    status: "active",
    invited_by: user.id,
    created_at: now,
    updated_at: now,
    is_field_resource: roleRaw === "tech",
  })

  if (insErr) {
    return NextResponse.json({ error: "insert_failed", message: insErr.message }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    organizationId,
    userId: targetUserId,
    role: roleRaw,
    status: "active" as const,
    updated: false,
  })
}
