import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { getOrgPermissionsForRole, normalizeOrgMemberRole } from "@/lib/permissions/model"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code = "error") {
  return NextResponse.json({ error: code, message }, { status })
}

/**
 * AI Ops Phase 1 — manager-only dismiss/snooze for surfaced
 * recommendations. Owner / admin / manager can write; the rule
 * engine then suppresses matching keys until the snooze expires.
 *
 * Body for POST:
 *   {
 *     key: "stale_prospect:<uuid>",
 *     category: "prospect",
 *     snoozeHours?: number,   // default 24*7 (7 days)
 *     reason?: string
 *   }
 *
 * DELETE re-shows a dismissed recommendation:
 *   ?key=stale_prospect:<uuid>
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const guard = await ensureManager(context)
  if ("error" in guard) return guard.error
  const { supabase, organizationId, userId } = guard

  let body: { key?: string; category?: string; snoozeHours?: number; reason?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return jsonError("Invalid JSON body.", 400, "invalid_body")
  }

  const key = (body.key ?? "").trim()
  const category = (body.category ?? "").trim()
  if (!key || !category) {
    return jsonError("`key` and `category` are required.", 400, "invalid_body")
  }
  if (key.length > 200 || category.length > 64) {
    return jsonError("`key` or `category` exceeds maximum length.", 400, "invalid_body")
  }

  const snoozeHoursRaw =
    typeof body.snoozeHours === "number" && Number.isFinite(body.snoozeHours)
      ? body.snoozeHours
      : 24 * 7
  const snoozeHours = Math.min(Math.max(0, snoozeHoursRaw), 24 * 365)
  const snoozedUntil =
    snoozeHours === 0 ? null : new Date(Date.now() + snoozeHours * 3_600_000).toISOString()

  const { error } = await supabase
    .from("ai_ops_dismissals")
    .upsert(
      {
        organization_id: organizationId,
        recommendation_key: key,
        category,
        snoozed_until: snoozedUntil,
        dismissed_by: userId,
        reason: typeof body.reason === "string" ? body.reason.slice(0, 500) : null,
        created_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,recommendation_key" },
    )

  if (error) return jsonError(error.message, 500, "upsert_failed")

  return NextResponse.json({
    ok: true,
    message:
      snoozedUntil === null
        ? "Recommendation dismissed indefinitely."
        : `Snoozed until ${new Date(snoozedUntil).toLocaleString()}.`,
    snoozedUntil,
  })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const guard = await ensureManager(context)
  if ("error" in guard) return guard.error
  const { supabase, organizationId } = guard

  const key = request.nextUrl.searchParams.get("key")
  if (!key) return jsonError("`key` query param required.", 400, "missing_key")

  const { error } = await supabase
    .from("ai_ops_dismissals")
    .delete()
    .eq("organization_id", organizationId)
    .eq("recommendation_key", key)

  if (error) return jsonError(error.message, 500, "delete_failed")
  return NextResponse.json({ ok: true })
}

type Guard =
  | { error: NextResponse }
  | { supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; organizationId: string; userId: string }

async function ensureManager(
  context: { params: Promise<{ organizationId: string }> },
): Promise<Guard> {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return { error: jsonError("Invalid organization.", 400, "invalid_org") }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: jsonError("Sign in required.", 401, "unauthorized") }

  const isPlatformAdmin = isPlatformAdminEmail(user.email)
  const rawRole = isPlatformAdmin
    ? "owner"
    : await getOrganizationMemberRole(supabase, user.id, organizationId)
  const role = normalizeOrgMemberRole(rawRole)
  if (!role && !isPlatformAdmin) return { error: jsonError("Forbidden.", 403, "forbidden") }
  const permissions = getOrgPermissionsForRole(role)
  if (!permissions.canManageWorkspaceSettings && !isPlatformAdmin) {
    return {
      error: jsonError(
        "Only owners, admins, and managers can dismiss recommendations.",
        403,
        "forbidden",
      ),
    }
  }
  return { supabase, organizationId, userId: user.id }
}
