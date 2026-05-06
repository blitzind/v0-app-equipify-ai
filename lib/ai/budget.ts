import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { aiDebugLog } from "@/lib/ai/ai-debug"
import { getAiEnvConfig } from "@/lib/ai/config"
import { createAiAlert } from "@/lib/ai/alerts/create-ai-alert"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type AiBudgetEnforcementMode = "warn" | "block"

export type OrganizationAiBudgetRow = {
  aiMonthlyBudgetCents: number | null
  aiBudgetEnforcementMode: AiBudgetEnforcementMode
}

function tryServiceRole() {
  try {
    return createServiceRoleSupabaseClient()
  } catch {
    return null
  }
}

function monthStartUtcIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString()
}

function todayStartUtcIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)).toISOString()
}

/**
 * Month-to-date sum of `estimated_cost` (USD) for an organization. Uses service role for router checks.
 */
export async function getOrganizationMtdEstimatedCostUsd(organizationId: string): Promise<number> {
  if (!UUID_RE.test(organizationId)) return 0
  const svc = tryServiceRole()
  if (!svc) return 0

  const since = monthStartUtcIso()
  let total = 0
  const pageSize = 1000
  let offset = 0
  for (;;) {
    const { data, error } = await svc
      .from("ai_usage_logs")
      .select("estimated_cost")
      .eq("organization_id", organizationId)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error || !data?.length) break
    for (const row of data) {
      const v = row.estimated_cost
      total += typeof v === "number" ? v : Number(v)
    }
    if (data.length < pageSize) break
    offset += pageSize
  }
  return total
}

export async function fetchOrganizationAiBudgetSettings(
  organizationId: string,
): Promise<OrganizationAiBudgetRow | null> {
  if (!UUID_RE.test(organizationId)) return null
  const svc = tryServiceRole()
  if (!svc) return null

  const { data, error } = await svc
    .from("organizations")
    .select("ai_monthly_budget_cents, ai_budget_enforcement_mode")
    .eq("id", organizationId)
    .maybeSingle()

  if (error || !data) return null

  const cents = data.ai_monthly_budget_cents
  const modeRaw = data.ai_budget_enforcement_mode
  const mode: AiBudgetEnforcementMode = modeRaw === "block" ? "block" : "warn"

  return {
    aiMonthlyBudgetCents: cents == null ? null : Number(cents),
    aiBudgetEnforcementMode: mode,
  }
}

export type AiBudgetPrecheckResult =
  | { action: "allow" }
  | { action: "warn"; mtdCostCents: number; budgetCents: number }
  | { action: "block"; mtdCostCents: number; budgetCents: number; message: string }

/**
 * Returns whether an AI call should proceed given organization MTD spend vs monthly budget (cents).
 * Null budget => unlimited.
 */
export async function precheckOrganizationAiBudget(organizationId: string): Promise<AiBudgetPrecheckResult> {
  if (!UUID_RE.test(organizationId)) {
    return { action: "allow" }
  }

  const svc = tryServiceRole()
  if (!svc) {
    return { action: "allow" }
  }

  const settings = await fetchOrganizationAiBudgetSettings(organizationId)
  const budgetCents = settings?.aiMonthlyBudgetCents ?? null
  /** Null = unlimited. Zero is a valid cap (block / warn on any spend). */
  if (budgetCents == null) {
    return { action: "allow" }
  }

  const mtdUsd = await getOrganizationMtdEstimatedCostUsd(organizationId)
  const mtdCents = Math.round(mtdUsd * 100)
  const nearLimitThreshold = Math.floor(budgetCents * 0.8)

  if (budgetCents > 0 && mtdCents >= nearLimitThreshold && mtdCents < budgetCents) {
    await createAiAlert({
      organizationId,
      alertType: "monthly_budget_near_limit",
      severity: "warning",
      title: "AI monthly budget near limit",
      message: `Workspace AI usage reached ${Math.round((mtdCents / budgetCents) * 100)}% of its monthly budget.`,
      metadata: {
        threshold: nearLimitThreshold,
        count: mtdCents,
      },
      dedupeWindowMinutes: 360,
    })
  }

  if (mtdCents < budgetCents) {
    return { action: "allow" }
  }

  const mode = settings?.aiBudgetEnforcementMode ?? "warn"
  await createAiAlert({
    organizationId,
    alertType: "monthly_budget_exceeded",
    severity: mode === "block" ? "critical" : "warning",
    title: "AI monthly budget exceeded",
    message:
      mode === "block"
        ? "Workspace AI usage exceeded its monthly budget and requests are blocked."
        : "Workspace AI usage exceeded its monthly budget (warn mode).",
    metadata: {
      threshold: budgetCents,
      count: mtdCents,
    },
    dedupeWindowMinutes: 180,
  })
  const message =
    "This workspace has reached its monthly AI usage budget. Ask an owner or admin to raise the cap under Settings → AI Usage, or wait until next month."

  if (mode === "warn") {
    aiDebugLog("ai_budget_warn", {
      organizationId,
      mtdCostCents: mtdCents,
      budgetCents,
    })
    if (getAiEnvConfig().debug) {
      console.warn("[ai-budget] Monthly AI budget exceeded (warn mode — allowing request)", {
        organizationId,
        mtdCostCents: mtdCents,
        budgetCents,
      })
    }
    return { action: "warn", mtdCostCents: mtdCents, budgetCents }
  }

  return {
    action: "block",
    mtdCostCents: mtdCents,
    budgetCents,
    message,
  }
}
