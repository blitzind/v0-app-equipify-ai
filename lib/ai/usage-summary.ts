import "server-only"

/**
 * Aggregates `ai_usage_logs.estimated_cost` and tokens.
 * Rows from cache hits use estimated_cost = 0 (when AI_LOG_CACHE_HITS_TO_USAGE is enabled); those rows do not inflate spend totals.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export type AiUsageBreakdownRow = {
  estimatedCostUsd: number
  promptTokens: number
  completionTokens: number
}

export type AiUsageSummary = {
  estimatedCostTodayUsd: number
  estimatedCostMonthToDateUsd: number
  promptTokensToday: number
  completionTokensToday: number
  promptTokensMonth: number
  completionTokensMonth: number
  byTask: Record<string, AiUsageBreakdownRow>
  byProviderModel: Record<string, AiUsageBreakdownRow>
}

export type AiUsageLogRow = {
  id: string
  created_at: string
  task: string
  provider: string
  model: string
  prompt_tokens: number
  completion_tokens: number
  estimated_cost: number
  success: boolean
}

function num(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function emptyBreakdown(): AiUsageBreakdownRow {
  return { estimatedCostUsd: 0, promptTokens: 0, completionTokens: 0 }
}

function addToBreakdown(
  map: Record<string, AiUsageBreakdownRow>,
  key: string,
  cost: number,
  pt: number,
  ct: number,
) {
  if (!map[key]) map[key] = emptyBreakdown()
  map[key].estimatedCostUsd += cost
  map[key].promptTokens += pt
  map[key].completionTokens += ct
}

/**
 * Aggregates `ai_usage_logs` for an organization (member-scoped client — RLS applies).
 * Paginates month rows to avoid truncated totals for busy orgs.
 */
export async function computeAiUsageSummary(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<AiUsageSummary> {
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()
  const todayStart = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()),
  ).toISOString()

  const summary: AiUsageSummary = {
    estimatedCostTodayUsd: 0,
    estimatedCostMonthToDateUsd: 0,
    promptTokensToday: 0,
    completionTokensToday: 0,
    promptTokensMonth: 0,
    completionTokensMonth: 0,
    byTask: {},
    byProviderModel: {},
  }

  const pageSize = 1000
  let offset = 0
  for (;;) {
    const { data, error } = await supabase
      .from("ai_usage_logs")
      .select(
        "created_at, estimated_cost, prompt_tokens, completion_tokens, task, provider, model",
      )
      .eq("organization_id", organizationId)
      .gte("created_at", monthStart)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error || !data?.length) break

    for (const row of data) {
      const created = String(row.created_at ?? "")
      const cost = num(row.estimated_cost)
      const pt = Math.max(0, Math.floor(num(row.prompt_tokens)))
      const ct = Math.max(0, Math.floor(num(row.completion_tokens)))
      const task = String(row.task ?? "unknown")
      const provider = String(row.provider ?? "unknown")
      const model = String(row.model ?? "")
      const pmKey = `${provider}:${model}`

      summary.estimatedCostMonthToDateUsd += cost
      summary.promptTokensMonth += pt
      summary.completionTokensMonth += ct

      addToBreakdown(summary.byTask, task, cost, pt, ct)
      addToBreakdown(summary.byProviderModel, pmKey, cost, pt, ct)

      if (created >= todayStart) {
        summary.estimatedCostTodayUsd += cost
        summary.promptTokensToday += pt
        summary.completionTokensToday += ct
      }
    }

    if (data.length < pageSize) break
    offset += pageSize
  }

  summary.estimatedCostMonthToDateUsd = Math.round(summary.estimatedCostMonthToDateUsd * 1_000_000) / 1_000_000
  summary.estimatedCostTodayUsd = Math.round(summary.estimatedCostTodayUsd * 1_000_000) / 1_000_000

  return summary
}

export type AiUsageMockLiveSplit = {
  mockTrial: { aiTokens: number; estimatedCostUsd: number; requests: number }
  live: { aiTokens: number; estimatedCostUsd: number; requests: number }
}

/** Month-to-date split between simulated trial rows (`provider = mock`) and live provider calls. */
export async function computeAiUsageMockLiveSplit(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<AiUsageMockLiveSplit> {
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()
  const split: AiUsageMockLiveSplit = {
    mockTrial: { aiTokens: 0, estimatedCostUsd: 0, requests: 0 },
    live: { aiTokens: 0, estimatedCostUsd: 0, requests: 0 },
  }

  const pageSize = 1000
  let offset = 0
  for (;;) {
    const { data, error } = await supabase
      .from("ai_usage_logs")
      .select("estimated_cost, prompt_tokens, completion_tokens, provider")
      .eq("organization_id", organizationId)
      .gte("created_at", monthStart)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error || !data?.length) break

    for (const row of data) {
      const cost = num(row.estimated_cost)
      const pt = Math.max(0, Math.floor(num(row.prompt_tokens)))
      const ct = Math.max(0, Math.floor(num(row.completion_tokens)))
      const tokens = pt + ct
      const provider = String(row.provider ?? "")
      const bucket = provider === "mock" ? split.mockTrial : split.live
      bucket.aiTokens += tokens
      bucket.estimatedCostUsd += cost
      bucket.requests += 1
    }

    if (data.length < pageSize) break
    offset += pageSize
  }

  split.mockTrial.estimatedCostUsd = Math.round(split.mockTrial.estimatedCostUsd * 1_000_000) / 1_000_000
  split.live.estimatedCostUsd = Math.round(split.live.estimatedCostUsd * 1_000_000) / 1_000_000

  return split
}

export async function fetchRecentAiUsageLogs(
  supabase: SupabaseClient,
  organizationId: string,
  limit = 50,
): Promise<AiUsageLogRow[]> {
  const { data, error } = await supabase
    .from("ai_usage_logs")
    .select(
      "id, created_at, task, provider, model, prompt_tokens, completion_tokens, estimated_cost, success",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map((row) => ({
    id: String(row.id),
    created_at: String(row.created_at),
    task: String(row.task ?? ""),
    provider: String(row.provider ?? ""),
    model: String(row.model ?? ""),
    prompt_tokens: Math.max(0, Math.floor(num(row.prompt_tokens))),
    completion_tokens: Math.max(0, Math.floor(num(row.completion_tokens))),
    estimated_cost: num(row.estimated_cost),
    success: Boolean(row.success),
  }))
}
