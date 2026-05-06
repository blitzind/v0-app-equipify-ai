import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin"
import { shouldLogCacheHitsToUsage } from "@/lib/ai/result-cache"
import { normalizePlanIdForRead } from "@/lib/billing/plan-id"
import type { PlanId } from "@/lib/plans"
import { planTierDisplayName } from "@/lib/ai/plan-gate"
import { createAiAlert } from "@/lib/ai/alerts/create-ai-alert"

const PLAN_GATE_FAILURE_REASONS = new Set(["plan_tier", "plan_request_limit", "plan_cost_limit"])

export const runtime = "nodejs"

const PAGE_SIZE = 1000

function utcMonthBounds(y: number, monthIndex0: number): { startIso: string; endIso: string; label: string } {
  const start = new Date(Date.UTC(y, monthIndex0, 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(y, monthIndex0 + 1, 1, 0, 0, 0, 0))
  const label = `${y}-${String(monthIndex0 + 1).padStart(2, "0")}`
  return { startIso: start.toISOString(), endIso: end.toISOString(), label }
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

type AggRow = {
  id: string
  estimated_cost: number | string | null
  success: boolean | null
  budget_blocked: boolean | null
  cache_hit: boolean | null
  organization_id: string
  task: string | null
  provider: string | null
  model: string | null
  failure_reason: string | null
}

function promptFieldsFromUsageMetadata(metadata: unknown): {
  prompt_id: string | null
  prompt_version: number | null
  schema_version: string | null
} {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { prompt_id: null, prompt_version: null, schema_version: null }
  }
  const m = metadata as Record<string, unknown>
  return {
    prompt_id: typeof m.promptId === "string" ? m.promptId : null,
    prompt_version: typeof m.promptVersion === "number" ? m.promptVersion : null,
    schema_version: typeof m.schemaVersion === "string" ? m.schemaVersion : null,
  }
}

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
    return NextResponse.json(
      { error: "server_config", message: "Server is not configured for platform admin operations." },
      { status: 503 },
    )
  }

  const url = new URL(request.url)
  const { y, m0 } = parseMonthParam(url.searchParams.get("month"))
  const { startIso, endIso, label } = utcMonthBounds(y, m0)

  const organizationId = url.searchParams.get("organizationId")?.trim() || ""
  const task = url.searchParams.get("task")?.trim() || ""
  const successFilter = url.searchParams.get("success")?.trim() ?? ""
  const provider = url.searchParams.get("provider")?.trim() || ""
  const model = url.searchParams.get("model")?.trim() || ""
  const logLimit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "120", 10) || 120, 10), 300)

  function applyUsageFilters(q: unknown) {
    let out = q as {
      eq: (column: string, value: string | boolean) => typeof out
    }
    if (organizationId) out = out.eq("organization_id", organizationId)
    if (task) out = out.eq("task", task)
    if (provider) out = out.eq("provider", provider)
    if (model) out = out.eq("model", model)
    if (successFilter === "true") out = out.eq("success", true)
    if (successFilter === "false") out = out.eq("success", false)
    return out
  }

  const { data: subsRows } = await admin.from("organization_subscriptions").select("organization_id, plan_id")
  const orgPlanById = new Map<string, PlanId>()
  for (const row of subsRows ?? []) {
    const oid = (row as { organization_id?: string }).organization_id
    const pid = (row as { plan_id?: string | null }).plan_id
    if (oid) orgPlanById.set(oid, normalizePlanIdForRead(pid ?? "solo"))
  }

  let totalCost = 0
  let totalRequests = 0
  let failedRequests = 0
  let budgetBlockedRequests = 0
  let planBlockedRequests = 0
  let cacheHitsLogged = 0
  const tierCost = new Map<PlanId, number>()
  const taskCost = new Map<string, number>()
  const orgCost = new Map<string, number>()
  const hintTasks = new Set<string>()
  const hintProviders = new Set<string>()
  const hintModels = new Set<string>()

  let offset = 0
  for (;;) {
    let q = admin
      .from("ai_usage_logs")
      .select(
        "id, estimated_cost, success, budget_blocked, cache_hit, organization_id, task, provider, model, failure_reason",
      )
      .gte("created_at", startIso)
      .lt("created_at", endIso)

    q = applyUsageFilters(q)

    const { data, error } = await q
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 })
    }

    const rows = (data ?? []) as AggRow[]
    if (rows.length === 0) break

    for (const r of rows) {
      totalRequests++
      const cost =
        typeof r.estimated_cost === "number"
          ? r.estimated_cost
          : typeof r.estimated_cost === "string"
            ? Number.parseFloat(r.estimated_cost)
            : 0
      const c = Number.isFinite(cost) ? cost : 0
      totalCost += c

      const taskId = r.task ?? ""
      if (taskId) {
        taskCost.set(taskId, (taskCost.get(taskId) ?? 0) + c)
        if (hintTasks.size < 80) hintTasks.add(taskId)
      }
      const oid = r.organization_id
      orgCost.set(oid, (orgCost.get(oid) ?? 0) + c)
      const tier = orgPlanById.get(oid) ?? "solo"
      tierCost.set(tier, (tierCost.get(tier) ?? 0) + c)
      if (r.provider && hintProviders.size < 80) hintProviders.add(r.provider)
      if (r.model && hintModels.size < 80) hintModels.add(r.model)

      if (r.budget_blocked === true) budgetBlockedRequests++
      else if (r.success === false) failedRequests++

      const fr =
        typeof r.failure_reason === "string" && r.failure_reason.trim()
          ? r.failure_reason.trim()
          : null
      if (fr && PLAN_GATE_FAILURE_REASONS.has(fr)) planBlockedRequests++

      if (r.cache_hit === true) cacheHitsLogged++
    }

    if (rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
    if (offset > 500_000) break
  }

  const topTasksByCost = [...taskCost.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t, estimated_cost_usd]) => ({ task: t, estimated_cost_usd }))

  const topOrgIds = [...orgCost.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)

  let orgNames = new Map<string, string | null>()
  if (topOrgIds.length > 0) {
    const { data: orgRows } = await admin.from("organizations").select("id, name").in("id", topOrgIds)
    orgNames = new Map((orgRows ?? []).map((o) => [o.id as string, (o.name as string) ?? null]))
  }

  const topOrganizationsByCost = [...orgCost.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([organization_id, estimated_cost_usd]) => ({
      organization_id,
      name: orgNames.get(organization_id) ?? null,
      plan_id: orgPlanById.get(organization_id) ?? "solo",
      plan_label: planTierDisplayName(orgPlanById.get(organization_id) ?? "solo"),
      estimated_cost_usd,
    }))

  const usageByPlanTier = (["solo", "core", "growth", "scale"] as const)
    .map((pid) => ({
      plan_id: pid,
      plan_label: planTierDisplayName(pid),
      estimated_cost_usd: tierCost.get(pid) ?? 0,
    }))
    .filter((row) => row.estimated_cost_usd > 0)
    .sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd)

  let recentQ = admin
    .from("ai_usage_logs")
    .select(
      "id, created_at, organization_id, task, provider, model, prompt_tokens, completion_tokens, estimated_cost, duration_ms, success, failure_reason, cache_hit, budget_blocked, metadata",
    )
    .gte("created_at", startIso)
    .lt("created_at", endIso)

  recentQ = applyUsageFilters(recentQ)

  const { data: recentData, error: recentErr } = await recentQ
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(logLimit)

  if (recentErr) {
    return NextResponse.json({ error: "recent_failed", message: recentErr.message }, { status: 500 })
  }

  const recentRows = recentData ?? []
  const recentOrgIds = [...new Set(recentRows.map((r) => r.organization_id as string))]
  let recentOrgNames = new Map<string, string | null>()
  if (recentOrgIds.length > 0) {
    const { data: orgRows } = await admin.from("organizations").select("id, name").in("id", recentOrgIds)
    recentOrgNames = new Map((orgRows ?? []).map((o) => [o.id as string, (o.name as string) ?? null]))
  }

  const cacheHitsNote = shouldLogCacheHitsToUsage()
    ? undefined
    : "Cache hits are not duplicated into ai_usage_logs when AI_LOG_CACHE_HITS_TO_USAGE is false; see ai_cache.hit_count for reuse totals."

  let jobsQ = admin
    .from("ai_jobs")
    .select(
      "id, organization_id, task, status, created_at, started_at, completed_at, error_message, progress_percent, current_step, source_type, source_id",
    )
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: false })
    .limit(40)

  if (organizationId) {
    jobsQ = jobsQ.eq("organization_id", organizationId)
  }

  const { data: recentJobRows, error: jobsErr } = await jobsQ

  if (jobsErr) {
    console.error("[ai-operations] ai_jobs query:", jobsErr.message)
  }

  const jobOrgIds = [...new Set((recentJobRows ?? []).map((r) => r.organization_id as string))]
  let jobOrgNames = new Map<string, string | null>()
  if (jobOrgIds.length > 0) {
    const { data: jobOrgRows } = await admin.from("organizations").select("id, name").in("id", jobOrgIds)
    jobOrgNames = new Map((jobOrgRows ?? []).map((o) => [o.id as string, (o.name as string) ?? null]))
  }

  const recentAiJobs = (jobsErr ? [] : recentJobRows ?? []).map((r) => {
    const started = r.started_at ? new Date(r.started_at as string).getTime() : null
    const completed = r.completed_at ? new Date(r.completed_at as string).getTime() : null
    const durationMs =
      started != null && completed != null && completed >= started ? completed - started : null
    return {
      id: r.id as string,
      organization_id: r.organization_id as string,
      organization_name: jobOrgNames.get(r.organization_id as string) ?? null,
      task: r.task as string,
      status: r.status as string,
      created_at: r.created_at as string,
      started_at: r.started_at as string | null,
      completed_at: r.completed_at as string | null,
      duration_ms: durationMs,
      error_message: typeof r.error_message === "string" ? r.error_message : null,
      progress_percent:
        typeof r.progress_percent === "number"
          ? r.progress_percent
          : Number(r.progress_percent ?? 0),
      current_step: typeof r.current_step === "string" ? r.current_step : null,
      source_type: typeof r.source_type === "string" ? r.source_type : null,
      source_id: typeof r.source_id === "string" ? r.source_id : null,
    }
  })

  const stuckThresholdMs = 30 * 60 * 1000
  const nowMs = Date.now()
  for (const j of recentAiJobs) {
    if (j.status !== "processing" || !j.started_at) continue
    const startedMs = new Date(j.started_at).getTime()
    if (!Number.isFinite(startedMs)) continue
    const ageMs = nowMs - startedMs
    if (ageMs < stuckThresholdMs) continue
    await createAiAlert({
      organizationId: j.organization_id,
      alertType: "job_stuck_processing",
      severity: "warning",
      title: "AI job stuck in processing",
      message: `AI job "${j.id}" has been processing for over 30 minutes.`,
      metadata: {
        jobId: j.id,
        task: j.task,
        sourceType: "ai_job",
        sourceId: j.id,
        durationMs: ageMs,
        threshold: stuckThresholdMs,
      },
      dedupeWindowMinutes: 30,
    })
  }

  const recentLogs = recentRows.map((r) => {
    const promptMeta = promptFieldsFromUsageMetadata(
      (r as { metadata?: unknown }).metadata,
    )
    return {
      id: r.id as string,
      created_at: r.created_at as string,
      organization_id: r.organization_id as string,
      organization_name: recentOrgNames.get(r.organization_id as string) ?? null,
      organization_plan_id: orgPlanById.get(r.organization_id as string) ?? "solo",
      organization_plan_label: planTierDisplayName(orgPlanById.get(r.organization_id as string) ?? "solo"),
      task: r.task as string,
      provider: r.provider as string,
      model: r.model as string,
      prompt_tokens: typeof r.prompt_tokens === "number" ? r.prompt_tokens : 0,
      completion_tokens: typeof r.completion_tokens === "number" ? r.completion_tokens : 0,
      estimated_cost: typeof r.estimated_cost === "number" ? r.estimated_cost : Number(r.estimated_cost ?? 0),
      duration_ms: typeof r.duration_ms === "number" ? r.duration_ms : 0,
      success: Boolean(r.success),
      failure_reason: typeof r.failure_reason === "string" ? r.failure_reason : null,
      cache_hit: Boolean(r.cache_hit),
      budget_blocked: Boolean(r.budget_blocked),
      ...promptMeta,
    }
  })

  const { data: openAlertsRows } = await admin
    .from("ai_alerts")
    .select("id, organization_id, alert_type, severity, title, status, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(50)

  const alertOrgIds = [...new Set((openAlertsRows ?? []).map((r) => (r.organization_id as string | null) ?? ""))]
    .filter(Boolean) as string[]
  let alertOrgNames = new Map<string, string | null>()
  if (alertOrgIds.length > 0) {
    const { data: orgRows } = await admin.from("organizations").select("id, name").in("id", alertOrgIds)
    alertOrgNames = new Map((orgRows ?? []).map((o) => [o.id as string, (o.name as string) ?? null]))
  }
  const openAlerts = (openAlertsRows ?? []).map((r) => ({
    id: r.id as string,
    organization_id: (r.organization_id as string | null) ?? null,
    organization_name:
      r.organization_id != null ? alertOrgNames.get(r.organization_id as string) ?? null : null,
    alert_type: r.alert_type as string,
    severity: r.severity as "info" | "warning" | "critical",
    title: r.title as string,
    status: r.status as "open" | "acknowledged" | "resolved",
    created_at: r.created_at as string,
  }))

  return NextResponse.json({
    month: label,
    range: { start: startIso, end: endIso },
    summary: {
      totalEstimatedCostUsd: Math.round(totalCost * 1_000_000) / 1_000_000,
      totalRequests,
      failedRequests,
      budgetBlockedRequests,
      planBlockedRequests,
      cacheHitsLogged,
      cacheHitsNote,
    },
    topTasksByCost,
    topOrganizationsByCost,
    usageByPlanTier,
    recentLogs,
    recentAiJobs,
    alerts: {
      openCount: openAlerts.length,
      recentOpenAlerts: openAlerts,
    },
    filterHints: {
      tasks: [...hintTasks].sort(),
      providers: [...hintProviders].sort(),
      models: [...hintModels].sort(),
    },
  })
}
