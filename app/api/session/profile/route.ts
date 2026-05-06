import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { removeAvatarObjectIfInBucket } from "@/lib/profile/avatar-storage"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function splitFullName(full: string | null | undefined): { firstName: string; lastName: string } {
  const t = (full ?? "").trim()
  if (!t) return { firstName: "", lastName: "" }
  const i = t.indexOf(" ")
  if (i === -1) return { firstName: t, lastName: "" }
  return { firstName: t.slice(0, i), lastName: t.slice(i + 1).trim() }
}

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: code, message }, { status })
}

/**
 * Current user's profile for Settings → General (mirrors team roster fields).
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return jsonError("unauthorized", "Sign in required.", 401)
  }

  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get("organizationId")?.trim() ?? ""

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("full_name, email, phone, avatar_url")
    .eq("id", user.id)
    .maybeSingle()

  if (pErr) {
    return jsonError("load_failed", pErr.message, 500)
  }

  const row = profile as {
    full_name: string | null
    email: string | null
    phone: string | null
    avatar_url: string | null
  } | null

  const { firstName, lastName } = splitFullName(row?.full_name)
  let jobTitle: string | null = null

  if (organizationId && UUID_RE.test(organizationId)) {
    const { data: mem } = await supabase
      .from("organization_members")
      .select("job_title")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    jobTitle = (mem as { job_title?: string | null } | null)?.job_title ?? null
  }

  const email = (row?.email ?? user.email ?? "").trim()

  return NextResponse.json({
    userId: user.id,
    firstName,
    lastName,
    email,
    phone: row?.phone ?? "",
    jobTitle: jobTitle ?? "",
    avatarUrl: row?.avatar_url ?? "",
  })
}

type PatchBody = {
  organizationId?: string
  firstName?: string
  lastName?: string
  phone?: string | null
  jobTitle?: string | null
  clearAvatar?: boolean
}

export async function PATCH(request: Request) {
  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return jsonError("invalid_json", "Invalid request body.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id || !user.email) {
    return jsonError("unauthorized", "Sign in required.", 401)
  }

  const hasFirst = typeof body.firstName === "string"
  const hasLast = typeof body.lastName === "string"
  let fn = hasFirst ? body.firstName!.trim() : ""
  let ln = hasLast ? body.lastName!.trim() : ""

  if (hasFirst || hasLast) {
    if (!hasFirst || !hasLast) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle()
      const parts = splitFullName((existing as { full_name?: string | null } | null)?.full_name)
      if (!hasFirst) fn = parts.firstName
      if (!hasLast) ln = parts.lastName
    }
  }

  const fullName =
    hasFirst || hasLast ? ([fn, ln].filter(Boolean).join(" ") || null) : undefined

  if (fullName !== undefined && fullName !== null && fullName.length > 200) {
    return jsonError("invalid_name", "Name must be at most 200 characters.", 400)
  }

  const phoneRaw = body.phone
  const phone =
    phoneRaw === undefined ? undefined : typeof phoneRaw === "string" ? phoneRaw.trim().slice(0, 64) : null

  if (phone !== undefined && phone !== null && phone.length > 64) {
    return jsonError("invalid_phone", "Phone must be at most 64 characters.", 400)
  }

  const orgRaw = typeof body.organizationId === "string" ? body.organizationId.trim() : ""
  const hasJob = "jobTitle" in body
  const jobTitleVal =
    hasJob && typeof body.jobTitle === "string" ? body.jobTitle.trim().slice(0, 200) : null

  if (hasJob && (!orgRaw || !UUID_RE.test(orgRaw))) {
    return jsonError("invalid_organization", "organizationId is required to update job title.", 400)
  }

  if (hasJob && jobTitleVal !== null && jobTitleVal.length > 200) {
    return jsonError("invalid_job_title", "Job title must be at most 200 characters.", 400)
  }

  const clearAvatar = body.clearAvatar === true
  const shouldUpdateProfile = fullName !== undefined || phone !== undefined
  if (!shouldUpdateProfile && !hasJob && !clearAvatar) {
    return jsonError("invalid_body", "No fields to update.", 400)
  }

  let svc
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return jsonError("service_unavailable", "Server configuration error.", 503)
  }

  if (clearAvatar) {
    const { data: before } = await svc.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle()
    const prev = (before as { avatar_url?: string | null } | null)?.avatar_url
    await removeAvatarObjectIfInBucket(svc, prev)
    const { error: clrErr } = await svc
      .from("profiles")
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq("id", user.id)
    if (clrErr) {
      return jsonError("update_failed", clrErr.message, 400)
    }
  }

  if (shouldUpdateProfile) {
    const profilePatch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (fullName !== undefined) profilePatch.full_name = fullName
    if (phone !== undefined) profilePatch.phone = phone || null

    const { error: profErr } = await svc.from("profiles").update(profilePatch).eq("id", user.id)
    if (profErr) {
      return jsonError("update_failed", profErr.message, 400)
    }
  }

  if (fullName !== undefined) {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    await svc.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...meta,
        full_name: fullName ?? meta.full_name,
        first_name: fn || meta.first_name,
        last_name: ln || meta.last_name,
      },
    })
  }

  if (hasJob && orgRaw && UUID_RE.test(orgRaw)) {
    const { data: mem } = await svc
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgRaw)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    if (!mem) {
      return jsonError("forbidden", "You are not an active member of this organization.", 403)
    }
    const { error: jErr } = await svc
      .from("organization_members")
      .update({
        job_title: jobTitleVal && jobTitleVal.length > 0 ? jobTitleVal : null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgRaw)
      .eq("user_id", user.id)
    if (jErr) {
      return jsonError("update_failed", jErr.message, 400)
    }
  }

  const { data: refreshed } = await svc
    .from("profiles")
    .select("full_name, email, phone, avatar_url")
    .eq("id", user.id)
    .maybeSingle()

  const pr = refreshed as {
    full_name: string | null
    email: string | null
    phone: string | null
    avatar_url: string | null
  } | null

  const parts = splitFullName(pr?.full_name)
  let jobOut: string | null = null
  if (orgRaw && UUID_RE.test(orgRaw)) {
    const { data: m2 } = await svc
      .from("organization_members")
      .select("job_title")
      .eq("organization_id", orgRaw)
      .eq("user_id", user.id)
      .maybeSingle()
    jobOut = (m2 as { job_title?: string | null } | null)?.job_title ?? null
  }

  return NextResponse.json({
    ok: true,
    userId: user.id,
    firstName: parts.firstName,
    lastName: parts.lastName,
    email: (pr?.email ?? user.email ?? "").trim(),
    phone: pr?.phone ?? "",
    jobTitle: jobOut ?? "",
    avatarUrl: pr?.avatar_url ?? "",
  })
}
