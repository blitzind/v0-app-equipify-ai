/**
 * AI Operational Assistant Phase 3 — digest payload builder.
 *
 * Pure data layer. Calls the same deterministic engine the dashboard
 * uses, applies digest-specific filters (priority threshold,
 * categories), groups items by category, and returns a payload
 * suitable for the email template, the in-app preview, and any
 * future Slack/Teams adapters.
 *
 * No AI calls. The optional LLM "intro paragraph" is generated
 * separately by the cron route via `runAiTask` so this module stays
 * synchronous and trivially testable.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { OrgPermissions } from "@/lib/permissions/model"
import { getOrgPermissionsForRole } from "@/lib/permissions/model"
import { generateRecommendations } from "./engine"
import type {
  Recommendation,
  RecommendationCategory,
  RecommendationPriority,
  RecommendationsResponse,
} from "./types"

export type DigestSettingsRow = {
  organization_id: string
  enabled: boolean
  recipients: string[]
  send_hour: number
  timezone_snapshot: string | null
  priority_threshold: RecommendationPriority
  categories: RecommendationCategory[]
  slack_webhook_url: string | null
  teams_webhook_url: string | null
  skip_weekends: boolean
  last_sent_at: string | null
}

const PRIORITY_RANK: Record<RecommendationPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

export const MAX_DIGEST_ITEMS = 25
export const MAX_HIGHLIGHT_ITEMS = 5

export type DigestPayload = {
  generatedAtIso: string
  organization: {
    id: string
    name: string
    timezone: string
  }
  totals: {
    total: number
    high: number
    medium: number
    low: number
  }
  /** Top items shown in the digest body. Sorted by priority desc, anchor asc. */
  highlights: Recommendation[]
  /** All eligible items (capped at `MAX_DIGEST_ITEMS`) — used by the email "more" section. */
  items: Recommendation[]
  /** items grouped by category for the email layout. */
  byCategory: Array<{ category: RecommendationCategory; items: Recommendation[] }>
  /** Counts of acted-on/dismissed/snoozed in the last 7 days for the recap header. */
  recentActivity: {
    actedOn: number
    dismissed: number
    snoozed: number
    drafted: number
  }
}

export type LoadDigestSettingsResult =
  | { row: DigestSettingsRow }
  | { row: null }

export async function loadDigestSettings(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<LoadDigestSettingsResult> {
  const { data, error } = await supabase
    .from("ai_ops_digest_settings")
    .select(
      "organization_id, enabled, recipients, send_hour, timezone_snapshot, priority_threshold, categories, slack_webhook_url, teams_webhook_url, skip_weekends, last_sent_at",
    )
    .eq("organization_id", organizationId)
    .maybeSingle()
  if (error || !data) return { row: null }
  return { row: normalizeSettingsRow(data as Record<string, unknown>) }
}

export function defaultDigestSettings(organizationId: string): DigestSettingsRow {
  return {
    organization_id: organizationId,
    enabled: false,
    recipients: [],
    send_hour: 7,
    timezone_snapshot: null,
    priority_threshold: "medium",
    categories: [],
    slack_webhook_url: null,
    teams_webhook_url: null,
    skip_weekends: false,
    last_sent_at: null,
  }
}

export function normalizeSettingsRow(row: Record<string, unknown>): DigestSettingsRow {
  const recipients = Array.isArray(row.recipients)
    ? (row.recipients as unknown[]).filter((r): r is string => typeof r === "string")
    : []
  const categories = Array.isArray(row.categories)
    ? (row.categories as unknown[]).filter((c): c is string => typeof c === "string")
    : []
  return {
    organization_id: String(row.organization_id),
    enabled: Boolean(row.enabled),
    recipients,
    send_hour: clampHour(row.send_hour),
    timezone_snapshot: typeof row.timezone_snapshot === "string" ? row.timezone_snapshot : null,
    priority_threshold:
      (row.priority_threshold === "high" ||
      row.priority_threshold === "low" ||
      row.priority_threshold === "medium"
        ? row.priority_threshold
        : "medium") as RecommendationPriority,
    categories: categories as RecommendationCategory[],
    slack_webhook_url: typeof row.slack_webhook_url === "string" ? row.slack_webhook_url : null,
    teams_webhook_url: typeof row.teams_webhook_url === "string" ? row.teams_webhook_url : null,
    skip_weekends: Boolean(row.skip_weekends),
    last_sent_at: typeof row.last_sent_at === "string" ? row.last_sent_at : null,
  }
}

function clampHour(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 7
  const truncated = Math.trunc(value)
  if (truncated < 0) return 0
  if (truncated > 23) return 23
  return truncated
}

export type BuildDigestPayloadArgs = {
  supabase: SupabaseClient
  organizationId: string
  organizationName: string
  organizationTimezone: string
  /**
   * Permissions used to filter recommendations. The cron uses an
   * "owner-equivalent" permission map so the digest never silently
   * drops categories. Manual previews respect the caller's role.
   */
  permissions: OrgPermissions
  settings: DigestSettingsRow
  /** Defaults to `new Date()`. */
  now?: Date
}

export async function buildDigestPayload(args: BuildDigestPayloadArgs): Promise<DigestPayload> {
  const now = args.now ?? new Date()
  const threshold = args.settings.priority_threshold
  const minRank = PRIORITY_RANK[threshold]
  const includedCategories = args.settings.categories.length
    ? new Set(args.settings.categories)
    : null

  const response: RecommendationsResponse = await generateRecommendations({
    supabase: args.supabase,
    organizationId: args.organizationId,
    permissions: args.permissions,
    filter: { limit: 100 },
    now,
  })

  const filtered = response.items
    .filter((i) => PRIORITY_RANK[i.priority] >= minRank)
    .filter((i) => (includedCategories ? includedCategories.has(i.category) : true))
    .slice(0, MAX_DIGEST_ITEMS)

  const totals = {
    total: filtered.length,
    high: filtered.filter((i) => i.priority === "high").length,
    medium: filtered.filter((i) => i.priority === "medium").length,
    low: filtered.filter((i) => i.priority === "low").length,
  }

  const byCategory = groupByCategory(filtered)
  const highlights = filtered.slice(0, MAX_HIGHLIGHT_ITEMS)

  const recentActivity = await loadRecentActivity(args.supabase, args.organizationId, now)

  return {
    generatedAtIso: now.toISOString(),
    organization: {
      id: args.organizationId,
      name: args.organizationName,
      timezone: args.organizationTimezone,
    },
    totals,
    highlights,
    items: filtered,
    byCategory,
    recentActivity,
  }
}

function groupByCategory(items: Recommendation[]): DigestPayload["byCategory"] {
  const m = new Map<RecommendationCategory, Recommendation[]>()
  for (const i of items) {
    const arr = m.get(i.category) ?? []
    arr.push(i)
    m.set(i.category, arr)
  }
  // Sort categories alphabetically for stability.
  return Array.from(m.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({ category, items }))
}

async function loadRecentActivity(
  supabase: SupabaseClient,
  organizationId: string,
  now: Date,
): Promise<DigestPayload["recentActivity"]> {
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from("ai_ops_outcomes")
    .select("outcome")
    .eq("organization_id", organizationId)
    .gte("created_at", since)
    .limit(500)
  let actedOn = 0
  let dismissed = 0
  let snoozed = 0
  let drafted = 0
  for (const row of (data ?? []) as Array<{ outcome: string }>) {
    if (row.outcome === "acted_on") actedOn += 1
    else if (row.outcome === "dismissed") dismissed += 1
    else if (row.outcome === "snoozed") snoozed += 1
    else if (row.outcome === "drafted_followup") drafted += 1
  }
  return { actedOn, dismissed, snoozed, drafted }
}

/**
 * Returns the cron-side permissions used when building the digest.
 * Always treats the digest builder as an "owner" so deterministic
 * recommendations are not filtered out for the email recipient. The
 * recipient still only sees a digest if the organization has
 * explicitly enabled the digest and configured recipients.
 */
export function digestSystemPermissions(): OrgPermissions {
  return getOrgPermissionsForRole("owner")
}
