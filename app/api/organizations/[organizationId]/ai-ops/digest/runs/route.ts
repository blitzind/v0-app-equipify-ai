import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { normalizeOrgMemberRole } from "@/lib/permissions/model"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code = "error") {
  return NextResponse.json({ error: code, message }, { status })
}

/**
 * AI Ops Phase 3 — recent digest history (last 30 runs).
 *
 * Read-only for any org member; the table itself is RLS-gated to
 * org members. Provider message IDs are returned for delivery
 * support but the route never exposes the raw HTML or recipient
 * provider responses.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400, "invalid_org")

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

  const limitRaw = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "30", 10)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30

  const { data, error } = await supabase
    .from("ai_ops_digest_runs")
    .select(
      "id, trigger_kind, status, recipients, items_count, high_count, medium_count, low_count, summary, error_code, error_message, sent_at, created_at, destinations_result",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) return jsonError(error.message, 500, "query_failed")

  return NextResponse.json({
    ok: true,
    runs: (data ?? []).map((row) => {
      const r = row as Record<string, unknown>
      const recipients = Array.isArray(r.recipients)
        ? (r.recipients as unknown[]).filter((x): x is string => typeof x === "string")
        : []
      return {
        id: r.id,
        triggerKind: r.trigger_kind,
        status: r.status,
        recipientCount: recipients.length,
        itemsCount: r.items_count,
        highCount: r.high_count,
        mediumCount: r.medium_count,
        lowCount: r.low_count,
        summary: r.summary,
        errorCode: r.error_code,
        errorMessage: r.error_message,
        sentAt: r.sent_at,
        createdAt: r.created_at,
        destinationsResult:
          r.destinations_result && typeof r.destinations_result === "object"
            ? r.destinations_result
            : {},
      }
    }),
  })
}
