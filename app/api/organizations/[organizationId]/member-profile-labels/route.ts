import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { requireOrganizationMember } from "@/lib/email/route-auth"
import { normalizeUserIdKey } from "@/lib/work-orders/assignee-display-name"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_IDS = 400

function parseUuidList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const x of raw) {
    if (typeof x !== "string") continue
    const t = x.trim()
    if (UUID_RE.test(t)) out.push(t)
  }
  return [...new Set(out)]
}

/**
 * POST `{ userIds: string[] }` → `{ profiles: Record<normalizedUserId, { full_name, email, avatar_url }> }`
 * Only includes users who are **active** members of the organization (same scoping as team roster).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization." }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Expected JSON body." }, { status: 400 })
  }

  const userIds = parseUuidList((body as { userIds?: unknown })?.userIds)
  if (userIds.length === 0) {
    return NextResponse.json({ profiles: {} })
  }
  if (userIds.length > MAX_IDS) {
    return NextResponse.json(
      { error: "too_many_ids", message: `At most ${MAX_IDS} user ids per request.` },
      { status: 400 },
    )
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }

  const allowed = await requireOrganizationMember(supabase, user.id, organizationId)
  if (!allowed) {
    return NextResponse.json({ error: "forbidden", message: "You are not a member of this organization." }, { status: 403 })
  }

  try {
    const admin = createServiceRoleSupabaseClient()
    const { data: memberRows, error: mErr } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .in("user_id", userIds)

    if (mErr) {
      return NextResponse.json({ error: "members_load_failed", message: mErr.message }, { status: 500 })
    }

    const allowedIds = new Set((memberRows ?? []).map((r) => String((r as { user_id: string }).user_id)))
    const toFetch = userIds.filter((id) => allowedIds.has(id))
    if (toFetch.length === 0) {
      return NextResponse.json({ profiles: {} })
    }

    const { data: profs, error: pErr } = await admin
      .from("profiles")
      .select("id, email, full_name, avatar_url")
      .in("id", toFetch)

    if (pErr) {
      return NextResponse.json({ error: "profiles_load_failed", message: pErr.message }, { status: 500 })
    }

    const profiles: Record<string, { full_name: string | null; email: string | null; avatar_url: string | null }> = {}
    for (const row of profs ?? []) {
      const id = (row as { id: string }).id
      const full_name = ((row as { full_name?: string | null }).full_name ?? null) as string | null
      const email = ((row as { email?: string | null }).email ?? null) as string | null
      const avatar_url = ((row as { avatar_url?: string | null }).avatar_url ?? null) as string | null
      profiles[normalizeUserIdKey(id)] = { full_name, email, avatar_url }
    }

    return NextResponse.json({ profiles })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error."
    return NextResponse.json({ error: "server_error", message: msg }, { status: 503 })
  }
}
