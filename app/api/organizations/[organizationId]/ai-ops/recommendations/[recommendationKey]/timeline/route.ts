import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { normalizeOrgMemberRole } from "@/lib/permissions/model"
import { listRecommendationEvents } from "@/lib/ai-ops/lifecycle-db"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code = "error") {
  return NextResponse.json({ error: code, message }, { status })
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string; recommendationKey: string }> },
) {
  const { organizationId, recommendationKey: rawKey } = await context.params
  const recommendationKey = decodeURIComponent(rawKey)
  if (!UUID_RE.test(organizationId) || !recommendationKey.trim()) {
    return jsonError("Invalid request.", 400, "invalid_request")
  }

  const surfacedAt = request.nextUrl.searchParams.get("surfacedAt")

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return jsonError("Sign in required.", 401, "unauthorized")

  const isPlatformAdmin = isPlatformAdminEmail(user.email)
  const rawRole = isPlatformAdmin
    ? "owner"
    : await getOrganizationMemberRole(supabase, user.id, organizationId)
  const role = normalizeOrgMemberRole(rawRole)
  if (!role && !isPlatformAdmin) return jsonError("Forbidden.", 403, "forbidden")

  const { data: life } = await supabase
    .from("ai_ops_recommendation_lifecycle")
    .select("state, created_at, updated_at, notes")
    .eq("organization_id", organizationId)
    .eq("recommendation_key", recommendationKey)
    .maybeSingle()

  const events = await listRecommendationEvents(supabase, organizationId, recommendationKey, 100)

  const synthetic: Array<{
    id: string
    eventType: string
    outcome: string | null
    createdAt: string
    synthetic: true
  }> = []

  if (typeof surfacedAt === "string" && surfacedAt.length > 0) {
    synthetic.push({
      id: "surfaced",
      eventType: "recommendation_surfaced",
      outcome: "active",
      createdAt: surfacedAt,
      synthetic: true,
    })
  }

  return NextResponse.json({
    ok: true,
    lifecycle: life ?? null,
    synthetic,
    events: events.map((e) => ({
      id: e.id,
      eventType: e.event_type,
      outcome: e.outcome,
      metadata: e.metadata,
      createdAt: e.created_at,
      synthetic: false as const,
    })),
  })
}
