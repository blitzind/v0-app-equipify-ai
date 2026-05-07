/**
 * AI Operational Assistant Phase 1 — orchestrator.
 *
 * Runs the deterministic rule set (`rules.ts`), filters by the
 * caller's permissions, removes/snoozes dismissed items via
 * `ai_ops_dismissals`, sorts by priority + anchor, and returns a
 * single `RecommendationsResponse` ready for the UI.
 *
 * Pure data layer — no side effects, no AI calls. AI-generated
 * explanations are an explicit Phase 2 hook (see `aiNarrate` TODO
 * in `docs/AI_OPS_PHASE1.md`).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { OrgPermissions } from "@/lib/permissions/model"
import { RULES } from "./rules"
import type {
  Recommendation,
  RecommendationCategory,
  RecommendationFilter,
  RecommendationPriority,
  RecommendationsResponse,
  RecommendationSummary,
} from "./types"

const PRIORITY_ORDER: Record<RecommendationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

export type DismissalRow = {
  recommendation_key: string
  category: string
  snoozed_until: string | null
}

export async function loadDismissals(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<DismissalRow[]> {
  const { data, error } = await supabase
    .from("ai_ops_dismissals")
    .select("recommendation_key, category, snoozed_until")
    .eq("organization_id", organizationId)
    .limit(1000)
  if (error || !data) return []
  return data as DismissalRow[]
}

function isDismissalActive(row: DismissalRow, nowIso: string): boolean {
  if (!row.snoozed_until) return true
  return row.snoozed_until > nowIso
}

export async function generateRecommendations(args: {
  supabase: SupabaseClient
  organizationId: string
  permissions: OrgPermissions
  filter?: RecommendationFilter
  /** Defaults to `new Date()` — pass for tests. */
  now?: Date
}): Promise<RecommendationsResponse> {
  const { supabase, organizationId, permissions, filter } = args
  const now = args.now ?? new Date()
  const generatedAtIso = now.toISOString()

  // 1. Determine which rules the caller can see at all.
  const visibleRules = RULES.filter((r) =>
    r.requiresPermission ? Boolean(permissions[r.requiresPermission]) : true,
  )
  const visibleCategories = [
    ...new Set(visibleRules.map((r) => r.category)),
  ] as RecommendationCategory[]

  // 2. Run rules in parallel; tolerate single-rule failures so one
  //    bad query doesn't blank the dashboard.
  const ruleResults = await Promise.all(
    visibleRules.map((r) =>
      r
        .fn({ supabase, organizationId, permissions, now })
        .catch((e: unknown) => {
          // eslint-disable-next-line no-console
          console.warn(`[ai-ops] rule ${r.id} failed`, e)
          return [] as Recommendation[]
        }),
    ),
  )
  let items = ruleResults.flat()

  // 3. Apply filters from the caller (search/category/priority).
  if (filter?.categories?.length) {
    const allowed = new Set(filter.categories)
    items = items.filter((i) => allowed.has(i.category))
  }
  if (filter?.priorities?.length) {
    const allowed = new Set(filter.priorities)
    items = items.filter((i) => allowed.has(i.priority))
  }
  if (filter?.search?.trim()) {
    const q = filter.search.trim().toLowerCase()
    items = items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.explanation.toLowerCase().includes(q) ||
        (i.entity?.label.toLowerCase().includes(q) ?? false),
    )
  }

  // 4. Apply dismissals/snoozes unless explicitly bypassed.
  if (!filter?.includeDismissed) {
    const dismissals = await loadDismissals(supabase, organizationId)
    const activeKeys = new Set(
      dismissals.filter((d) => isDismissalActive(d, generatedAtIso)).map((d) => d.recommendation_key),
    )
    if (activeKeys.size > 0) items = items.filter((i) => !activeKeys.has(i.key))
  }

  // 5. Sort by priority (high → low), then by anchor (oldest first).
  items.sort((a, b) => {
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    if (p !== 0) return p
    const aAnchor = a.anchorIso ?? ""
    const bAnchor = b.anchorIso ?? ""
    if (aAnchor && bAnchor) return aAnchor < bAnchor ? -1 : 1
    if (aAnchor) return -1
    if (bAnchor) return 1
    return 0
  })

  // 6. Apply limit (UI defaults to 50).
  const limit = clampLimit(filter?.limit)
  if (items.length > limit) items = items.slice(0, limit)

  // 7. Build summary KPIs.
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

  return {
    items,
    summary,
    generatedAtIso,
    visibleCategories,
  }
}

function clampLimit(raw: number | undefined): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 50
  return Math.min(Math.max(Math.trunc(raw), 1), 100)
}
