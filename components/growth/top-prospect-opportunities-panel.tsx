"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ArrowRight, Sparkles, X } from "lucide-react"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  PROSPECT_RECOMMENDATION_FILTERS,
  PROSPECT_RECOMMENDATION_QA_MARKER,
  PROSPECT_RECOMMENDATION_SORT_FIELDS,
  type ProspectRecommendationFilter,
  type ProspectRecommendationSortField,
  type TopProspectOpportunityCard,
} from "@/lib/growth/prospect-discovery/prospect-recommendation-types"
import { cn } from "@/lib/utils"

const FILTER_LABELS: Record<ProspectRecommendationFilter, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
}

const SORT_LABELS: Record<ProspectRecommendationSortField, string> = {
  priority: "Priority",
  confidence: "Confidence",
  estimated_revenue_impact: "Revenue Impact",
}

function priorityTone(priority: string): "critical" | "high" | "attention" | "neutral" {
  if (priority === "urgent") return "critical"
  if (priority === "high") return "high"
  if (priority === "medium") return "attention"
  return "neutral"
}

export function TopProspectOpportunitiesPanel({
  executionRunId,
  compact = false,
  title = "Top Prospect Opportunities",
}: {
  executionRunId?: string | null
  compact?: boolean
  title?: string
}) {
  const [items, setItems] = useState<TopProspectOpportunityCard[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ProspectRecommendationFilter | null>(null)
  const [sort, setSort] = useState<ProspectRecommendationSortField>("priority")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter) params.set("filter", filter)
      params.set("sort", sort)
      params.set("limit", compact ? "8" : "24")
      if (executionRunId) params.set("ensure", "true")

      const base = executionRunId
        ? `/api/platform/growth/prospect-recommendations/${encodeURIComponent(executionRunId)}`
        : "/api/platform/growth/prospect-recommendations"
      const res = await fetch(`${base}?${params.toString()}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        recommendations?: { top_opportunities: TopProspectOpportunityCard[] }
      }
      setItems(res.ok && data.recommendations ? data.recommendations.top_opportunities : [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [compact, executionRunId, filter, sort])

  useEffect(() => {
    void load()
  }, [load])

  async function applyAction(audit_event_id: string, action: "mark_viewed" | "mark_acted_on" | "dismiss") {
    await fetch("/api/platform/growth/prospect-recommendations/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audit_event_id, action }),
    })
    void load()
  }

  return (
    <GrowthEngineCard
      className="overflow-hidden"
      data-qa-marker={PROSPECT_RECOMMENDATION_QA_MARKER}
      icon={<Sparkles className="h-4 w-4 text-amber-500" />}
      title={title}
    >
      <p className="-mt-2 mb-3 text-xs text-muted-foreground">
        Signal-aware recommendations only — human approval required before any enrollment or outreach.
      </p>
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition",
              filter === null ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            All
          </button>
          {PROSPECT_RECOMMENDATION_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition",
                filter === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {FILTER_LABELS[value]}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as ProspectRecommendationSortField)}
          className="ml-auto rounded-md border border-border bg-background px-2 py-1 text-xs"
        >
          {PROSPECT_RECOMMENDATION_SORT_FIELDS.map((field) => (
            <option key={field} value={field}>
              Sort: {SORT_LABELS[field]}
            </option>
          ))}
        </select>
      </div>

      <div className={cn("divide-y divide-border/60", compact ? "max-h-[420px] overflow-y-auto" : "")}>
        {loading ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">Loading prospect recommendations…</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            No prospect recommendations yet. Run a discovery execution to generate signal-aware opportunities.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.recommendation_id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{item.company_name}</p>
                    <GrowthBadge tone={priorityTone(item.priority)}>{item.priority}</GrowthBadge>
                    {item.collapsed_count > 1 ? (
                      <GrowthBadge tone="neutral">{item.collapsed_count} recommendations</GrowthBadge>
                    ) : null}
                  </div>
                  {item.signals.length > 0 ? (
                    <p className="text-xs text-muted-foreground">{item.signals.join(" · ")}</p>
                  ) : null}
                  <p className="text-sm">
                    <span className="text-muted-foreground">Recommendation: </span>
                    {item.primary_recommendation}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expected Revenue Impact: {item.estimated_revenue_impact} · Confidence {item.confidence}%
                  </p>
                  {item.recommended_actions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.recommended_actions.slice(0, 4).map((action) => (
                        <span
                          key={action}
                          className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {action}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label="Dismiss recommendation"
                  onClick={() => void applyAction(item.audit_event_id, "dismiss")}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {item.cta.review_company ? (
                  <Link
                    href={item.cta.review_company}
                    onClick={() => void applyAction(item.audit_event_id, "mark_viewed")}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    Review Company
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : null}
                {item.cta.view_signals ? (
                  <Link
                    href={item.cta.view_signals}
                    onClick={() => void applyAction(item.audit_event_id, "mark_viewed")}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    View Signals
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : null}
                {item.cta.review_sequence ? (
                  <Link
                    href={item.cta.review_sequence}
                    onClick={() => void applyAction(item.audit_event_id, "mark_viewed")}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    Review Sequence Recommendation
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </GrowthEngineCard>
  )
}
