import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { fetchOrganizationAiBudgetSettings, getOrganizationMtdEstimatedCostUsd } from "@/lib/ai/budget"
import {
  fetchOrganizationAiCacheOverview,
  shouldLogCacheHitsToUsage,
} from "@/lib/ai/result-cache"
import { fetchAidenUsageCountsMtd } from "@/lib/aiden/usage-events"
import { computeAiUsageSummary, fetchRecentAiUsageLogs } from "@/lib/ai/usage-summary"
import { isPlanGatingDisabled, PLAN_AI_INCLUDED_MONTHLY_BUDGET_USD } from "@/lib/ai/plan-ai-config"
import {
  fetchOrganizationPlanId,
  isTaskAllowedOnPlan,
  planTierDisplayName,
} from "@/lib/ai/plan-gate"
import { getTaskDefinition } from "@/lib/ai/tasks"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BUDGET_ROLES = new Set(["owner", "admin", "manager"])

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: code, message }, { status })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return jsonError("invalid_organization", "Invalid organization.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return jsonError("unauthorized", "Sign in required.", 401)
  }

  const platformAdmin = isPlatformAdminEmail(user.email)

  if (!platformAdmin) {
    const { data: mem } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    if (!mem) {
      return jsonError("forbidden", "You are not a member of this organization.", 403)
    }
  }

  let db = supabase as Parameters<typeof computeAiUsageSummary>[0]
  if (platformAdmin) {
    try {
      db = createServiceRoleSupabaseClient()
    } catch {
      /* fall through to member client */
    }
  }

  const summary = await computeAiUsageSummary(db, organizationId)
  const recent = await fetchRecentAiUsageLogs(db, organizationId, 50)

  const { data: orgRow } = await db
    .from("organizations")
    .select("ai_monthly_budget_cents, ai_budget_enforcement_mode")
    .eq("id", organizationId)
    .maybeSingle()

  const centsRaw = orgRow?.ai_monthly_budget_cents as number | null | undefined
  const aiMonthlyBudgetCents =
    centsRaw == null ? null : Math.max(0, Math.floor(Number(centsRaw)))
  const modeRaw = orgRow?.ai_budget_enforcement_mode
  const aiBudgetEnforcementMode = modeRaw === "block" ? "block" : "warn"

  let mtdEstimatedCostUsd = summary.estimatedCostMonthToDateUsd
  try {
    mtdEstimatedCostUsd = await getOrganizationMtdEstimatedCostUsd(organizationId)
  } catch {
    /* keep summary-based mtd */
  }

  let canEditBudget = platformAdmin
  if (!platformAdmin) {
    const { data: roleRow } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    canEditBudget = Boolean(roleRow?.role && BUDGET_ROLES.has(roleRow.role as string))
  }

  const cacheOverview = await fetchOrganizationAiCacheOverview(organizationId)
  const aidenUsageMonth = await fetchAidenUsageCountsMtd(db, organizationId)

  const planId = await fetchOrganizationPlanId(organizationId)
  const includedUsd = PLAN_AI_INCLUDED_MONTHLY_BUDGET_USD[planId] ?? 0
  const taskIds = [
    "aiden_help",
    "catalog_extraction",
    "certificate_cleanup",
    "workflow_builder",
    "maintenance_prediction",
    "work_order_summary",
    "customer_email",
    "OCR_cleanup",
  ] as const
  const features = taskIds.map((id) => {
    const def = getTaskDefinition(id)
    return {
      taskId: id,
      label: def.label,
      allowed: isTaskAllowedOnPlan(def, planId),
    }
  })

  return NextResponse.json({
    summary,
    planAi: {
      planId,
      planLabel: planTierDisplayName(planId),
      includedMonthlyBudgetUsd: includedUsd,
      planGatingDisabled: isPlanGatingDisabled(),
      features,
      catalogExtractionAllowed: isTaskAllowedOnPlan(getTaskDefinition("catalog_extraction"), planId),
      certificateCleanupAllowed: isTaskAllowedOnPlan(getTaskDefinition("certificate_cleanup"), planId),
    },
    budget: {
      aiMonthlyBudgetCents,
      aiBudgetEnforcementMode,
      mtdEstimatedCostUsd,
    },
    recent,
    canEditBudget,
    cache: {
      ...cacheOverview,
      /** When false, cache-hit rows are not inserted into ai_usage_logs (hit_count on ai_cache still updates). */
      logCacheHitsToUsage: shouldLogCacheHitsToUsage(),
      /** Month-to-date estimated spend excludes provider tokens on cache hits (those rows use estimated_cost = 0). */
      note:
        "Summaries sum estimated_cost from ai_usage_logs; cache-hit log rows are $0 and do not increase estimated AI spend.",
    },
    /** UTC month-to-date counts from aiden_usage_events (distinct from provider token logs). */
    aidenUsageMonth,
  })
}

type PatchBody = {
  aiMonthlyBudgetDollars?: number | string | null
  aiBudgetEnforcementMode?: "warn" | "block"
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return jsonError("invalid_organization", "Invalid organization.", 400)
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return jsonError("invalid_json", "Invalid request body.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return jsonError("unauthorized", "Sign in required.", 401)
  }

  const platformAdmin = isPlatformAdminEmail(user.email)

  if (!platformAdmin) {
    const { data: mem } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()
    if (!mem || !BUDGET_ROLES.has(mem.role as string)) {
      return jsonError("forbidden", "Only owners, admins, and managers can update AI budget settings.", 403)
    }
  }

  const patch: Record<string, unknown> = {}

  if (body.aiMonthlyBudgetDollars !== undefined) {
    if (
      body.aiMonthlyBudgetDollars === null ||
      (typeof body.aiMonthlyBudgetDollars === "string" && body.aiMonthlyBudgetDollars.trim() === "")
    ) {
      patch.ai_monthly_budget_cents = null
    } else {
      const raw = body.aiMonthlyBudgetDollars
      const n = typeof raw === "string" ? parseFloat(raw) : Number(raw)
      if (!Number.isFinite(n) || n < 0) {
        return jsonError("invalid_budget", "Budget must be a non-negative number (USD) or empty for unlimited.", 400)
      }
      patch.ai_monthly_budget_cents = Math.round(n * 100)
    }
  }

  if (body.aiBudgetEnforcementMode !== undefined) {
    const m = body.aiBudgetEnforcementMode
    if (m !== "warn" && m !== "block") {
      return jsonError("invalid_mode", "Enforcement mode must be warn or block.", 400)
    }
    patch.ai_budget_enforcement_mode = m
  }

  if (Object.keys(patch).length === 0) {
    return jsonError("empty_patch", "No budget fields to update.", 400)
  }

  let svc
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return jsonError("service_unavailable", "Server configuration error.", 503)
  }

  const { error: upErr } = await svc.from("organizations").update(patch).eq("id", organizationId)

  if (upErr) {
    return jsonError("update_failed", upErr.message, 400)
  }

  const settings = await fetchOrganizationAiBudgetSettings(organizationId)
  const mtdEstimatedCostUsd = await getOrganizationMtdEstimatedCostUsd(organizationId)

  return NextResponse.json({
    ok: true,
    budget: {
      aiMonthlyBudgetCents: settings?.aiMonthlyBudgetCents ?? null,
      aiBudgetEnforcementMode: settings?.aiBudgetEnforcementMode ?? "warn",
      mtdEstimatedCostUsd,
    },
  })
}
