import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { profileLabelsByUserIds } from "@/lib/prospects/member-profiles"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code = "bad_request") {
  return NextResponse.json({ error: code, message }, { status })
}

/**
 * GET …/prospect-assignees
 *
 * Active org members suitable for prospect ownership pickers (profiles join).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return jsonError("Sign in required.", 401, "unauthorized")

  const platformAdmin = Boolean(user.email && isPlatformAdminEmail(user.email))
  if (!platformAdmin) {
    const { data: mem } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    if (!mem) return jsonError("You are not a member of this organization.", 403, "forbidden")
  }

  const { data: members, error } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("status", "active")

  if (error) return jsonError(error.message, 500, "query_failed")

  const ids = Array.from(
    new Set((members ?? []).map((m) => (m as { user_id: string }).user_id).filter(Boolean)),
  )
  const labelMap = await profileLabelsByUserIds(supabase, ids)

  return NextResponse.json({
    assignees: ids.map((id) => ({
      id,
      label: labelMap.get(id) ?? "Team",
    })),
  })
}
