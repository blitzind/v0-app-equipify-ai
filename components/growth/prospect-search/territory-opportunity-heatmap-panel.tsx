"use client"

import { ChevronRight, Flame, Loader2, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type {
  GrowthTerritoryOpportunityHeatmapResult,
  GrowthTerritoryOpportunityRecommendedAction,
} from "@/lib/growth/prospect-search/territory-opportunity-heatmap"
import {
  formatTerritoryOpportunityCountLabel,
  GROWTH_TERRITORY_OPPORTUNITY_HEATMAP_QA_MARKER,
} from "@/lib/growth/prospect-search/territory-opportunity-heatmap"
import { cn } from "@/lib/utils"

function scoreTone(score: number): "attention" | "healthy" | "medium" | "neutral" {
  if (score >= 80) return "attention"
  if (score >= 60) return "healthy"
  if (score >= 35) return "medium"
  return "neutral"
}

function formatBuyingStage(stage: string): string {
  return stage.replace(/_/g, " ")
}

export function TerritoryOpportunityHeatmapPanel({
  heatmap,
  loading,
  compact,
  onDrilldown,
  onRecommendedAction,
}: {
  heatmap: GrowthTerritoryOpportunityHeatmapResult | null | undefined
  loading?: boolean
  compact?: boolean
  onDrilldown: (territoryId: string) => void
  onRecommendedAction: (action: GrowthTerritoryOpportunityRecommendedAction) => void
}) {
  if (!heatmap && !loading) {
    return (
      <section
        className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-xs text-muted-foreground"
        data-qa-marker={GROWTH_TERRITORY_OPPORTUNITY_HEATMAP_QA_MARKER}
        data-mobile-source-wiring="territory-opportunity-heatmap-v1"
      >
        Add a territory filter or restore a saved workflow to rank territory opportunity density from the indexed market.
      </section>
    )
  }

  const summary = heatmap?.summary

  return (
    <section
      className={cn(
        "rounded-xl border border-violet-100 bg-violet-50/40",
        compact ? "p-3" : "p-4",
      )}
      data-qa-marker={GROWTH_TERRITORY_OPPORTUNITY_HEATMAP_QA_MARKER}
      data-mobile-source-wiring="territory-opportunity-heatmap-v1"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Flame className="size-4 text-violet-800" />
          <h4 className="text-sm font-semibold text-violet-950">Territory opportunities</h4>
          {loading ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" /> : null}
          {summary ? (
            <GrowthBadge
              label={`${summary.opportunity_score}/100 heat`}
              tone={scoreTone(summary.opportunity_score)}
            />
          ) : null}
        </div>
        {heatmap ? (
          <span className="text-[10px] text-muted-foreground">
            Indexed only · no provider calls · bucket: {heatmap.bucket_dimension.replace(/_/g, " ")}
          </span>
        ) : null}
      </div>

      {summary ? (
        <>
          <div
            className={cn(
              "mt-3 grid gap-2 text-[11px] text-muted-foreground",
              compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4",
            )}
          >
            <MetricCard label="Matching companies" value={summary.total_companies.toLocaleString()} />
            <MetricCard label="Qualified prospects" value={summary.qualified_prospects.toLocaleString()} />
            <MetricCard label="High-intent" value={summary.high_intent_prospects.toLocaleString()} />
            <MetricCard label="DM coverage" value={`${summary.decision_maker_coverage_pct}%`} />
            <MetricCard label="Suppressed" value={summary.suppressed_count.toLocaleString()} />
            <MetricCard
              label="Existing customer/prospect"
              value={(summary.existing_customer_count + summary.existing_prospect_count).toLocaleString()}
            />
            <MetricCard label="Avg lead score" value={`${summary.average_lead_score}`} />
            <MetricCard
              label="Adj. opportunities"
              value={summary.suppression_adjusted_opportunity_count.toLocaleString()}
            />
          </div>

          {summary.top_buying_stages.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {summary.top_buying_stages.map((stage) => (
                <span
                  key={stage.stage}
                  className="rounded-full border border-violet-200 bg-background/80 px-2 py-0.5 text-[10px] text-violet-900"
                >
                  {formatBuyingStage(stage.stage)} · {stage.count}
                </span>
              ))}
            </div>
          ) : null}

          {heatmap?.territories.length ? (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Top territories
              </p>
              <ul className="space-y-1">
                {heatmap.territories.slice(0, compact ? 4 : 8).map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-md border border-border/70 bg-card px-2.5 py-2 text-left text-xs hover:border-violet-300 hover:bg-violet-50/60"
                      onClick={() => onDrilldown(row.id)}
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <MapPin className="size-3 shrink-0 text-violet-700" />
                        <span className="truncate font-medium">{row.label}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                        <span>
                          {formatTerritoryOpportunityCountLabel(
                            row.suppression_adjusted_opportunity_count,
                            row.bucket_dimension,
                          )}
                        </span>
                        <GrowthBadge label={`${row.opportunity_score}`} tone={scoreTone(row.opportunity_score)} />
                        <ChevronRight className="size-3.5" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {summary.score_explanation.length ? (
            <details className="mt-3 rounded-md border border-violet-100 bg-background/70 px-2.5 py-2 text-[11px] text-muted-foreground">
              <summary className="cursor-pointer font-medium text-violet-950">Score breakdown</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {summary.score_explanation.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {loading ? "Computing territory opportunity from indexed companies…" : "No territory data yet."}
        </p>
      )}

      {heatmap ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-violet-100 pt-3">
          <Button size="sm" variant="outline" onClick={() => onRecommendedAction(heatmap.recommended_action)}>
            {heatmap.recommended_action_label}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onRecommendedAction("review_territory")}>
            Review territory
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onRecommendedAction("bulk_push_qualified")}>
            Bulk push qualified
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onRecommendedAction("launch_outbound_review")}>
            Launch outbound review
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onRecommendedAction("save_workflow")}>
            Save workflow
          </Button>
        </div>
      ) : null}
    </section>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/70 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
