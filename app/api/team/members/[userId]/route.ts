import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { countActiveOwners, isMembershipRole, type MembershipRole } from "@/lib/team/membership"
import { normalizeOrgMemberRole, normalizePermissionProfile } from "@/lib/permissions/model"
import { insertTeamAuditEvent } from "@/lib/team-audit"
import { removeAvatarObjectIfInBucket } from "@/lib/profile/avatar-storage"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type PatchBody = {
  organizationId?: string
  role?: string
  status?: string
  /** Profile — updated via service role on `profiles` */
  fullName?: string | null
  email?: string | null
  phone?: string | null
  /** Remove avatar image from storage and clear `profiles.avatar_url` */
  clearAvatar?: boolean
  permissionProfile?: string | null
  permissionsJson?: unknown
  /** Schedulable on Dispatch / Schedule / work orders (separate from base role). */
  isFieldResource?: boolean
}

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: code, message }, { status })
}

function isMissingColumnOrSchemaError(err: { message?: string } | null): boolean {
  const m = (err?.message ?? "").toLowerCase()
  return (
    (m.includes("column") && m.includes("does not exist")) ||
    m.includes("could not find") ||
    (m.includes("schema cache") && m.includes("column"))
  )
}

async function loadTargetMembership(organizationId: string, targetUserId: string) {
  const admin = createServiceRoleSupabaseClient()
  let { data, error } = await admin
    .from("organization_members")
    .select("user_id, role, status, permission_profile, permissions_json, is_field_resource")
    .eq("organization_id", organizationId)
    .eq("user_id", targetUserId)
    .maybeSingle()
  if (error && isMissingColumnOrSchemaError(error)) {
    ;({ data, error } = await admin
      .from("organization_members")
      .select("user_id, role, status, permission_profile, permissions_json")
      .eq("organization_id", organizationId)
      .eq("user_id", targetUserId)
      .maybeSingle())
  }
  return { admin, row: data, error }
}

/**
 * Owner or admin may update another member's role/status. Platform admins bypass membership (service role).
 */
export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  const { userId: targetUserId } = await context.params
  if (!UUID_RE.test(targetUserId)) {
    return jsonError("invalid_user", "Invalid user id.", 400)
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return jsonError("invalid_json", "Invalid request body.", 400)
  }

  const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : ""
  if (!UUID_RE.test(organizationId)) {
    return jsonError("invalid_organization", "Invalid organization.", 400)
  }

  const roleRaw = typeof body.role === "string" ? body.role.trim().toLowerCase() : undefined
  const statusRaw = typeof body.status === "string" ? body.status.trim().toLowerCase() : undefined
  const profileRaw =
    typeof body.permissionProfile === "string"
      ? body.permissionProfile.trim().toLowerCase()
      : body.permissionProfile === null
        ? null
        : undefined
  const profile = profileRaw === undefined ? undefined : normalizePermissionProfile(profileRaw)

  const hasFullName = "fullName" in body
  const hasEmail = "email" in body
  const hasPhone = "phone" in body
  const clearAvatar = body.clearAvatar === true
  const hasFieldResource = typeof body.isFieldResource === "boolean"

  const fullNameVal = hasFullName && typeof body.fullName === "string" ? body.fullName.trim() : undefined
  const emailVal = hasEmail && typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined
  const phoneVal = hasPhone && typeof body.phone === "string" ? body.phone.trim() : undefined

  const hasProfileFields = hasFullName || hasEmail || hasPhone || clearAvatar

  if (
    roleRaw === undefined &&
    statusRaw === undefined &&
    profileRaw === undefined &&
    body.permissionsJson === undefined &&
    !hasProfileFields &&
    !clearAvatar &&
    !hasFieldResource
  ) {
    return jsonError(
      "invalid_body",
      "Provide role, status, permission profile, profile fields, clearAvatar, or isFieldResource.",
      400,
    )
  }

  if (roleRaw !== undefined && !isMembershipRole(roleRaw)) {
    return jsonError("invalid_role", "Invalid role.", 400)
  }

  if (statusRaw !== undefined && statusRaw !== "active" && statusRaw !== "suspended") {
    return jsonError("invalid_status", "Status must be active or suspended.", 400)
  }
  if (profileRaw !== undefined && profileRaw !== null && !profile) {
    return jsonError("invalid_permission_profile", "Invalid permission profile.", 400)
  }
  if (
    body.permissionsJson !== undefined &&
    (body.permissionsJson === null || typeof body.permissionsJson !== "object" || Array.isArray(body.permissionsJson))
  ) {
    return jsonError("invalid_permissions", "Permission overrides must be an object.", 400)
  }

  if (hasEmail && emailVal !== undefined && emailVal.length > 0 && !EMAIL_RE.test(emailVal)) {
    return jsonError("invalid_email", "Enter a valid email address.", 400)
  }

  if (hasFullName && fullNameVal !== undefined && fullNameVal.length > 200) {
    return jsonError("invalid_full_name", "Full name must be at most 200 characters.", 400)
  }

  if (hasPhone && phoneVal !== undefined && phoneVal.length > 64) {
    return jsonError("invalid_phone", "Phone must be at most 64 characters.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return jsonError("unauthorized", "Sign in required.", 401)
  }

  const platformAdmin = isPlatformAdminEmail(user.email)

  let actorIsOwner = false
  let actorIsAdmin = false

  if (!platformAdmin) {
    const { data: me, error: meErr } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    if (meErr || !me) {
      return jsonError("forbidden", "You are not a member of this organization.", 403)
    }
    if (me.role !== "owner" && me.role !== "admin") {
      return jsonError("forbidden", "Only owners and admins can update members.", 403)
    }
    actorIsOwner = me.role === "owner"
    actorIsAdmin = me.role === "admin"
  } else {
    actorIsOwner = true
    actorIsAdmin = false
  }

  const { admin, row: target, error: loadErr } = await loadTargetMembership(organizationId, targetUserId)
  if (loadErr) {
    return jsonError("load_failed", loadErr.message, 500)
  }
  if (!target) {
    return jsonError("not_found", "Member not found.", 404)
  }

  const targetRole = target.role as string
  const targetStatus = target.status as string

  if (actorIsAdmin && !actorIsOwner && targetRole === "owner") {
    return jsonError("forbidden", "Admins cannot modify owners.", 403)
  }

  const newRole: MembershipRole | undefined = roleRaw !== undefined ? roleRaw : undefined
  const newStatus = statusRaw

  if (newRole === "owner" && actorIsAdmin && !platformAdmin) {
    return jsonError("forbidden", "Only an owner can assign the owner role.", 403)
  }

  const ownerCount = await countActiveOwners(admin, organizationId)
  const targetIsActiveOwner = targetRole === "owner" && targetStatus === "active"

  if (targetIsActiveOwner && ownerCount <= 1) {
    if (newRole !== undefined && newRole !== "owner") {
      return jsonError("last_owner", "Cannot change the last owner's role.", 409)
    }
    if (newStatus === "suspended") {
      return jsonError("last_owner", "Cannot suspend the last owner.", 409)
    }
  }

  if (hasFieldResource) {
    const effectiveRole = normalizeOrgMemberRole(newRole !== undefined ? newRole : targetRole)
    if (body.isFieldResource && (!effectiveRole || effectiveRole === "viewer")) {
      return jsonError(
        "invalid_field_resource",
        "Viewers cannot be enabled as field resources for scheduling.",
        400,
      )
    }
  }

  const patch: Record<string, unknown> = {}
  if (newRole !== undefined && newRole !== targetRole) {
    patch.role = newRole
  }
  if (newStatus !== undefined && newStatus !== targetStatus) {
    patch.status = newStatus
  }
  if (profileRaw !== undefined) {
    patch.permission_profile = profileRaw === null ? null : profile
  }
  if (body.permissionsJson !== undefined) {
    patch.permissions_json = body.permissionsJson
  }
  if (hasFieldResource) {
    const currentFr = Boolean((target as { is_field_resource?: boolean }).is_field_resource)
    if (body.isFieldResource !== currentFr) {
      patch.is_field_resource = body.isFieldResource
    }
  }
  if (patch.role === "viewer") {
    patch.is_field_resource = false
  }

  const membershipChanged = Object.keys(patch).length > 0

  if (membershipChanged) {
    const client = platformAdmin ? admin : supabase
    const { error: upErr } = await client
      .from("organization_members")
      .update(patch)
      .eq("organization_id", organizationId)
      .eq("user_id", targetUserId)

    if (upErr) {
      return jsonError("update_failed", upErr.message, 400)
    }

    if (patch.role !== undefined) {
      await insertTeamAuditEvent({
        organizationId,
        action: "member_role_changed",
        actorUserId: user.id,
        recordType: "organization_member",
        recordId: `${organizationId}:${targetUserId}`,
        metadata: { userId: targetUserId, fromRole: targetRole, toRole: patch.role },
      })
    }
    if (patch.status === "suspended") {
      await insertTeamAuditEvent({
        organizationId,
        action: "member_suspended",
        actorUserId: user.id,
        recordType: "organization_member",
        recordId: `${organizationId}:${targetUserId}`,
        metadata: { userId: targetUserId },
      })
    }
    if (patch.status === "active" && targetStatus === "suspended") {
      await insertTeamAuditEvent({
        organizationId,
        action: "member_reactivated",
        actorUserId: user.id,
        recordType: "organization_member",
        recordId: `${organizationId}:${targetUserId}`,
        metadata: { userId: targetUserId },
      })
    }
  }

  let wroteProfile = false
  if (hasProfileFields) {
    const svc = createServiceRoleSupabaseClient()
    const profilePatch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (clearAvatar) {
      const { data: profBefore } = await svc.from("profiles").select("avatar_url").eq("id", targetUserId).maybeSingle()
      await removeAvatarObjectIfInBucket(svc, profBefore?.avatar_url as string | null | undefined)
      profilePatch.avatar_url = null
    }

    if (hasFullName) profilePatch.full_name = fullNameVal || null
    if (hasPhone) profilePatch.phone = phoneVal || null

    if (hasEmail && emailVal !== undefined) {
      if (!emailVal) {
        return jsonError("invalid_email", "Email cannot be empty.", 400)
      }
      const { data: curProf } = await svc.from("profiles").select("email").eq("id", targetUserId).maybeSingle()
      const curEm = ((curProf?.email as string | null) ?? "").trim().toLowerCase()
      if (emailVal !== curEm) {
        const { error: authErr } = await svc.auth.admin.updateUserById(targetUserId, { email: emailVal })
        if (authErr) {
          return jsonError("email_update_failed", authErr.message, 400)
        }
      }
      profilePatch.email = emailVal
    }

    const { error: pErr } = await svc.from("profiles").update(profilePatch).eq("id", targetUserId)
    if (pErr) {
      return jsonError("profile_update_failed", pErr.message, 400)
    }
    wroteProfile = true
  }

  if (!membershipChanged && !wroteProfile) {
    return NextResponse.json({ ok: true, unchanged: true })
  }

  return NextResponse.json({ ok: true })
}

/**
 * Remove membership. Owner/admin, or platform admin (service role). Last owner cannot be removed.
 */
export async function DELETE(request: Request, context: { params: Promise<{ userId: string }> }) {
  const { userId: targetUserId } = await context.params
  if (!UUID_RE.test(targetUserId)) {
    return jsonError("invalid_user", "Invalid user id.", 400)
  }

  let organizationId = ""
  try {
    const body = (await request.json()) as { organizationId?: string }
    organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : ""
  } catch {
    /* allow empty */
  }
  if (!UUID_RE.test(organizationId)) {
    const { searchParams } = new URL(request.url)
    organizationId = searchParams.get("organizationId")?.trim() ?? ""
  }
  if (!UUID_RE.test(organizationId)) {
    return jsonError("invalid_organization", "Invalid organization.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return jsonError("unauthorized", "Sign in required.", 401)
  }

  const platformAdmin = isPlatformAdminEmail(user.email)

  let actorIsOwner = false

  if (!platformAdmin) {
    const { data: me, error: meErr } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    if (meErr || !me) {
      return jsonError("forbidden", "You are not a member of this organization.", 403)
    }
    if (me.role !== "owner" && me.role !== "admin") {
      return jsonError("forbidden", "Only owners and admins can remove members.", 403)
    }
    actorIsOwner = me.role === "owner"
    const actorIsAdmin = me.role === "admin"

    const { admin, row: target, error: loadErr } = await loadTargetMembership(organizationId, targetUserId)
    if (loadErr) {
      return jsonError("load_failed", loadErr.message, 500)
    }
    if (!target) {
      return jsonError("not_found", "Member not found.", 404)
    }

    if (actorIsAdmin && !actorIsOwner && target.role === "owner") {
      return jsonError("forbidden", "Admins cannot remove owners.", 403)
    }

    const ownerCount = await countActiveOwners(admin, organizationId)
    if (target.role === "owner" && target.status === "active" && ownerCount <= 1) {
      return jsonError("last_owner", "Cannot remove the last owner.", 409)
    }

    const { error: delErr } = await supabase
      .from("organization_members")
      .delete()
      .eq("organization_id", organizationId)
      .eq("user_id", targetUserId)

    if (delErr) {
      return jsonError("delete_failed", delErr.message, 400)
    }
  } else {
    const { admin, row: target, error: loadErr } = await loadTargetMembership(organizationId, targetUserId)
    if (loadErr) {
      return jsonError("load_failed", loadErr.message, 500)
    }
    if (!target) {
      return jsonError("not_found", "Member not found.", 404)
    }

    const ownerCount = await countActiveOwners(admin, organizationId)
    if (target.role === "owner" && target.status === "active" && ownerCount <= 1) {
      return jsonError("last_owner", "Cannot remove the last owner.", 409)
    }

    const { error: delErr } = await admin
      .from("organization_members")
      .delete()
      .eq("organization_id", organizationId)
      .eq("user_id", targetUserId)

    if (delErr) {
      return jsonError("delete_failed", delErr.message, 400)
    }
  }

  await insertTeamAuditEvent({
    organizationId,
    action: "member_removed",
    actorUserId: user.id,
    recordType: "organization_member",
    recordId: `${organizationId}:${targetUserId}`,
    metadata: { userId: targetUserId },
  })

  return NextResponse.json({ ok: true })
}
