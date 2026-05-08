import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { getOrgPermissionsForRole, normalizeOrgMemberRole } from "@/lib/permissions/model"
import { generateRecommendations } from "@/lib/ai-ops/engine"
import type {
  RecommendationCategory,
  RecommendationPriority,
  RecommendationSummary,
} from "@/lib/ai-ops/types"
import { loadLifecycleMap } from "@/lib/ai-ops/lifecycle-db"
import { applyLifecycleScoresAndSort } from "@/lib/ai-ops/apply-command-layer"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const VALID_CATEGORIES: RecommendationCategory[] = [
  "prospect",
  "financial",
  "dispatch",
  "equipment",
  "certificate",
  "inventory",
  "communications",
  "automation",
  "maintenance",
]
const VALID_PRIORITIES: RecommendationPriority[] = ["high", "medium", "low"]

function jsonError(message: string, status: number, code = "error") {
  return NextResponse.json({ error: code, message }, { status })
}

/**
 * AI Operational Assistant Phase 1.
 *
 * Returns a permission-filtered list of operational recommendations
 * derived from existing tables. Read-only — no records are created
 * or modified by this endpoint.
 *
 * Query params:
 *   - `category=prospect,financial,...` (csv, optional)
 *   - `priority=high,medium,low` (csv, optional)
 *   - `search=...` (optional)
 *   - `limit=1..100` (default 50)
 *   - `includeDismissed=true` (admin debug, default false)
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
  const permissions = getOrgPermissionsForRole(role)

  const url = request.nextUrl
  const categoriesParam = url.searchParams.get("category")
  const priorityParam = url.searchParams.get("priority")
  const search = url.searchParams.get("search") ?? undefined
  const limitRaw = url.searchParams.get("limit")
  const includeDismissed = url.searchParams.get("includeDismissed") === "true"

  const categories = parseCsv<RecommendationCategory>(
    categoriesParam,
    VALID_CATEGORIES as readonly string[],
  )
  const priorities = parseCsv<RecommendationPriority>(
    priorityParam,
    VALID_PRIORITIES as readonly string[],
  )
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined
  const engineLimit = Math.min(Math.max(limit ?? 50, 1), 100)

  const response = await generateRecommendations({
    supabase,
    organizationId,
    permissions,
    filter: {
      categories: categories.length ? categories : undefined,
      priorities: priorities.length ? priorities : undefined,
      search,
      limit: Math.min(engineLimit * 2, 100),
      includeDismissed,
    },
  })

  let items = response.items
  const keys = items.map((i) => i.key)
  const lifecycleMap = await loadLifecycleMap(supabase, organizationId, keys)
  items = applyLifecycleScoresAndSort(items, lifecycleMap)
  if (items.length > engineLimit) items = items.slice(0, engineLimit)

  const summary: RecommendationSummary = {
    total: items.length,
    high: items.filter((i) => i.priority === "high").length,
    medium: items.filter((i) => i.priority === "medium").length,
    low: items.filter((i) => i.priority === "low").length,
    byCategory: {},
  }
  for (const i of items) {
    summary.byCategory[i.category] = (summary.byCategory[i.category] ?? 0) + 1
  }

  return NextResponse.json({
    ...response,
    items,
    summary,
    role,
    canDismiss: Boolean(permissions.canManageWorkspaceSettings) || isPlatformAdmin,
    canCommand: Boolean(permissions.canManageWorkspaceSettings) || isPlatformAdmin,
  })
}

function parseCsv<T extends string>(raw: string | null, allowed: readonly string[]): T[] {
  if (!raw) return []
  const allow = new Set(allowed)
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && allow.has(s)) as T[]
}
