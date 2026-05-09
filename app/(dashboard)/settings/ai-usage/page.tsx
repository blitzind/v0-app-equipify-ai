"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { AI_DISPLAY_TOKENS_PER_USD } from "@/lib/ai/display-tokens"

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 4 })

type AiUsageSummary = {
  estimatedCostTodayUsd: number
  estimatedCostMonthToDateUsd: number
  promptTokensToday: number
  completionTokensToday: number
  promptTokensMonth: number
  completionTokensMonth: number
  byTask: Record<string, { estimatedCostUsd: number; promptTokens: number; completionTokens: number }>
  byProviderModel: Record<string, { estimatedCostUsd: number; promptTokens: number; completionTokens: number }>
}

type AiLogRow = {
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

type AiCacheOverviewRow = {
  task: string
  hit_count: number
  last_hit_at: string | null
  expires_at: string | null
  updated_at: string
  storage_key: string
}

type PlanAiPayload = {
  planId: string
  planLabel: string
  includedMonthlyBudgetUsd: number
  includedAiTokensApprox?: number
  planGatingDisabled: boolean
  features: Array<{ taskId: string; label: string; allowed: boolean }>
  catalogExtractionAllowed: boolean
  certificateCleanupAllowed: boolean
}

type TenantAiUsagePayload = {
  aiTokensUsedMonth: number
  aiTokensUsedToday: number
  aiTokensIncludedApprox: number
  byTask: Record<string, { aiTokens: number }>
  aidenUsageMonth: { support_chat: number; feature_request: number }
}

type RecentTenantRow = {
  id: string
  created_at: string
  task: string
  ai_tokens: number
  ai_mode: "trial_preview" | "live"
  success: boolean
}

type MemberBudgetPayload = {
  aiMonthlyAiTokenBudgetApprox: number | null
  aiBudgetEnforcementMode: "warn" | "block"
  mtdAiTokensUsedApprox: number
}

type MockLiveSplitPayload = {
  mockTrial: { aiTokens: number; estimatedCostUsd: number; requests: number }
  live: { aiTokens: number; estimatedCostUsd: number; requests: number }
}

export default function AiUsageSettingsPage() {
  const { toast } = useToast()
  const { organizationId, status: orgStatus } = useActiveOrganization()

  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [summary, setSummary] = useState<AiUsageSummary | null>(null)
  const [budgetCents, setBudgetCents] = useState<number | null>(null)
  const [mtdUsd, setMtdUsd] = useState(0)
  const [enforcementMode, setEnforcementMode] = useState<"warn" | "block">("warn")
  const [recent, setRecent] = useState<AiLogRow[]>([])
  const [canEditBudget, setCanEditBudget] = useState(false)

  const [budgetInput, setBudgetInput] = useState("")
  const [modeInput, setModeInput] = useState<"warn" | "block">("warn")
  const [saving, setSaving] = useState(false)

  const [cacheRows, setCacheRows] = useState<
    Array<{
      task: string
      hit_count: number
      last_hit_at: string | null
      expires_at: string | null
      updated_at: string
      storage_key: string
    }>
  >([])
  const [cacheTotalHits, setCacheTotalHits] = useState(0)
  const [cacheLogHitsToUsage, setCacheLogHitsToUsage] = useState(true)
  const [cacheNote, setCacheNote] = useState<string | null>(null)
  const [planAi, setPlanAi] = useState<PlanAiPayload | null>(null)
  const [aidenUsageMonth, setAidenUsageMonth] = useState({ support_chat: 0, feature_request: 0 })
  const [viewerRole, setViewerRole] = useState<"member" | "platform_admin" | null>(null)
  const [tenantAiUsage, setTenantAiUsage] = useState<TenantAiUsagePayload | null>(null)
  const [recentTenant, setRecentTenant] = useState<RecentTenantRow[]>([])
  const [memberBudget, setMemberBudget] = useState<MemberBudgetPayload | null>(null)
  const [mockLiveSplit, setMockLiveSplit] = useState<MockLiveSplitPayload | null>(null)

  const load = useCallback(async () => {
    if (!organizationId) return
    setLoadState("loading")
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/ai-usage`, {
        cache: "no-store",
      })
      const data = (await res.json()) as {
        error?: string
        message?: string
        viewerRole?: "member" | "platform_admin"
        summary?: AiUsageSummary
        tenantAiUsage?: TenantAiUsagePayload
        mockLiveSplit?: MockLiveSplitPayload
        budget?:
          | {
              aiMonthlyBudgetCents: number | null
              aiBudgetEnforcementMode: "warn" | "block"
              mtdEstimatedCostUsd: number
            }
          | MemberBudgetPayload
        recent?: AiLogRow[]
        recentTenant?: RecentTenantRow[]
        canEditBudget?: boolean
        cache?: {
          rows?: AiCacheOverviewRow[]
          totalHits?: number
          logCacheHitsToUsage?: boolean
          note?: string
        }
        planAi?: PlanAiPayload
        aidenUsageMonth?: { support_chat: number; feature_request: number }
      }
      if (!res.ok) {
        throw new Error(data.message || data.error || "Could not load AI usage.")
      }
      const role = data.viewerRole === "platform_admin" ? "platform_admin" : "member"
      setViewerRole(role)
      setMockLiveSplit(data.mockLiveSplit ?? null)
      setTenantAiUsage(data.tenantAiUsage ?? null)
      setRecentTenant(data.recentTenant ?? [])
      if (role === "platform_admin") {
        if (!data.summary) throw new Error("Missing summary.")
        setSummary(data.summary)
        const b = data.budget as { aiMonthlyBudgetCents?: number | null; mtdEstimatedCostUsd?: number } | undefined
        setBudgetCents(b?.aiMonthlyBudgetCents ?? null)
        setMtdUsd(b?.mtdEstimatedCostUsd ?? data.summary.estimatedCostMonthToDateUsd)
        setMemberBudget(null)
        setRecent(data.recent ?? [])
      } else {
        if (!data.tenantAiUsage) throw new Error("Missing AI usage.")
        setSummary(null)
        const mb = data.budget as MemberBudgetPayload | undefined
        setMemberBudget(mb ?? null)
        setBudgetCents(null)
        setMtdUsd(0)
        setRecent([])
      }
      const m =
        (role === "platform_admin"
          ? (data.budget as { aiBudgetEnforcementMode?: string } | undefined)?.aiBudgetEnforcementMode
          : (data.budget as MemberBudgetPayload | undefined)?.aiBudgetEnforcementMode) === "block"
          ? "block"
          : "warn"
      setEnforcementMode(m)
      setModeInput(m)
      setBudgetInput(
        role === "platform_admin" &&
          data.budget &&
          "aiMonthlyBudgetCents" in data.budget &&
          data.budget.aiMonthlyBudgetCents != null
          ? (data.budget.aiMonthlyBudgetCents / 100).toFixed(2)
          : role === "member" && data.budget && "aiMonthlyAiTokenBudgetApprox" in data.budget
            ? data.budget.aiMonthlyAiTokenBudgetApprox != null
              ? String(Math.round(data.budget.aiMonthlyAiTokenBudgetApprox))
              : ""
            : "",
      )
      setCanEditBudget(Boolean(data.canEditBudget))
      setCacheRows(data.cache?.rows ?? [])
      setCacheTotalHits(data.cache?.totalHits ?? 0)
      setCacheLogHitsToUsage(data.cache?.logCacheHitsToUsage !== false)
      setCacheNote(typeof data.cache?.note === "string" ? data.cache.note : null)
      setPlanAi(data.planAi ?? null)
      setAidenUsageMonth(
        role === "member" && data.tenantAiUsage?.aidenUsageMonth
          ? data.tenantAiUsage.aidenUsageMonth
          : (data.aidenUsageMonth ?? { support_chat: 0, feature_request: 0 }),
      )
      setLoadState("ready")
    } catch (e) {
      setLoadState("error")
      toast({
        variant: "destructive",
        title: "Could not load AI usage",
        description: e instanceof Error ? e.message : "Unknown error.",
      })
    }
  }, [organizationId, toast])

  useEffect(() => {
    if (orgStatus !== "ready") return
    if (!organizationId) {
      setLoadState("idle")
      return
    }
    void load()
  }, [orgStatus, organizationId, load])

  async function handleSaveBudget() {
    if (!organizationId || !canEditBudget || saving) return
    setSaving(true)
    try {
      const trimmed = budgetInput.trim()
      const payload: {
        aiMonthlyBudgetDollars?: number | null
        aiBudgetEnforcementMode: "warn" | "block"
      } = {
        aiBudgetEnforcementMode: modeInput,
      }
      if (trimmed === "") {
        payload.aiMonthlyBudgetDollars = null
      } else {
        const n = parseFloat(trimmed)
        if (!Number.isFinite(n) || n < 0) {
          toast({
            variant: "destructive",
            title: "Invalid budget",
            description:
              viewerRole === "member"
                ? "Enter a non-negative AI token budget or leave blank for unlimited."
                : "Enter a non-negative dollar amount or leave blank for unlimited.",
          })
          setSaving(false)
          return
        }
        payload.aiMonthlyBudgetDollars =
          viewerRole === "member" ? n / AI_DISPLAY_TOKENS_PER_USD : n
      }

      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/ai-usage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { ok?: boolean; message?: string; budget?: { aiMonthlyBudgetCents: number | null } }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Save failed",
          description: data.message || "Could not update budget.",
        })
        return
      }
      setBudgetCents(data.budget?.aiMonthlyBudgetCents ?? null)
      setEnforcementMode(modeInput)
      toast({ title: "AI budget updated" })
      await load()
    } finally {
      setSaving(false)
    }
  }

  if (orgStatus === "loading") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading organization…</span>
      </div>
    )
  }

  if (!organizationId) {
    return (
      <div className="text-sm text-muted-foreground py-8">
        Select an organization to view AI usage and budget settings.
      </div>
    )
  }

  if (loadState === "loading" || loadState === "idle") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-12">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading AI usage…</span>
      </div>
    )
  }

  if (
    loadState === "error" ||
    (loadState === "ready" &&
      viewerRole &&
      ((viewerRole === "platform_admin" && !summary) || (viewerRole === "member" && !tenantAiUsage)))
  ) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        Could not load AI usage.{" "}
        <button type="button" className="text-primary underline" onClick={() => void load()}>
          Retry
        </button>
      </div>
    )
  }

  const isAdmin = viewerRole === "platform_admin"

  const taskRows = isAdmin
    ? Object.entries(summary!.byTask).sort((a, b) => b[1].estimatedCostUsd - a[1].estimatedCostUsd)
    : Object.entries(tenantAiUsage!.byTask).sort((a, b) => b[1].aiTokens - a[1].aiTokens)

  const modelRows = isAdmin
    ? Object.entries(summary!.byProviderModel).sort((a, b) => b[1].estimatedCostUsd - a[1].estimatedCostUsd)
    : []

  const budgetUsdDisplay =
    budgetCents != null ? money.format(budgetCents / 100) : "No limit"
  const mtdCents = Math.round(mtdUsd * 100)
  const budgetExceeded =
    isAdmin && budgetCents != null && budgetCents > 0 && mtdCents >= budgetCents

  const includedUsd = planAi?.includedMonthlyBudgetUsd ?? 0
  const includedTokensApprox = planAi?.includedAiTokensApprox ?? 0
  const includedCents = Math.round(includedUsd * 100)
  const overIncludedAllowance = isAdmin && includedCents > 0 && mtdCents > includedCents
  const nearIncludedAllowance =
    isAdmin && includedCents > 0 && !overIncludedAllowance && mtdCents >= Math.floor(includedCents * 0.85)

  const memberMtdTokens = memberBudget?.mtdAiTokensUsedApprox ?? 0
  const memberCapTokens = memberBudget?.aiMonthlyAiTokenBudgetApprox
  const budgetExceededMember =
    !isAdmin && memberCapTokens != null && memberCapTokens > 0 && memberMtdTokens >= memberCapTokens

  const overIncludedMember =
    !isAdmin && includedTokensApprox > 0 && memberMtdTokens > includedTokensApprox
  const nearIncludedMember =
    !isAdmin &&
    includedTokensApprox > 0 &&
    !overIncludedMember &&
    memberMtdTokens >= Math.floor(includedTokensApprox * 0.85)

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">AI usage</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? (
            <>
              Internal estimate: provider tokens × model pricing. Totals are for the current calendar month (UTC).
            </>
          ) : (
            <>
              AI token totals combine prompt and completion usage for the current calendar month (UTC). Trial workspaces may use a guided preview experience that still counts toward these totals.
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-3 rounded-md border border-border bg-muted/25 px-3 py-2">
          <span className="font-medium text-foreground">AIden</span> usage this month (UTC):{" "}
          <span className="tabular-nums">{aidenUsageMonth.support_chat.toLocaleString()}</span> help chats ·{" "}
          <span className="tabular-nums">{aidenUsageMonth.feature_request.toLocaleString()}</span> feature requests
          submitted. Chat-related router usage is attributed to task{" "}
          <code className="text-[11px]">aiden_help</code> in the breakdown below.
        </p>
      </div>

      {planAi ? (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">Plan &amp; included AI</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Workspace tier controls which AI features run server-side.{" "}
              <Link href="/settings/billing" className="text-primary underline-offset-4 hover:underline">
                View billing &amp; upgrade
              </Link>
            </p>
          </div>
          <div className="p-4 space-y-4 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-muted-foreground">Current plan</span>
              <span className="font-medium text-foreground">{planAi.planLabel}</span>
              {planAi.planGatingDisabled ? (
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  Plan checks bypassed in this environment (dev / preview).
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {isAdmin ? "Included guidance (month, internal est.)" : "Included AI tokens (month, approx.)"}
                </p>
                <p className="text-base font-semibold tabular-nums mt-0.5">
                  {isAdmin ? money.format(includedUsd) : includedTokensApprox.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {isAdmin
                    ? "Typical allowance for your tier; your org can still set a separate budget cap below."
                    : "Approximate AI tokens included with your plan tier — shown without vendor or dollar detail."}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {isAdmin ? "Spend vs included (MTD)" : "Usage vs included (MTD)"}
                </p>
                <p className="text-base font-semibold tabular-nums mt-0.5">
                  {isAdmin ? (
                    <>
                      {money.format(mtdUsd)} / {money.format(includedUsd)}
                    </>
                  ) : (
                    <>
                      {memberMtdTokens.toLocaleString()} / {includedTokensApprox.toLocaleString()}
                    </>
                  )}
                </p>
                {isAdmin && includedCents > 0 ? (
                  <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary/80 rounded-full transition-[width]"
                      style={{
                        width: `${Math.min(100, Math.round((mtdCents / includedCents) * 100))}%`,
                      }}
                    />
                  </div>
                ) : null}
                {!isAdmin && includedTokensApprox > 0 ? (
                  <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary/80 rounded-full transition-[width]"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((memberMtdTokens / includedTokensApprox) * 100),
                        )}%`,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
            {((isAdmin && (overIncludedAllowance || nearIncludedAllowance)) ||
              (!isAdmin && (overIncludedMember || nearIncludedMember))) &&
            !planAi.planGatingDisabled ? (
              <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md px-3 py-2">
                {isAdmin ? (
                  <>
                    {overIncludedAllowance
                      ? "Month-to-date usage is above the included allowance for your plan. "
                      : "You are approaching the included allowance for your plan. "}
                  </>
                ) : (
                  <>
                    {overIncludedMember
                      ? "Month-to-date AI tokens are above the included allowance for your plan. "
                      : "You are approaching the included AI token allowance for your plan. "}
                  </>
                )}
                <Link href="/settings/billing" className="text-primary underline-offset-4 hover:underline">
                  Compare plans
                </Link>{" "}
                if you need higher limits.
              </p>
            ) : null}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">AI features on your plan</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                {planAi.features.map((f) => (
                  <li key={f.taskId} className="flex gap-2">
                    <span className={f.allowed ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                      {f.allowed ? "✓" : "—"}
                    </span>
                    <span className={f.allowed ? "text-foreground" : "text-muted-foreground"}>{f.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Response cache</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Repeated identical AI inputs can be served from cache (no provider tokens). Hit counts update when a cached row is reused.
          </p>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{cacheTotalHits.toLocaleString()}</span> total recorded cache hits
            (sum of per-entry counters).
            {isAdmin ? <> Dollar savings are not estimated automatically.</> : null}
          </p>
          <p className="text-xs text-muted-foreground">
            Cache-hit visibility in <code className="text-[11px]">ai_usage_logs</code>:{" "}
            {cacheLogHitsToUsage ? "enabled (zero-cost rows when AI_LOG_CACHE_HITS_TO_USAGE is on)" : "disabled"}
          </p>
          {cacheNote && <p className="text-xs text-muted-foreground">{cacheNote}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Task</th>
                  <th className="py-2 font-medium text-right">Hits</th>
                  <th className="py-2 font-medium">Last hit</th>
                  <th className="py-2 font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {cacheRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-muted-foreground text-xs">
                      No cache entries yet for this workspace.
                    </td>
                  </tr>
                ) : (
                  cacheRows.map((r) => (
                    <tr key={r.storage_key} className="border-b border-border/80">
                      <td className="py-2 font-mono text-xs">{r.task}</td>
                      <td className="py-2 text-right tabular-nums">{r.hit_count.toLocaleString()}</td>
                      <td className="py-2 text-xs whitespace-nowrap text-muted-foreground">
                        {r.last_hit_at ? new Date(r.last_hit_at).toLocaleString() : "—"}
                      </td>
                      <td className="py-2 text-xs whitespace-nowrap text-muted-foreground">
                        {r.expires_at ? new Date(r.expires_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{isAdmin ? "Today (internal est.)" : "Today"}</p>
          {isAdmin ? (
            <>
              <p className="text-xl font-semibold tabular-nums">{money.format(summary!.estimatedCostTodayUsd)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tokens: {summary!.promptTokensToday.toLocaleString()} in /{" "}
                {summary!.completionTokensToday.toLocaleString()} out
              </p>
            </>
          ) : (
            <>
              <p className="text-xl font-semibold tabular-nums">
                {tenantAiUsage!.aiTokensUsedToday.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">AI tokens (prompt + completion)</p>
            </>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">{isAdmin ? "Month-to-date (internal est.)" : "Month-to-date"}</p>
          {isAdmin ? (
            <>
              <p className="text-xl font-semibold tabular-nums">{money.format(mtdUsd)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tokens: {summary!.promptTokensMonth.toLocaleString()} in /{" "}
                {summary!.completionTokensMonth.toLocaleString()} out
              </p>
            </>
          ) : (
            <>
              <p className="text-xl font-semibold tabular-nums">
                {tenantAiUsage!.aiTokensUsedMonth.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">AI tokens (prompt + completion)</p>
            </>
          )}
        </div>
      </div>

      {isAdmin && budgetExceeded ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          Month-to-date spend has reached or exceeded the configured monthly budget
          {enforcementMode === "block" ? " — new AI requests are blocked until the budget is raised or the month rolls over." : " — new requests still run, but usage is over budget (warn mode)."}
        </div>
      ) : null}

      {!isAdmin && budgetExceededMember ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          Month-to-date AI tokens have reached or exceeded the configured monthly token budget
          {enforcementMode === "block"
            ? " — new AI requests are blocked until the budget is raised or the month rolls over."
            : " — new requests still run, but usage is over budget (warn mode)."}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Budget & enforcement</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Owners, admins, and managers can set a soft monthly cap. Leave budget empty for no limit.
          </p>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {isAdmin ? "Monthly budget (USD)" : "Monthly AI token budget (approx.)"}
              </label>
              <input
                type="text"
                inputMode={isAdmin ? "decimal" : "numeric"}
                className="input-base w-full"
                placeholder="Unlimited"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                disabled={!canEditBudget}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">When budget is reached</label>
              <select
                className="input-base w-full"
                value={modeInput}
                onChange={(e) => setModeInput(e.target.value as "warn" | "block")}
                disabled={!canEditBudget}
              >
                <option value="warn">Warn (allow overage, log only)</option>
                <option value="block">Block (reject new AI calls)</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Current cap:{" "}
            <span className="font-medium text-foreground">
              {isAdmin ? budgetUsdDisplay : memberCapTokens != null ? memberCapTokens.toLocaleString() + " AI tokens" : "No limit"}
            </span>{" "}
            · Mode: <span className="font-medium text-foreground">{enforcementMode}</span>
          </p>
          {canEditBudget ? (
            <Button type="button" size="sm" onClick={() => void handleSaveBudget()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                "Save budget settings"
              )}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">You can view usage but not edit the budget for this workspace.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Usage by task (MTD)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Task</th>
                {isAdmin ? (
                  <>
                    <th className="px-4 py-2 font-medium text-right">Est. cost</th>
                    <th className="px-4 py-2 font-medium text-right">Prompt tok</th>
                    <th className="px-4 py-2 font-medium text-right">Completion tok</th>
                  </>
                ) : (
                  <th className="px-4 py-2 font-medium text-right">AI tokens</th>
                )}
              </tr>
            </thead>
            <tbody>
              {taskRows.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 4 : 2} className="px-4 py-6 text-center text-muted-foreground">
                    No AI usage recorded this month.
                  </td>
                </tr>
              ) : isAdmin ? (
                taskRows.map(([task, row]) => {
                  const r = row as { estimatedCostUsd: number; promptTokens: number; completionTokens: number }
                  return (
                    <tr key={task} className="border-b border-border/80">
                      <td className="px-4 py-2 font-mono text-xs">{task}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{money.format(r.estimatedCostUsd)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.promptTokens.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.completionTokens.toLocaleString()}</td>
                    </tr>
                  )
                })
              ) : (
                taskRows.map(([task, row]) => {
                  const r = row as { aiTokens: number }
                  return (
                    <tr key={task} className="border-b border-border/80">
                      <td className="px-4 py-2 font-mono text-xs">{task}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.aiTokens.toLocaleString()}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && mockLiveSplit ? (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">Mock vs live usage (MTD, internal)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Trial preview rows use provider <code className="text-[11px]">mock</code> with zero real dollar cost.
            </p>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Trial simulation</p>
              <p className="mt-1 tabular-nums">
                {mockLiveSplit.mockTrial.requests.toLocaleString()} requests ·{" "}
                {mockLiveSplit.mockTrial.aiTokens.toLocaleString()} tokens ·{" "}
                {money.format(mockLiveSplit.mockTrial.estimatedCostUsd)} est.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Live providers</p>
              <p className="mt-1 tabular-nums">
                {mockLiveSplit.live.requests.toLocaleString()} requests ·{" "}
                {mockLiveSplit.live.aiTokens.toLocaleString()} tokens ·{" "}
                {money.format(mockLiveSplit.live.estimatedCostUsd)} est.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {isAdmin ? (
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Usage by provider / model (MTD)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Provider · model</th>
                <th className="px-4 py-2 font-medium text-right">Est. cost</th>
                <th className="px-4 py-2 font-medium text-right">Prompt tok</th>
                <th className="px-4 py-2 font-medium text-right">Completion tok</th>
              </tr>
            </thead>
            <tbody>
              {modelRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    No AI usage recorded this month.
                  </td>
                </tr>
              ) : (
                modelRows.map(([key, row]) => (
                  <tr key={key} className="border-b border-border/80">
                    <td className="px-4 py-2 font-mono text-xs">{key}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money.format(row.estimatedCostUsd)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.promptTokens.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.completionTokens.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Recent requests</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Time (UTC)</th>
                <th className="px-4 py-2 font-medium">Task</th>
                {isAdmin ? (
                  <>
                    <th className="px-4 py-2 font-medium">Model</th>
                    <th className="px-4 py-2 font-medium text-right">Cost</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-2 font-medium">Mode</th>
                    <th className="px-4 py-2 font-medium text-right">AI tokens</th>
                  </>
                )}
                <th className="px-4 py-2 font-medium text-center">OK</th>
              </tr>
            </thead>
            <tbody>
              {(isAdmin ? recent.length === 0 : recentTenant.length === 0) ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No requests logged yet.
                  </td>
                </tr>
              ) : isAdmin ? (
                recent.map((r) => (
                  <tr key={r.id} className="border-b border-border/80">
                    <td className="px-4 py-2 text-xs whitespace-nowrap">{new Date(r.created_at).toISOString().slice(0, 19)}Z</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.task}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {r.provider}:{r.model}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{money.format(r.estimated_cost)}</td>
                    <td className="px-4 py-2 text-center">{r.success ? "✓" : "—"}</td>
                  </tr>
                ))
              ) : (
                recentTenant.map((r) => (
                  <tr key={r.id} className="border-b border-border/80">
                    <td className="px-4 py-2 text-xs whitespace-nowrap">{new Date(r.created_at).toISOString().slice(0, 19)}Z</td>
                    <td className="px-4 py-2 font-mono text-xs">{r.task}</td>
                    <td className="px-4 py-2 text-xs capitalize">{r.ai_mode.replace("_", " ")}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.ai_tokens.toLocaleString()}</td>
                    <td className="px-4 py-2 text-center">{r.success ? "✓" : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
