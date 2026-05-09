import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"

export const runtime = "nodejs"

function utcMonthBounds(y: number, monthIndex0: number): { startIso: string; endIso: string } {
  const start = new Date(Date.UTC(y, monthIndex0, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(y, monthIndex0 + 1, 1, 0, 0, 0, 0))
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

function parseMonthParam(raw: string | null): { y: number; m0: number } {
  if (!raw?.trim()) {
    const d = new Date()
    return { y: d.getUTCFullYear(), m0: d.getUTCMonth() }
  }
  const p = raw.trim().split("-")
  if (p.length < 2) {
    const d = new Date()
    return { y: d.getUTCFullYear(), m0: d.getUTCMonth() }
  }
  const y = Number.parseInt(p[0]!, 10)
  const mo = Number.parseInt(p[1]!, 10)
  const m0 = mo - 1
  if (!Number.isFinite(y) || m0 < 0 || m0 > 11) {
    const d = new Date()
    return { y: d.getUTCFullYear(), m0: d.getUTCMonth() }
  }
  return { y, m0 }
}

type UsageAgg = {
  requests: number
  promptTokens: number
  completionTokens: number
  estimatedCostUsd: number
}

/**
 * Platform-admin AI profitability snapshot — internal margin visibility only (no tenant exposure).
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || !isPlatformAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden", message: "Platform admin access required." }, { status: 403 })
  }

  let admin: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return NextResponse.json({ error: "server_config", message: "Service role unavailable." }, { status: 503 })
  }

  const url = new URL(request.url)
  const { y, m0 } = parseMonthParam(url.searchParams.get("month"))
  const { startIso, endIso } = utcMonthBounds(y, m0)

  const PAGE = 800
  let offset = 0
  let mockRequests = 0
  let liveRequests = 0
  let mockTokens = 0
  let liveTokens = 0
  let mockCostUsd = 0
  let liveCostUsd = 0
  const byProvider = new Map<string, UsageAgg>()
  const byTask = new Map<string, UsageAgg>()
  const orgSpend = new Map<string, number>()

  for (;;) {
    const { data, error } = await admin
      .from("ai_usage_logs")
      .select(
        "organization_id, task, provider, model, prompt_tokens, completion_tokens, estimated_cost, metadata",
      )
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE - 1)

    if (error) {
      return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 })
    }
    const rows = data ?? []
    if (rows.length === 0) break

    for (const raw of rows) {
      const row = raw as {
        organization_id?: string
        task?: string | null
        provider?: string | null
        model?: string | null
        prompt_tokens?: number | null
        completion_tokens?: number | null
        estimated_cost?: number | null
        metadata?: Record<string, unknown> | null
      }
      const oid = row.organization_id ?? ""
      const pt = typeof row.prompt_tokens === "number" ? row.prompt_tokens : 0
      const ct = typeof row.completion_tokens === "number" ? row.completion_tokens : 0
      const tokens = pt + ct
      const cost = typeof row.estimated_cost === "number" ? row.estimated_cost : 0
      const provider = row.provider ?? "unknown"
      const task = row.task ?? "unknown"
      const mode =
        provider === "mock" ||
        (typeof row.metadata === "object" &&
          row.metadata &&
          (row.metadata as { execution_mode?: string }).execution_mode === "mock_trial")
          ? "mock"
          : "live"

      if (mode === "mock") {
        mockRequests++
        mockTokens += tokens
        mockCostUsd += cost
      } else {
        liveRequests++
        liveTokens += tokens
        liveCostUsd += cost
      }

      const pk = `${provider}:${row.model ?? ""}`
      const pa = byProvider.get(pk) ?? { requests: 0, promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 }
      pa.requests++
      pa.promptTokens += pt
      pa.completionTokens += ct
      pa.estimatedCostUsd += cost
      byProvider.set(pk, pa)

      const ta = byTask.get(task) ?? { requests: 0, promptTokens: 0, completionTokens: 0, estimatedCostUsd: 0 }
      ta.requests++
      ta.promptTokens += pt
      ta.completionTokens += ct
      ta.estimatedCostUsd += cost
      byTask.set(task, ta)

      orgSpend.set(oid, (orgSpend.get(oid) ?? 0) + cost)
    }

    if (rows.length < PAGE) break
    offset += PAGE
  }

  const topOrgs = [...orgSpend.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([organizationId, estimatedCostUsd]) => ({ organizationId, estimatedCostUsd }))

  const totalRequests = mockRequests + liveRequests
  const totalTokens = mockTokens + liveTokens
  const totalCostUsd = mockCostUsd + liveCostUsd

  return NextResponse.json({
    ok: true,
    month: `${y}-${String(m0 + 1).padStart(2, "0")}`,
    window: { startIso, endIso },
    totals: {
      requests: totalRequests,
      tokensApprox: totalTokens,
      estimatedProviderCostUsd: totalCostUsd,
      mockShareRequests: totalRequests ? mockRequests / totalRequests : 0,
      liveShareRequests: totalRequests ? liveRequests / totalRequests : 0,
    },
    split: {
      mockTrial: {
        requests: mockRequests,
        tokensApprox: mockTokens,
        estimatedCostUsd: mockCostUsd,
      },
      livePaid: {
        requests: liveRequests,
        tokensApprox: liveTokens,
        estimatedCostUsd: liveCostUsd,
      },
    },
    /** Rough revenue placeholder — margin requires billing integration; kept internal-only. */
    marginHint:
      "Compare estimated_provider_cost from ai_usage_logs to Stripe net revenue outside this API (internal finance).",
    byProvider: Object.fromEntries(byProvider.entries()),
    byTask: Object.fromEntries(byTask.entries()),
    topOrganizationsByEstimatedCost: topOrgs,
  })
}
