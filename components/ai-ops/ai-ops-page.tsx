"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bot, Filter, Loader2, RefreshCw, Search, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { cn } from "@/lib/utils"
import type {
  Recommendation,
  RecommendationCategory,
  RecommendationPriority,
  RecommendationsResponse,
} from "@/lib/ai-ops/types"
import { RecommendationCard } from "./recommendation-card"
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
} from "./category-meta"

const ALL_CATEGORIES: RecommendationCategory[] = [
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

const ALL_PRIORITIES: RecommendationPriority[] = ["high", "medium", "low"]

type ApiResponse = RecommendationsResponse & {
  role: string | null
  canDismiss: boolean
  error?: string
}

export function AiOpsPage() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { permissions } = useOrgPermissions()

  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<"all" | RecommendationCategory>("all")
  const [priority, setPriority] = useState<"all" | RecommendationPriority>("all")
  const [refreshKey, setRefreshKey] = useState(0)

  const fetchRecs = useCallback(async () => {
    if (!organizationId || orgStatus !== "ready") return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (category !== "all") params.set("category", category)
      if (priority !== "all") params.set("priority", priority)
      if (search.trim()) params.set("search", search.trim())
      params.set("limit", "100")
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/ai-ops/recommendations?${params.toString()}`,
        { cache: "no-store" },
      )
      const body = (await res.json()) as ApiResponse
      if (!res.ok) throw new Error(body.error ?? "Failed to load recommendations.")
      setData(body)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load recommendations.")
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgStatus, category, priority, search])

  useEffect(() => {
    void fetchRecs()
  }, [fetchRecs, refreshKey])

  const items = data?.items ?? []
  const summary = data?.summary
  const visibleCategories = useMemo(
    () =>
      data?.visibleCategories?.length
        ? data.visibleCategories
        : (ALL_CATEGORIES.filter((c) => isCategoryVisible(c, permissions)) as RecommendationCategory[]),
    [data?.visibleCategories, permissions],
  )

  function handleDismissed(key: string) {
    setData((prev) => {
      if (!prev) return prev
      const nextItems = prev.items.filter((i) => i.key !== key)
      return {
        ...prev,
        items: nextItems,
        summary: recomputeSummary(nextItems),
      }
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card px-4 sm:px-6 py-4 sm:py-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl border border-violet-500/30 bg-violet-500/[0.08] flex items-center justify-center shrink-0">
            <Bot className="h-5 w-5 text-violet-600 dark:text-violet-400" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight">AI Operations</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              Practical next actions derived from your prospects, work orders, invoices,
              inventory, automations, and communications. Read-only — Equipify never
              changes records or sends messages on your behalf from here.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total" value={summary?.total ?? 0} accent="muted" />
        <KpiCard label="High priority" value={summary?.high ?? 0} accent="red" />
        <KpiCard label="Medium" value={summary?.medium ?? 0} accent="amber" />
        <KpiCard label="Low" value={summary?.low ?? 0} accent="sky" />
      </div>

      <div className="rounded-xl border border-border bg-card px-3 sm:px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recommendations…"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
            <SelectTrigger className="h-9 w-full sm:w-44 text-sm">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" aria-hidden />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {visibleCategories.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
            <SelectTrigger className="h-9 w-full sm:w-36 text-sm">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {ALL_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p[0]!.toUpperCase() + p.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="-mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span className="uppercase tracking-wide">By category</span>
          {summary && summary.total > 0 ? (
            Object.entries(summary.byCategory).map(([cat, n]) => {
              const Icon = CATEGORY_ICON[cat as RecommendationCategory]
              return (
                <Badge key={cat} variant="outline" className="gap-1 normal-case">
                  <Icon className="h-3 w-3" aria-hidden />
                  {CATEGORY_LABEL[cat as RecommendationCategory]}
                  <span className="font-semibold text-foreground">{n}</span>
                </Badge>
              )
            })
          ) : (
            <span className="italic">No active recommendations</span>
          )}
        </div>

        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="gap-1.5 h-8"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Generating recommendations…
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map((rec) => (
            <RecommendationCard
              key={rec.key}
              rec={rec}
              canDismiss={Boolean(data?.canDismiss)}
              onDismissed={handleDismissed}
              organizationId={organizationId ?? ""}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function recomputeSummary(items: Recommendation[]) {
  const summary = {
    total: items.length,
    high: 0,
    medium: 0,
    low: 0,
    byCategory: {} as Partial<Record<RecommendationCategory, number>>,
  }
  for (const i of items) {
    summary[i.priority] += 1
    summary.byCategory[i.category] = (summary.byCategory[i.category] ?? 0) + 1
  }
  return summary
}

function isCategoryVisible(c: RecommendationCategory, perms: ReturnType<typeof useOrgPermissions>["permissions"]): boolean {
  switch (c) {
    case "prospect":
      return Boolean(perms.canManageProspects)
    case "financial":
      return Boolean(perms.canViewFinancials)
    case "communications":
      return Boolean(perms.canManageCommunications)
    case "inventory":
      return Boolean(perms.canManageInventory)
    case "certificate":
      return Boolean(perms.canReleaseCertificatesToPortal)
    case "automation":
      return Boolean(perms.canManageAutomations)
    default:
      return true
  }
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: "muted" | "red" | "amber" | "sky"
}) {
  const accentClasses: Record<typeof accent, string> = {
    muted: "border-border",
    red: "border-red-500/30",
    amber: "border-amber-500/30",
    sky: "border-sky-500/30",
  }
  const textClasses: Record<typeof accent, string> = {
    muted: "text-foreground",
    red: "text-red-600 dark:text-red-400",
    amber: "text-amber-600 dark:text-amber-400",
    sky: "text-sky-600 dark:text-sky-400",
  }
  return (
    <div className={cn("rounded-xl border bg-card px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]", accentClasses[accent])}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-bold mt-0.5 tabular-nums", textClasses[accent])}>{value}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <Sparkles className="h-6 w-6 mx-auto text-muted-foreground" aria-hidden />
      <h3 className="text-sm font-semibold mt-3">Nothing needs attention right now</h3>
      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
        No overdue prospects, late invoices, or operational risks were detected. New
        recommendations will appear here as your data changes.
      </p>
    </div>
  )
}
