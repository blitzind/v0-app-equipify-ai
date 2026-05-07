"use client"

/**
 * AI Operational Assistant Phase 1 — compact dashboard widget.
 *
 * Pulls the top-priority recommendations from `/ai-ops/recommendations`
 * and renders them as a small card list with a "View all" link to the
 * full /ai-ops page. Permission-gated upstream by `canViewInsights` —
 * we render a tasteful empty state when no recommendations exist.
 */

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Bot, ChevronRight, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { cn } from "@/lib/utils"
import type { Recommendation, RecommendationsResponse } from "@/lib/ai-ops/types"
import { CATEGORY_ICON, CATEGORY_LABEL, PRIORITY_BADGE, PRIORITY_LABEL } from "./category-meta"

export function AiOpsSummaryWidget({ limit = 4 }: { limit?: number }) {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { permissions } = useOrgPermissions()
  const [items, setItems] = useState<Recommendation[]>([])
  const [total, setTotal] = useState(0)
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
        const params = new URLSearchParams({ priority: "high,medium", limit: String(limit) })
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/ai-ops/recommendations?${params}`,
          { cache: "no-store" },
        )
        const body = (await res.json()) as RecommendationsResponse & { error?: string }
        if (!res.ok) throw new Error(body.error ?? "Failed to load.")
        if (!cancelled) {
          setItems(body.items.slice(0, limit))
          setTotal(body.summary.total)
        }
      } catch {
        if (!cancelled) {
          setItems([])
          setTotal(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, orgStatus, permissions.canViewInsights, limit])

  if (!permissions.canViewInsights) return null

  return (
    <Card className="border-border">
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-7 w-7 rounded-lg border border-violet-500/30 bg-violet-500/[0.08] flex items-center justify-center shrink-0">
            <Bot className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-sm">AI Operations</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Top-priority next actions across the workspace.
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
      <CardContent className="pt-0 pb-3 space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Nothing needs attention right now. Great work.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((rec) => {
              const Icon = CATEGORY_ICON[rec.category]
              return (
                <li key={rec.key}>
                  <Link
                    href={rec.actions[0]?.href ?? "/ai-ops"}
                    className="flex items-start gap-2.5 rounded-md border border-border bg-muted/20 px-3 py-2 hover:border-primary/30 transition-colors"
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
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                  </Link>
                </li>
              )
            })}
            {total > items.length ? (
              <p className="text-[11px] text-muted-foreground pl-1 pt-1">
                {total - items.length} more · view all
              </p>
            ) : null}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
