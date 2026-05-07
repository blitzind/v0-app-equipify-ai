"use client"

/**
 * AI Ops Phase 2 — top-3 urgent dashboard digest.
 *
 * Designed as the data layer for a future daily-email digest:
 * `top3` is calculated by the same `/recommendations` endpoint
 * (priority desc, anchor asc), so any future Slack / email
 * scheduler can call the API directly and receive the same payload
 * the dashboard already shows.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Bot, ChevronRight, Loader2, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { cn } from "@/lib/utils"
import type { Recommendation, RecommendationsResponse } from "@/lib/ai-ops/types"
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  PRIORITY_BADGE,
  PRIORITY_LABEL,
} from "./category-meta"
import { logAiOpsOutcome } from "./log-outcome"

const TOP_N = 3

export function AiOpsDigestCard() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { permissions } = useOrgPermissions()
  const [items, setItems] = useState<Recommendation[]>([])
  const [stats, setStats] = useState<{ total: number; high: number; medium: number; low: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!permissions.canViewInsights) {
      setLoading(false)
      return
    }
    if (!organizationId || orgStatus !== "ready") return
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ priority: "high,medium", limit: "20" })
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/ai-ops/recommendations?${params}`,
          { cache: "no-store" },
        )
        const body = (await res.json()) as RecommendationsResponse & { error?: string }
        if (!res.ok) throw new Error(body.error ?? "Failed to load.")
        if (!cancelled) {
          setItems(body.items.slice(0, TOP_N))
          setStats({
            total: body.summary.total,
            high: body.summary.high,
            medium: body.summary.medium,
            low: body.summary.low,
          })
        }
      } catch {
        if (!cancelled) {
          setItems([])
          setStats(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, orgStatus, permissions.canViewInsights])

  if (!permissions.canViewInsights) return null

  return (
    <Card className="border-violet-500/20 bg-gradient-to-b from-violet-500/[0.04] to-card">
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-7 w-7 rounded-lg border border-violet-500/30 bg-violet-500/[0.10] flex items-center justify-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-sm flex items-center gap-2">
              Today's focus
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide gap-1">
                <Bot className="h-3 w-3" aria-hidden /> AI Ops
              </Badge>
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {stats?.total ? `${stats.total} active recommendations` : "Top 3 urgent next actions"}
              {stats?.high ? ` · ${stats.high} high-priority` : ""}
            </p>
          </div>
        </div>
        <Button asChild variant="ghost" size="sm" className="h-7 gap-1 shrink-0 text-xs">
          <Link href="/ai-ops">
            View all
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-1 pb-3 space-y-1.5">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 justify-center">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">
            Nothing urgent. Great work.
          </p>
        ) : (
          items.map((rec) => {
            const Icon = CATEGORY_ICON[rec.category]
            const href = rec.actions[0]?.href ?? "/ai-ops"
            return (
              <Link
                key={rec.key}
                href={href}
                onClick={() =>
                  organizationId && rec.entity
                    ? logAiOpsOutcome(organizationId, rec, "opened_entity", { source: "digest" })
                    : null
                }
                className="flex items-start gap-2.5 rounded-md border border-border bg-card px-3 py-2 hover:border-primary/30 transition-colors"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{rec.title}</p>
                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                    <Badge variant="outline" className={cn("text-[10px]", PRIORITY_BADGE[rec.priority])}>
                      {PRIORITY_LABEL[rec.priority]}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {CATEGORY_LABEL[rec.category]}
                    </span>
                    {rec.metric ? (
                      <span className="text-[10px] text-muted-foreground">
                        · {rec.metric.label} {rec.metric.value}
                      </span>
                    ) : null}
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
              </Link>
            )
          })
        )}
        <p className="text-[10px] text-muted-foreground pt-1 leading-snug">
          Daily email + Slack digest hooks coming soon. See <code className="text-[10px]">docs/AI_OPS_PHASE2.md</code>.
        </p>
      </CardContent>
    </Card>
  )
}
