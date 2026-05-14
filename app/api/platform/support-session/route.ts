import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const SUPPORT_SESSION_HOURS = 8

type SupportSessionRow = {
  id: string
  organization_id: string
  expires_at: string
}

async function auditSupportSession(
  admin: ReturnType<typeof createServiceRoleSupabaseClient>,
  action: "support_session_start" | "support_session_end",
  organizationId: string | null,
  adminUserId: string,
) {
  try {
    await admin.from("platform_admin_audit_events").insert({
      action,
      organization_id: organizationId,
      admin_user_id: adminUserId,
      metadata: {},
    })
  } catch {
    /* best-effort */
  }
}

/**
 * GET: current user's active support session (if any).
 * POST: platform admin only — start / refresh session for an organization (service-role insert).
 * DELETE: end session (user deletes own row under RLS).
 */
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }

  const { data: row, error } = await supabase
    .from("organization_support_sessions")
    .select("id, organization_id, expires_at")
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 })
  }

  const r = row as SupportSessionRow | null
  if (!r?.organization_id) {
    return NextResponse.json({ active: false as const })
  }

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id, name, slug, status")
    .eq("id", r.organization_id)
    .maybeSingle()

  if (orgErr || !org) {
    return NextResponse.json({ active: false as const })
  }

  const o = org as { id: string; name: string; slug: string | null; status: string | null }

  return NextResponse.json({
    active: true as const,
    organizationId: o.id,
    organizationName: o.name,
    organizationSlug: o.slug ?? "",
    organizationStatus: o.status ?? "active",
    expiresAt: r.expires_at,
  })
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id || !user.email) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }
  if (!isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 })
  }

  let body: { organizationId?: string }
  try {
    body = (await request.json()) as { organizationId?: string }
  } catch {
    return NextResponse.json({ error: "invalid_body", message: "Invalid JSON." }, { status: 400 })
  }

  const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : ""
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization id." }, { status: 400 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config", message: "Server is not configured." }, { status: 503 })
  }

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id, name, slug, status")
    .eq("id", organizationId)
    .maybeSingle()

  if (orgErr || !org) {
    return NextResponse.json({ error: "not_found", message: "Organization not found." }, { status: 404 })
  }

  const o = org as { id: string; name: string; slug: string | null; status: string | null }
  if (String(o.status || "").toLowerCase() === "archived") {
    return NextResponse.json({ error: "archived", message: "Cannot open an archived organization." }, { status: 409 })
  }

  const expiresAt = new Date(Date.now() + SUPPORT_SESSION_HOURS * 60 * 60 * 1000).toISOString()

  await admin.from("organization_support_sessions").delete().eq("user_id", user.id)

  const { error: insErr } = await admin.from("organization_support_sessions").insert({
    user_id: user.id,
    organization_id: organizationId,
    expires_at: expiresAt,
  })

  if (insErr) {
    return NextResponse.json({ error: "insert_failed", message: insErr.message }, { status: 500 })
  }

  await auditSupportSession(admin, "support_session_start", organizationId, user.id)

  return NextResponse.json({
    ok: true as const,
    organizationId: o.id,
    organizationName: o.name,
    organizationSlug: o.slug ?? "",
    expiresAt,
  })
}

export async function DELETE() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }

  const { data: existing } = await supabase
    .from("organization_support_sessions")
    .select("organization_id")
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle()

  const orgId = (existing as { organization_id?: string } | null)?.organization_id ?? null

  const { error } = await supabase.from("organization_support_sessions").delete().eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 })
  }

  if (user.email && isPlatformAdminEmail(user.email)) {
    try {
      const admin = createServiceRoleSupabaseClient()
      await auditSupportSession(admin, "support_session_end", orgId, user.id)
    } catch {
      /* */
    }
  }

  return NextResponse.json({ ok: true as const })
}
