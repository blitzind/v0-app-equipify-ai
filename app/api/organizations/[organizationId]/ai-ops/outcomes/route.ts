import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
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

const outcomeSchema = z.object({
  recommendationKey: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(64),
  ruleId: z.string().trim().min(1).max(64),
  outcome: z.enum([
    "opened_entity",
    "drafted_followup",
    "created_automation_suggestion",
    "narrated",
    "dismissed",
    "snoozed",
    "acted_on",
  ]),
  context: z.record(z.unknown()).optional(),
})

/**
 * AI Ops Phase 2 — write a single outcome row.
 *
 * Telemetry only. Insert is permitted for any org member (RLS
 * gated) so we can capture passive activity (e.g. opened_entity)
 * without bouncing techs through manager-only walls.
 *
 * Body:
 *   {
 *     recommendationKey,
 *     category,
 *     ruleId,
 *     outcome,
 *     context?: { entityId?, snoozedUntil? }   // never PII
 *   }
 */
export async function POST(
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError("Invalid JSON body.", 400, "invalid_body")
  }
  const parsed = outcomeSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join("; "), 400, "invalid_body")
  }
  const data = parsed.data

  const { error } = await supabase.from("ai_ops_outcomes").insert({
    organization_id: organizationId,
    recommendation_key: data.recommendationKey,
    category: data.category,
    rule_id: data.ruleId,
    outcome: data.outcome,
    context: data.context ?? {},
    recorded_by: user.id,
  })
  if (error) return jsonError(error.message, 500, "insert_failed")

  return NextResponse.json({ ok: true })
}

/**
 * Returns aggregated outcome counts for the last 30 days. Used by
 * the dashboard digest and future weekly reporting.
 */
export async function GET(
  _request: NextRequest,
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

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from("ai_ops_outcomes")
    .select("outcome, category, created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", since)
    .limit(1000)
  if (error) return jsonError(error.message, 500, "query_failed")

  const byOutcome: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  for (const row of data ?? []) {
    const outcome = (row as { outcome: string }).outcome
    const category = (row as { category: string }).category
    byOutcome[outcome] = (byOutcome[outcome] ?? 0) + 1
    byCategory[category] = (byCategory[category] ?? 0) + 1
  }

  return NextResponse.json({
    ok: true,
    windowDays: 30,
    total: (data ?? []).length,
    byOutcome,
    byCategory,
  })
}
