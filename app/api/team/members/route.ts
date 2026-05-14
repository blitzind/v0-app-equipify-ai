import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getEffectiveOrgPermissions, normalizeOrgMemberRole } from "@/lib/permissions/model"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isMissingColumnOrSchemaError(err: { message?: string } | null): boolean {
  const m = (err?.message ?? "").toLowerCase()
  return (
    (m.includes("column") && m.includes("does not exist")) ||
    m.includes("could not find") ||
    (m.includes("schema cache") && m.includes("column"))
  )
}

/**
 * List organization members + pending invites. Any active org member may read.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get("organizationId")?.trim() ?? ""

  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }

  const platformAdmin = isPlatformAdminEmail(user.email)

  let currentUserRole: string | null = null
  let canManageTeam = false

  if (!platformAdmin) {
    const { data: me, error: meErr } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    if (meErr || !me) {
      return NextResponse.json({ error: "forbidden", message: "You are not a member of this organization." }, { status: 403 })
    }
    currentUserRole = me.role as string
    canManageTeam = me.role === "owner" || me.role === "admin"
  } else {
    canManageTeam = true
  }

  try {
    const admin = createServiceRoleSupabaseClient()

    if (platformAdmin) {
      const { data: meRow } = await admin
        .from("organization_members")
        .select("role")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle()
      currentUserRole = (meRow?.role as string | undefined) ?? null
    }

    let { data: memberRows, error: mErr } = await admin
      .from("organization_members")
      .select(
        "user_id, role, status, permission_profile, permissions_json, created_at, invited_by, updated_at, is_field_resource",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })

    if (mErr && isMissingColumnOrSchemaError(mErr)) {
      ;({ data: memberRows, error: mErr } = await admin
        .from("organization_members")
        .select("user_id, role, status, permission_profile, permissions_json, created_at, invited_by, updated_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true }))
    }

    if (mErr) {
      return NextResponse.json({ error: "load_failed", message: mErr.message }, { status: 500 })
    }

    const userIds = [...new Set((memberRows ?? []).map((r) => r.user_id as string))]
    let profilesById = new Map<
      string,
      { id: string; email: string | null; full_name: string | null; avatar_url: string | null; phone: string | null }
    >()

    if (userIds.length > 0) {
      const { data: profs, error: pErr } = await admin
        .from("profiles")
        .select("id, email, full_name, avatar_url, phone")
        .in("id", userIds)
      if (!pErr && profs) {
        profilesById = new Map(profs.map((p) => [p.id as string, p as (typeof profs)[number]]))
      }
    }

    const members = (memberRows ?? []).map((row) => {
      const p = profilesById.get(row.user_id as string)
      return {
        userId: row.user_id as string,
        role: row.role as string,
        permissionProfile: (row as { permission_profile?: string | null }).permission_profile ?? null,
        permissionsJson: (row as { permissions_json?: unknown }).permissions_json ?? {},
        effectivePermissions: getEffectiveOrgPermissions({
          role: normalizeOrgMemberRole(row.role as string),
          permissionProfile: (row as { permission_profile?: string | null }).permission_profile ?? null,
          permissionsJson: (row as { permissions_json?: unknown }).permissions_json ?? {},
        }),
        status: row.status as string,
        isFieldResource: Boolean((row as { is_field_resource?: boolean }).is_field_resource),
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string | null,
        invitedBy: row.invited_by as string | null,
        email: p?.email ?? null,
        fullName: p?.full_name ?? null,
        avatarUrl: p?.avatar_url ?? null,
        phone: p?.phone ?? null,
      }
    })

    const nowIso = new Date().toISOString()
    const { data: inviteRows, error: iErr } = await admin
      .from("organization_invites")
      .select("id, email, role, expires_at, created_at")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .is("accepted_at", null)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })

    if (iErr) {
      const soft =
        /does not exist|schema cache|relation/i.test(iErr.message ?? "") ||
        (iErr as { code?: string }).code === "42P01"
      if (soft) {
        console.error("[api/team/members] organization_invites unavailable:", iErr.message)
      } else {
        return NextResponse.json({ error: "load_invites_failed", message: iErr.message }, { status: 500 })
      }
    }

    const inviteList = iErr ? [] : (inviteRows ?? [])
    const pendingInvites = inviteList.map((inv) => ({
      id: inv.id as string,
      email: inv.email as string,
      role: inv.role as string,
      expiresAt: inv.expires_at as string,
      createdAt: inv.created_at as string,
    }))

    return NextResponse.json({
      members,
      pendingInvites,
      currentUserId: user.id,
      currentUserRole,
      canManageTeam,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error."
    return NextResponse.json({ error: "service_unavailable", message: msg }, { status: 503 })
  }
}
